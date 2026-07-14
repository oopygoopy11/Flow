'use strict';

const cron = require('node-cron');
const Shift = require('../../database/models/Shift');
const Guild = require('../../database/models/Guild');
const Logger = require('../../core/Logger');
const { flowEmbed } = require('../../utils/embeds');
const { EMOJIS, COLORS } = require('../../config');
const { formatDuration } = require('../../utils/time');
const { MessageFlags } = require('discord.js');

class LeaderboardManager {
  /**
   * Get active shift stats leaderboard
   * @param {string} guildId 
   * @param {'week' | 'month' | 'alltime'} period 
   */
  static async getLeaderboard(guildId, period) {
    let startDate = new Date(0); // Epoch start for all-time
    const now = new Date();

    if (period === 'week') {
      // Calculate start of current week (Monday)
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    try {
      const results = await Shift.getLeaderboard(guildId, startDate);
      
      const leaderboard = [];
      let rank = 1;
      for (const res of results) {
        leaderboard.push({
          userId: res._id,
          totalDurationMs: res.totalDuration,
          shiftCount: res.shiftCount,
          rank: rank++
        });
      }

      return leaderboard;
    } catch (err) {
      Logger.error(`LeaderboardManager.getLeaderboard error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Compile leaderboard stats into Components v2 embed representation
   */
  static buildLeaderboardEmbed(guild, data, period) {
    let description = `### Top Staff Activity — **${period.toUpperCase()}**\n\n`;

    if (data.length === 0) {
      description += '*No active staff shifts logged for this period.*';
    } else {
      const trophyEmojis = ['🥇', '🥈', '🥉'];
      
      data.forEach((entry, idx) => {
        const prefix = idx < 3 ? trophyEmojis[idx] : `\`#${entry.rank}\``;
        description += `${prefix} <@${entry.userId}> — **${formatDuration(entry.totalDurationMs)}** logged (**${entry.shiftCount}** patrol shifts)\n`;
      });
    }

    return flowEmbed(
      `Staff Activity Leaderboard`,
      description,
      [],
      COLORS.CROWN
    );
  }

  /**
   * Schedule automatic weekly reset and post to channels
   */
  static scheduleWeeklyReset(client) {
    // Every Monday at 00:00 (UTC)
    cron.schedule('0 0 * * 1', async () => {
      Logger.info('Executing automatic weekly staff leaderboard logs reset and exports...');

      try {
        const guilds = await Guild.find({ setupComplete: true, 'channels.shiftLog': { $ne: null } }).exec();
        for (const guildDoc of guilds) {
          const guild = client.guilds.cache.get(guildDoc.guildId);
          if (!guild) continue;

          const data = await this.getLeaderboard(guild.id, 'week').catch(() => []);
          const logChannel = await guild.channels.fetch(guildDoc.channels.shiftLog).catch(() => null);

          if (logChannel) {
            const embed = this.buildLeaderboardEmbed(guild, data, 'week');
            
            // Append header alert
            embed.addTextDisplayComponents(
              new (require('discord.js').TextDisplayBuilder)().setContent(`\n**Weekly Reset Notice:** Leaderboard archived. Activity cycles reset.`)
            );

            await logChannel.send({
              components: [embed],
              flags: MessageFlags.IsComponentsV2
            }).catch(() => null);
          }
        }
      } catch (err) {
        Logger.error(`LeaderboardManager weekly reset cron failed: ${err.message}`);
      }
    });
  }
}

module.exports = LeaderboardManager;
