'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Guild = require('../../database/models/Guild');
const ERLCApiClient = require('../../modules/erlc/ERLCApiClient');
const { flowEmbed, errorEmbed, successEmbed } = require('../../utils/embeds');
const { isConfigured } = require('../../utils/permissions');
const { COLORS } = require('../../config');
const Logger = require('../../core/Logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Display the current status of the ER:LC Private Server.')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View a one-time snapshot of the game server status.')
    )
    .addSubcommand(sub =>
      sub.setName('setup-persistent')
        .setDescription('Post an auto-updating status embed in the current channel.')
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const subcommand = interaction.options.getSubcommand();

    // Check configuration
    let guildConfig = interaction.client.cache.get(guild.id);
    if (!guildConfig) {
      guildConfig = await Guild.findOne({ guildId: guild.id }).lean();
    }

    const { configured, missing } = isConfigured(guildConfig);
    if (!configured) {
      const err = errorEmbed('Server Not Configured', `Please finish `/setup core` first. Missing configurations:\n- ${missing.join('\n- ')}`);
      return await interaction.reply({ components: [err], flags: MessageFlags.IsComponentsV2 | 64 });
    }

    await interaction.deferReply({ ephemeral: subcommand === 'view' });

    try {
      const apiKey = guildConfig.erlcApiKey;
      const serverInfo = await ERLCApiClient.getServer(apiKey);
      const players = await ERLCApiClient.getPlayers(apiKey) || [];
      const queue = await ERLCApiClient.getQueue(apiKey) || [];

      const inGameStaff = players.filter(p => p.Permission !== 'Normal');
      const staffList = inGameStaff.map(p => `• **${p.Player.split(':')[0]}** (${p.Permission})`).join('\n') || '*No staff in-game*';

      const fields = [
        { key: 'Server Name', value: serverInfo.Name },
        { key: 'Server Join Key', value: `\`${serverInfo.JoinKey}\`` },
        { key: 'Players Online', value: `**${serverInfo.CurrentPlayers}** / **${serverInfo.MaxPlayers}**` },
        { key: 'Queue Size', value: `**${queue.length}**` },
        { key: 'Lock Status', value: serverInfo.AccVerifiedReq === 'Disabled' ? 'Unlocked' : 'Locked' },
        { key: 'Active In-Game Staff', value: staffList }
      ];

      const container = flowEmbed(
        'Server Snapshot Status',
        'Current status of the connected ER:LC private server.',
        fields,
        COLORS.ACCENT
      );

      if (subcommand === 'view') {
        // Send a temporary snapshot
        await interaction.editReply({
          components: [container]
        });
      } else {
        // Setup persistent auto-updating status embed
        const channel = interaction.channel;
        
        // Post status message
        const statusMsg = await channel.send({
          components: [container],
          flags: MessageFlags.IsComponentsV2
        });

        // Save persistent message credentials to DB
        let guildDoc = await Guild.findOne({ guildId: guild.id });
        guildDoc.statusMessage = {
          channelId: channel.id,
          messageId: statusMsg.id
        };
        await guildDoc.save();
        interaction.client.cache.set(guild.id, guildDoc.toObject());

        const success = successEmbed(
          'Persistent Status Configured',
          `Successfully posted the persistent status board. It will automatically refresh every 60 seconds in this channel.`
        );

        await interaction.editReply({
          components: [success]
        });
      }
    } catch (err) {
      Logger.error(`status command error: ${err.message}`);
      const errContainer = errorEmbed('API Fetch Failed', `Failed to retrieve server details: ${err.message}`);
      await interaction.editReply({ components: [errContainer] });
    }
  }
};
