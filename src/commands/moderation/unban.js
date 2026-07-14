'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const CaseManager = require('../../modules/moderation/CaseManager');
const Guild = require('../../database/models/Guild');
const { hasStaffRole } = require('../../utils/permissions');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Revoke a user ban from the server.')
    .addStringOption(option =>
      option.setName('user-id')
        .setDescription('The Roblox/Discord ID of user to unban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for revoking the ban')
        .setRequired(false)
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const targetId = interaction.options.getString('user-id');
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

    try {
      // Execute Unban
      const unbannedUser = await guild.members.unban(targetId, `${interaction.user.tag}: ${reason}`);

      // Log moderation case
      const caseDoc = await CaseManager.create(guild, {
        userId: targetId,
        userTag: unbannedUser ? unbannedUser.tag : 'Unknown Tag',
        moderator: interaction.member,
        type: 'unban',
        reason
      });

      const success = successEmbed(
        'User Unbanned',
        `Successfully revoked ban for **${unbannedUser ? unbannedUser.tag : targetId}**.\n\n**Case ID:** \`${caseDoc.caseId}\`\n**Reason:** ${reason}`
      );

      await interaction.reply({
        components: [success],
        flags: MessageFlags.IsComponentsV2 | 64
      });
    } catch (err) {
      const error = errorEmbed('Unban Failed', `Failed to lift ban: ${err.message}. Make sure the user ID is correct and they are banned.`);
      await interaction.reply({ components: [error], flags: MessageFlags.IsComponentsV2 | 64 });
    }
  }
};
