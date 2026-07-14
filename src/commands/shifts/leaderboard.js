'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const Guild = require('../../database/models/Guild');
const LeaderboardManager = require('../../modules/shifts/LeaderboardManager');
const { hasStaffRole } = require('../../utils/permissions');
const { errorEmbed } = require('../../utils/embeds');
const Logger = require('../../core/Logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Display the top staff activity logs leaderboard.')
    .addStringOption(option =>
      option.setName('period')
        .setDescription('Aggregating duration range')
        .setRequired(true)
        .addChoices(
          { name: 'Current Week', value: 'week' },
          { name: 'Current Month', value: 'month' },
          { name: 'All-Time Activity', value: 'alltime' }
        )
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const period = interaction.options.getString('period');

    // ── Staff Check ────────────────────────────────────────────────────────
    let guildConfig = interaction.client.cache.get(guild.id);
    if (!guildConfig) {
      guildConfig = await Guild.findOne({ guildId: guild.id }).lean();
    }

    if (!hasStaffRole(interaction.member, guildConfig)) {
      const err = errorEmbed('Permission Denied', 'You do not have the required staff roles to access activity leaderboards.');
      return await interaction.reply({ components: [err], flags: MessageFlags.IsComponentsV2 | 64 });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const leaderboardData = await LeaderboardManager.getLeaderboard(guild.id, period);

      const embed = LeaderboardManager.buildLeaderboardEmbed(guild, leaderboardData, period);

      await interaction.editReply({
        components: [embed]
      });
    } catch (err) {
      Logger.error(`leaderboard command error: ${err.message}`);
      await interaction.editReply({
        components: [errorEmbed('Leaderboard Fetch Failed', err.message)]
      });
    }
  }
};
