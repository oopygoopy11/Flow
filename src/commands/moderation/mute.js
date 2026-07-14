'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const CaseManager = require('../../modules/moderation/CaseManager');
const Guild = require('../../database/models/Guild');
const { hasStaffRole, botCanModerate } = require('../../utils/permissions');
const { parseTimeString, formatDuration } = require('../../utils/time');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout/mute a member, restricting typing and voice channel activity.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to mute')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('Duration of mute (e.g. 10m, 1h, 12h, 7d)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the mute')
        .setRequired(false)
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const targetUser = interaction.options.getUser('user');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // ── Staff Check ────────────────────────────────────────────────────────
    let guildConfig = interaction.client.cache.get(guild.id);
    if (!guildConfig) {
      guildConfig = await Guild.findOne({ guildId: guild.id }).lean();
    }

    if (!hasStaffRole(interaction.member, guildConfig)) {
      const err = errorEmbed('Permission Denied', 'You do not have the required staff roles to use this command.');
      return await interaction.reply({ components: [err], flags: MessageFlags.IsComponentsV2 | 64 });
    }

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      const err = errorEmbed('User Not Found', 'This user is not present in the Discord server.');
      return await interaction.reply({ components: [err], flags: MessageFlags.IsComponentsV2 | 64 });
    }

    // Role Hierarchy Checks
    if (!botCanModerate(guild, targetMember)) {
      const err = errorEmbed('Cannot Moderate', 'The bot cannot mute this user because they have higher/equal roles.');
      return await interaction.reply({ components: [err], flags: MessageFlags.IsComponentsV2 | 64 });
    }

    // Parse duration
    const durationMs = parseTimeString(durationStr);
    if (!durationMs || durationMs < 10000 || durationMs > 28 * 24 * 60 * 60 * 1000) { // Discord maximum timeout is 28 days
      const err = errorEmbed('Invalid Duration', 'Please enter a valid duration between `10s` and `28d` (e.g., `10m`, `1h`, `7d`).');
      return await interaction.reply({ components: [err], flags: MessageFlags.IsComponentsV2 | 64 });
    }

    try {
      // Execute Timeout
      await targetMember.timeout(durationMs, `${interaction.user.tag}: ${reason}`);

      // Log moderation case
      const caseDoc = await CaseManager.create(guild, {
        userId: targetUser.id,
        userTag: targetUser.tag,
        moderator: interaction.member,
        type: 'mute',
        reason,
        duration: durationMs
      });

      const success = successEmbed(
        'User Muted',
        `Successfully muted <@${targetUser.id}> (\`${targetUser.tag}\`) for **${formatDuration(durationMs)}**.\n\n**Case ID:** \`${caseDoc.caseId}\`\n**Reason:** ${reason}`
      );

      await interaction.reply({
        components: [success],
        flags: MessageFlags.IsComponentsV2 | 64
      });
    } catch (err) {
      const error = errorEmbed('Mute Failed', `Failed to apply timeout: ${err.message}`);
      await interaction.reply({ components: [error], flags: MessageFlags.IsComponentsV2 | 64 });
    }
  }
};
