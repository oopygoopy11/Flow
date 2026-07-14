'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const Guild = require('../../database/models/Guild');
const ERLCApiClient = require('../../modules/erlc/ERLCApiClient');
const CaseManager = require('../../modules/moderation/CaseManager');
const { hasStaffRole } = require('../../utils/permissions');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const Logger = require('../../core/Logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('game-unban')
    .setDescription('Unban a player from the in-game ER:LC server.')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Roblox username of the player to unban')
        .setRequired(true)
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const username = interaction.options.getString('username');

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
      const apiKey = guildConfig.erlcApiKey;
      
      // Execute unban in-game
      await ERLCApiClient.executeCommand(apiKey, `:unban ${username}`);

      // Create a moderation case record
      const caseDoc = await CaseManager.create(guild, {
        userId: 'RobloxPlayer',
        userTag: username,
        moderator: interaction.member,
        type: 'unban',
        reason: '[In-Game Unban] Ban revoked remotely'
      });

      const success = successEmbed(
        'Player Unbanned In-Game',
        `Successfully sent unban instruction to game server.\n\n- **Player:** \`${username}\`\n- **Case Ref:** \`${caseDoc.caseId}\``
      );

      await interaction.editReply({
        components: [success]
      });
    } catch (err) {
      Logger.error(`game-unban error: ${err.message}`);
      const errContainer = errorEmbed('In-Game Unban Failed', `Failed to execute command: ${err.message}`);
      await interaction.editReply({ components: [errContainer] });
    }
  }
};
