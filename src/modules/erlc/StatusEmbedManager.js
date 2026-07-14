'use strict';

const cron = require('node-cron');
const Guild = require('../../database/models/Guild');
const ERLCApiClient = require('./ERLCApiClient');
const Logger = require('../../core/Logger');
const { flowEmbed, errorEmbed } = require('../../utils/embeds');
const { EMOJIS, COLORS } = require('../../config');
const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Store last processed log timestamps per guild to prevent duplicates
// format: { [guildId]: { kill: timestamp_secs, join: timestamp_secs, command: timestamp_secs } }
const lastLogTimestamps = new Map();

class StatusEmbedManager {
  /**
   * Start polling cron jobs for status messages (60s) and log feeds (15s)
   */
  static startCronJob(client) {
    Logger.info('Initializing ER:LC Status & Log polling loops...');

    // ── 1. Status Embed Updates (Every 60 seconds) ──────────────────────────
    cron.schedule('*/1 * * * *', async () => {
      try {
        const guilds = await Guild.find({ setupComplete: true, 'statusMessage.messageId': { $ne: null } }).exec();
        for (const guildDoc of guilds) {
          const guild = client.guilds.cache.get(guildDoc.guildId);
          if (guild) {
            await this.updateStatusEmbed(guild, guildDoc).catch(err => {
              Logger.debug(`Failed to update status for guild ${guildDoc.guildId}: ${err.message}`);
            });
          }
        }
      } catch (err) {
        Logger.error(`Error in Status Embed Cron: ${err.message}`);
      }
    });

    // ── 2. Log Feeds Polling (Every 15 seconds) ─────────────────────────────
    setInterval(async () => {
      try {
        const guilds = await Guild.find({ setupComplete: true }).exec();
        for (const guildDoc of guilds) {
          const guild = client.guilds.cache.get(guildDoc.guildId);
          if (guild) {
            await this.pollLogs(guild, guildDoc).catch(err => {
              Logger.debug(`Failed to poll logs for guild ${guildDoc.guildId}: ${err.message}`);
            });
          }
        }
      } catch (err) {
        Logger.error(`Error in Logs Polling Loop: ${err.message}`);
      }
    }, 15000);
  }

  /**
   * Fetch latest logs from ER:LC and emit updates to logging channels
   */
  static async pollLogs(guild, guildDoc) {
    const apiKey = guildDoc.erlcApiKey;
    if (!apiKey) return;

    // Initialize tracking for this guild if not present
    if (!lastLogTimestamps.has(guild.id)) {
      lastLogTimestamps.set(guild.id, {
        kill: Math.floor(Date.now() / 1000),
        join: Math.floor(Date.now() / 1000),
        command: Math.floor(Date.now() / 1000)
      });
      // Skip the first fetch to avoid dumping historical logs on bot boot
      return;
    }

    const timestamps = lastLogTimestamps.get(guild.id);

    // ── A. Join / Leave Logs ────────────────────────────────────────────────
    if (guildDoc.channels.joinLeave) {
      try {
        const joinLogs = await ERLCApiClient.getJoinLogs(apiKey);
        if (Array.isArray(joinLogs)) {
          const newJoins = joinLogs.filter(log => log.Timestamp > timestamps.join).sort((a, b) => a.Timestamp - b.Timestamp);
          
          if (newJoins.length > 0) {
            const channel = await guild.channels.fetch(guildDoc.channels.joinLeave).catch(() => null);
            if (channel) {
              for (const log of newJoins) {
                const [username, robloxId] = log.Player.split(':');
                const action = log.Join ? 'joined the game' : 'left the game';
                const color = log.Join ? COLORS.SUCCESS : COLORS.ERROR;
                const emoji = log.Join ? EMOJIS.CHECK : EMOJIS.CROSS;
                
                const embed = flowEmbed(
                  `Player ${log.Join ? 'Join' : 'Leave'}`,
                  `${emoji} **${username}** (ID: \`${robloxId}\`) ${action}.`,
                  [{ key: 'Time', value: `<t:${log.Timestamp}:R>` }],
                  color
                );
                await channel.send({ components: [embed], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
              }
            }
            timestamps.join = Math.max(...newJoins.map(l => l.Timestamp));
          }
        }
      } catch (err) {
        Logger.debug(`JoinLog poll failed: ${err.message}`);
      }
    }

    // ── B. Kill Logs ────────────────────────────────────────────────────────
    if (guildDoc.channels.killLog) {
      try {
        const killLogs = await ERLCApiClient.getKillLogs(apiKey);
        if (Array.isArray(killLogs)) {
          const newKills = killLogs.filter(log => log.Timestamp > timestamps.kill).sort((a, b) => a.Timestamp - b.Timestamp);

          if (newKills.length > 0) {
            const channel = await guild.channels.fetch(guildDoc.channels.killLog).catch(() => null);
            if (channel) {
              for (const log of newKills) {
                const [victimName] = log.Killed.split(':');
                const [killerName] = log.Killer.split(':');

                const embed = flowEmbed(
                  'PvP Elimination',
                  `${EMOJIS.BLOCKED} **${killerName}** eliminated **${victimName}**.`,
                  [{ key: 'Time', value: `<t:${log.Timestamp}:R>` }],
                  COLORS.ERROR
                );
                await channel.send({ components: [embed], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
              }
            }
            timestamps.kill = Math.max(...newKills.map(l => l.Timestamp));
          }
        }
      } catch (err) {
        Logger.debug(`KillLog poll failed: ${err.message}`);
      }
    }

    // ── C. In-Game Command Logs ─────────────────────────────────────────────
    if (guildDoc.channels.inGameCmd) {
      try {
        const commandLogs = await ERLCApiClient.getCommandLogs(apiKey);
        if (Array.isArray(commandLogs)) {
          const newCmds = commandLogs.filter(log => log.Timestamp > timestamps.command).sort((a, b) => a.Timestamp - b.Timestamp);

          if (newCmds.length > 0) {
            const channel = await guild.channels.fetch(guildDoc.channels.inGameCmd).catch(() => null);
            if (channel) {
              for (const log of newCmds) {
                const [modName] = log.Player.split(':');
                
                const embed = flowEmbed(
                  'In-Game Moderator Command',
                  `${EMOJIS.FIX} Moderator **${modName}** ran command:\n\`\`\`\n${log.Command}\n\`\`\``,
                  [{ key: 'Time', value: `<t:${log.Timestamp}:R>` }],
                  COLORS.INFO
                );
                await channel.send({ components: [embed], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
              }
            }
            timestamps.command = Math.max(...newCmds.map(l => l.Timestamp));
          }
        }
      } catch (err) {
        Logger.debug(`CommandLog poll failed: ${err.message}`);
      }
    }

    lastLogTimestamps.set(guild.id, timestamps);
  }

  /**
   * Regenerate and edit the guild status message
   */
  static async updateStatusEmbed(guild, guildDoc) {
    const apiKey = guildDoc.erlcApiKey;
    if (!apiKey) return;

    try {
      const serverInfo = await ERLCApiClient.getServer(apiKey);
      const players = await ERLCApiClient.getPlayers(apiKey) || [];
      const queue = await ERLCApiClient.getQueue(apiKey) || [];

      // Identify staff members in-game (Permission is not 'Normal')
      const inGameStaff = players.filter(p => p.Permission !== 'Normal');
      const staffList = inGameStaff.map(p => `• **${p.Player.split(':')[0]}** (${p.Permission})`).join('\n') || '*No staff in-game*';

      // Create details fields
      const fields = [
        { key: 'Server Name', value: serverInfo.Name },
        { key: 'Server Join Key', value: `\`${serverInfo.JoinKey}\`` },
        { key: 'Players', value: `**${serverInfo.CurrentPlayers}** / **${serverInfo.MaxPlayers}**` },
        { key: 'Queue Size', value: `**${queue.length}**` },
        { key: 'Lock Status', value: serverInfo.AccVerifiedReq === 'Disabled' ? `Unlocked ${EMOJIS.CHECK}` : `Locked ${EMOJIS.CROSS}` },
        { key: 'Active In-Game Staff', value: staffList },
        { key: 'Last Polled', value: `<t:${Math.floor(Date.now() / 1000)}:R>` }
      ];

      const container = flowEmbed(
        'Server Live Status',
        'Live connection stats with the Roblox Emergency Response: Liberty County server.',
        fields,
        COLORS.ACCENT
      );

      const channel = await guild.channels.fetch(guildDoc.statusMessage.channelId).catch(() => null);
      if (!channel) return;

      const message = await channel.messages.fetch(guildDoc.statusMessage.messageId).catch(() => null);
      if (!message) return;

      await message.edit({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    } catch (err) {
      Logger.error(`updateStatusEmbed error: ${err.message}`);
      
      const channel = await guild.channels.fetch(guildDoc.statusMessage.channelId).catch(() => null);
      if (channel) {
        const message = await channel.messages.fetch(guildDoc.statusMessage.messageId).catch(() => null);
        if (message) {
          const errContainer = errorEmbed(
            'Server Live Status — Unavailable',
            `Failed to communicate with the ER:LC API.\n\n**Error:** ${err.message}`
          );
          await message.edit({
            components: [errContainer],
            flags: MessageFlags.IsComponentsV2
          }).catch(() => null);
        }
      }
    }
  }
}

module.exports = StatusEmbedManager;
