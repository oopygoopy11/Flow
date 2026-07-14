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
    .setName('game-ban')
    .setDescription('Ban a player from the in-game ER:LC server.')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Roblox username of the player to ban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the in-game ban')
        .setRequired(false)
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const username = interaction.options.getString('username');
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

    await interaction.deferReply({ ephemeral: true });

    try {
      const apiKey = guildConfig.erlcApiKey;
      
      // Execute ban in-game
      await ERLCApiClient.executeCommand(apiKey, `:ban ${username} ${reason}`);

      // Create a moderation case record
      const caseDoc = await CaseManager.create(guild, {
        userId: 'RobloxPlayer',
        userTag: username,
        moderator: interaction.member,
        type: 'ban',
        reason: `[In-Game Ban] Reason: ${reason}`
      });

      const success = successEmbed(
        'Player Banned In-Game',
        `Successfully sent ban instruction to game server.\n\n- **Player:** \`${username}\`\n- **Reason:** ${reason}\n- **Case Ref:** \`${caseDoc.caseId}\``
      );

      await interaction.editReply({
        components: [success]
      });
    } catch (err) {
      Logger.error(`game-ban error: ${err.message}`);
      const errContainer = errorEmbed('In-Game Ban Failed', `Failed to execute command: ${err.message}`);
      await interaction.editReply({ components: [errContainer] });
    }
  }
};
