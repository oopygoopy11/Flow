'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const CaseManager = require('../../modules/moderation/CaseManager');
const Guild = require('../../database/models/Guild');
const { hasStaffRole, botCanModerate } = require('../../utils/permissions');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to ban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('delete-messages')
        .setDescription('Number of days of messages to delete (0-7 days)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(7)
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete-messages') || 0;

    // ── Staff Check ────────────────────────────────────────────────────────
    let guildConfig = interaction.client.cache.get(guild.id);
    if (!guildConfig) {
      guildConfig = await Guild.findOne({ guildId: guild.id }).lean();
    }

    if (!hasStaffRole(interaction.member, guildConfig)) {
      const err = errorEmbed('Permission Denied', 'You do not have the required staff roles to use this command.');
      return await interaction.reply({ components: [err], flags: MessageFlags.IsComponentsV2 | 64 });
    }

    // Hierarchy Checks (only if target is in the server)
    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (targetMember && !botCanModerate(guild, targetMember)) {
      const err = errorEmbed('Cannot Moderate', 'The bot cannot ban this user because they have higher/equal roles.');
      return await interaction.reply({ components: [err], flags: MessageFlags.IsComponentsV2 | 64 });
    }

    try {
      // Execute Ban
      const deleteMessageSeconds = deleteDays * 24 * 60 * 60;
      await guild.members.ban(targetUser.id, {
        deleteMessageSeconds,
        reason: `${interaction.user.tag}: ${reason}`
      });

      // Log moderation case
      const caseDoc = await CaseManager.create(guild, {
        userId: targetUser.id,
        userTag: targetUser.tag,
        moderator: interaction.member,
        type: 'ban',
        reason
      });

      const success = successEmbed(
        'User Banned',
        `Successfully banned **${targetUser.tag}** (\`${targetUser.id}\`) from the server.\n\n**Case ID:** \`${caseDoc.caseId}\`\n**Reason:** ${reason}`
      );

      await interaction.reply({
        components: [success],
        flags: MessageFlags.IsComponentsV2 | 64
      });
    } catch (err) {
      const error = errorEmbed('Ban Failed', `Failed to ban user: ${err.message}`);
      await interaction.reply({ components: [error], flags: MessageFlags.IsComponentsV2 | 64 });
    }
  }
};
