'use strict';

const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ModerationCase = require('../../database/models/ModerationCase');
const Guild = require('../../database/models/Guild');
const { hasStaffRole } = require('../../utils/permissions');
const { errorEmbed, flowEmbed, paginationRow } = require('../../utils/embeds');
const { EMOJIS, COLORS } = require('../../config');
const Logger = require('../../core/Logger');

const CASES_PER_PAGE = 5;

/**
 * Build the Components v2 history embed for a specific page of cases
 */
async function buildHistoryEmbed(guild, userId, userTag, page) {
  const cases = await ModerationCase.find({ guildId: guild.id, userId }).sort({ timestamp: -1 });

  const totalCases = cases.length;
  const totalPages = Math.max(1, Math.ceil(totalCases / CASES_PER_PAGE));
  const currentPage = Math.min(totalPages, Math.max(1, page));

  const startIndex = (currentPage - 1) * CASES_PER_PAGE;
  const paginatedCases = cases.slice(startIndex, startIndex + CASES_PER_PAGE);

  // Summarize warning history
  const activeWarns = cases.filter(c => c.type === 'warn' && c.active).length;

  let description = `### Infraction History for **${userTag}** (<@${userId}>)\n`;
  description += `- Active Warnings: **${activeWarns}**\n`;
  description += `- Total Actions logged: **${totalCases}**\n\n`;

  if (paginatedCases.length === 0) {
    description += `*No infractions logged on this server.*`;
  } else {
    description += `**Recent Cases (Page ${currentPage}/${totalPages}):**\n`;
    
    const emojiMap = {
      warn: EMOJIS.WARNING_E,
      mute: EMOJIS.BLOCKED,
      kick: EMOJIS.CROSS,
      ban: EMOJIS.CROSS,
      unban: EMOJIS.CHECK,
      note: EMOJIS.BOOK
    };

    for (const c of paginatedCases) {
      const dateStr = `<t:${Math.floor(c.timestamp.getTime() / 1000)}:d>`;
      const emoji = emojiMap[c.type] || EMOJIS.FOLDER;
      
      description += `${emoji} **Case \`${c.caseId}\` — [${c.type.toUpperCase()}]**\n`;
      description += `- **Reason:** ${c.reason}\n`;
      description += `- **Moderator:** <@${c.moderatorId}> (${dateStr})\n`;
      if (c.duration) {
        const { formatDuration } = require('../../utils/time');
        description += `- **Duration:** ${formatDuration(c.duration)}\n`;
      }
      description += `\n`;
    }
  }

  const container = flowEmbed(
    `Infractions Tracker`,
    description,
    [],
    totalCases > 0 ? COLORS.WARNING : COLORS.SUCCESS
  );

  const row = paginationRow(
    `mod_page_prev_${userId}_${currentPage}`,
    `mod_page_next_${userId}_${currentPage}`,
    currentPage,
    totalPages
  );

  return { container, row, hasPagination: totalPages > 1 };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('Retrieve all past infractions and active warnings for a user.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to lookup')
        .setRequired(true)
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const targetUser = interaction.options.getUser('user');

    // ── Staff Check ────────────────────────────────────────────────────────
    let guildConfig = interaction.client.cache.get(guild.id);
    if (!guildConfig) {
      guildConfig = await Guild.findOne({ guildId: guild.id }).lean();
    }

    if (!hasStaffRole(interaction.member, guildConfig)) {
      const err = errorEmbed('Permission Denied', 'You do not have the required staff roles to use this command.');
      return await interaction.reply({ components: [err], flags: MessageFlags.IsComponentsV2 | 64 });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const { container, row, hasPagination } = await buildHistoryEmbed(guild, targetUser.id, targetUser.tag, 1);
      
      const components = hasPagination ? [container, row] : [container];

      await interaction.editReply({
        components,
        flags: MessageFlags.IsComponentsV2 | 64
      });
    } catch (err) {
      Logger.error(`history command error: ${err.message}`);
      const errContainer = errorEmbed('Lookup Failed', `Could not fetch infraction history: ${err.message}`);
      await interaction.editReply({ components: [errContainer] });
    }
  },

  /**
   * Handle pagination button clicks
   */
  async handlePagination(interaction) {
    const customId = interaction.customId; // mod_page_prev_userId_page or mod_page_next_userId_page
    const parts = customId.split('_');
    const direction = parts[2]; // prev or next
    const userId = parts[3];
    const currentPage = parseInt(parts[4], 10);

    const guild = interaction.guild;

    // Check staff permissions again
    let guildConfig = interaction.client.cache.get(guild.id);
    if (!guildConfig) {
      guildConfig = await Guild.findOne({ guildId: guild.id }).lean();
    }

    const { hasStaffRole: checkStaff } = require('../../utils/permissions');
    if (!checkStaff(interaction.member, guildConfig)) {
      return await interaction.reply({
        components: [errorEmbed('Permission Denied', 'You cannot paginate history.')],
        flags: MessageFlags.IsComponentsV2 | 64
      });
    }

    await interaction.deferUpdate();

    try {
      const targetUser = await interaction.client.users.fetch(userId);
      const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;

      const { container, row, hasPagination } = await buildHistoryEmbed(guild, userId, targetUser.tag, newPage);
      const components = hasPagination ? [container, row] : [container];

      await interaction.editReply({
        components
      });
    } catch (err) {
      Logger.error(`history pagination error: ${err.message}`);
    }
  }
};
