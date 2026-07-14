'use strict';

const { flowEmbed } = require('../../utils/embeds');
const { EMOJIS, COLORS } = require('../../config');
const Logger = require('../../core/Logger');
const { MessageFlags } = require('discord.js');

class WebhookParser {
  /**
   * Process and route incoming verified ER:LC webhook events
   */
  static async processWebhook(client, guildDoc, payload) {
    if (!guildDoc || !payload) return;

    try {
      const guild = client.guilds.cache.get(guildDoc.guildId);
      if (!guild) return;

      if (payload.type === 'command') {
        await this.handleCustomCommand(guild, guildDoc, payload);
      } else if (payload.type === 'emergency') {
        await this.handleEmergencyCall(guild, guildDoc, payload);
      }
    } catch (err) {
      Logger.error(`WebhookParser.processWebhook error: ${err.message}`);
    }
  }

  /**
   * Custom command triggers from in-game (prefixed with ;)
   */
  static async handleCustomCommand(guild, guildDoc, payload) {
    // Command logs route to inGameCmd channel
    const logChannelId = guildDoc.channels.inGameCmd;
    if (!logChannelId) return;

    const channel = await guild.channels.fetch(logChannelId).catch(() => null);
    if (!channel) return;

    const embed = flowEmbed(
      'In-Game Webhook Trigger',
      `${EMOJIS.FIX} User **${payload.executor.username}** (Roblox ID: \`${payload.executor.id}\`) triggered remote custom command:\n\`\`\`\n${payload.command}\n\`\`\``,
      [{ key: 'Time', value: `<t:${Math.floor(new Date(payload.timestamp).getTime() / 1000)}:R>` }],
      COLORS.INFO
    );

    await channel.send({
      components: [embed],
      flags: MessageFlags.IsComponentsV2
    });
  }

  /**
   * Emergency 911 dispatch calls from game
   */
  static async handleEmergencyCall(guild, guildDoc, payload) {
    // If there is an EMS/LEO channel or a designated dispatch channel, route it
    // For now, let's route to inGameCmd or modLog if configured
    const logChannelId = guildDoc.channels.modLog; 
    if (!logChannelId) return;

    const channel = await guild.channels.fetch(logChannelId).catch(() => null);
    if (!channel) return;

    const embed = flowEmbed(
      'Emergency Dispatch Call (911)',
      `${EMOJIS.BELL} In-game emergency call initiated!`,
      [
        { key: 'Caller Roblox ID', value: `\`${payload.caller}\`` },
        { key: 'Team', value: payload.team || 'Unknown' },
        { key: 'Description', value: payload.description || 'No description provided' },
        { key: 'Position', value: payload.position ? `\`X: ${payload.position[0]}, Y: ${payload.position[1]}\`` : 'Unknown' }
      ],
      COLORS.WARNING
    );

    await channel.send({
      components: [embed],
      flags: MessageFlags.IsComponentsV2
    });
  }
}

module.exports = WebhookParser;
