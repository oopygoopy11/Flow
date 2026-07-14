'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const Guild = require('../../database/models/Guild');
const { hasStaffRole } = require('../../utils/permissions');
const { successEmbed, errorEmbed, flowEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete a specified amount of messages from the channel.')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Number of messages to clear (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Filter messages to only delete from this user')
        .setRequired(false)
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const amount = interaction.options.getInteger('amount');
    const filterUser = interaction.options.getUser('user');

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
      // Fetch messages
      const messages = await interaction.channel.messages.fetch({ limit: amount });
      
      let toDelete = messages;
      if (filterUser) {
        toDelete = messages.filter(m => m.author.id === filterUser.id);
      }

      // Execute bulkDelete (filter messages older than 14 days)
      const now = Date.now();
      const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
      const validToDelete = toDelete.filter(m => m.createdTimestamp > fourteenDaysAgo);

      if (validToDelete.size === 0) {
        const err = errorEmbed('No Messages Deleted', 'No messages were found that were younger than 14 days to purge.');
        return await interaction.reply({ components: [err], flags: MessageFlags.IsComponentsV2 | 64 });
      }

      const deleted = await interaction.channel.bulkDelete(validToDelete, true);

      const success = flowEmbed(
        'Messages Purged',
        `Successfully deleted **${deleted.size}** messages${filterUser ? ` from <@${filterUser.id}>` : ''}.`
      );

      // Reply, then auto-delete alert message after 5 seconds
      await interaction.reply({
        components: [success],
        flags: MessageFlags.IsComponentsV2
      });

      setTimeout(() => interaction.deleteReply().catch(() => null), 5000);
    } catch (err) {
      const error = errorEmbed('Purge Failed', `An error occurred: ${err.message}`);
      await interaction.reply({ components: [error], flags: MessageFlags.IsComponentsV2 | 64 });
    }
  }
};
