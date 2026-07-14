'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const CaseManager = require('../../modules/moderation/CaseManager');
const Guild = require('../../database/models/Guild');
const { hasStaffRole } = require('../../utils/permissions');
const { successEmbed, errorEmbed, v2Reply } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a formal warning to a server member.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to warn')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the warning')
        .setRequired(false)
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const targetUser = interaction.options.getUser('user');
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

    // Ignore bots
    if (targetUser.bot) {
      const err = errorEmbed('Invalid Action', 'You cannot warn bots.');
      return await interaction.reply({ components: [err], flags: MessageFlags.IsComponentsV2 | 64 });
    }

    // Create warning case
    const caseDoc = await CaseManager.create(guild, {
      userId: targetUser.id,
      userTag: targetUser.tag,
      moderator: interaction.member,
      type: 'warn',
      reason
    });

    const success = successEmbed(
      'Warning Issued',
      `Successfully warned <@${targetUser.id}> (\`${targetUser.tag}\`).\n\n**Case ID:** \`${caseDoc.caseId}\`\n**Reason:** ${reason}`
    );

    await interaction.reply({
      components: [success],
      flags: MessageFlags.IsComponentsV2 | 64 // Ephemeral confirmation
    });
  }
};
