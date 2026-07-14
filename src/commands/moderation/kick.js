'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const CaseManager = require('../../modules/moderation/CaseManager');
const Guild = require('../../database/models/Guild');
const { hasStaffRole, botCanModerate } = require('../../utils/permissions');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the Discord server.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to kick')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the kick')
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

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      const err = errorEmbed('User Not Found', 'This user is not present in the Discord server.');
      return await interaction.reply({ components: [err], flags: MessageFlags.IsComponentsV2 | 64 });
    }

    // Hierarchy Checks
    if (!botCanModerate(guild, targetMember)) {
      const err = errorEmbed('Cannot Moderate', 'The bot cannot kick this user because they have higher/equal roles.');
      return await interaction.reply({ components: [err], flags: MessageFlags.IsComponentsV2 | 64 });
    }

    try {
      // Execute Kick
      await targetMember.kick(`${interaction.user.tag}: ${reason}`);

      // Log moderation case
      const caseDoc = await CaseManager.create(guild, {
        userId: targetUser.id,
        userTag: targetUser.tag,
        moderator: interaction.member,
        type: 'kick',
        reason
      });

      const success = successEmbed(
        'User Kicked',
        `Successfully kicked **${targetUser.tag}** (\`${targetUser.id}\`) from the server.\n\n**Case ID:** \`${caseDoc.caseId}\`\n**Reason:** ${reason}`
      );

      await interaction.reply({
        components: [success],
        flags: MessageFlags.IsComponentsV2 | 64
      });
    } catch (err) {
      const error = errorEmbed('Kick Failed', `Failed to kick member: ${err.message}`);
      await interaction.reply({ components: [error], flags: MessageFlags.IsComponentsV2 | 64 });
    }
  }
};
