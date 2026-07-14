'use strict';

const CaseManager = require('./CaseManager');
const Logger = require('../../core/Logger');
const { MessageFlags } = require('discord.js');

// Map to track user message timestamps for spam checking: key is `guildId:userId` -> array of timestamp numbers
const spamTracker = new Map();

class AutoMod {
  /**
   * Run enabled automod checks on an incoming message
   * @param {Message} message 
   * @param {object} guildConfig 
   * @param {Client} client 
   */
  static async check(message, guildConfig, client) {
    if (!guildConfig || !guildConfig.automod) return;

    const member = message.member;
    if (!member) return;

    // Bypass check: moderators/staff and administrators bypass automod
    const { hasStaffRole } = require('../../utils/permissions');
    if (hasStaffRole(member, guildConfig)) return;

    const content = message.content;
    const author = message.author;
    const guild = message.guild;

    // ── 1. ANTI-LINK CHECK ──────────────────────────────────────────────────
    if (guildConfig.automod.antiLink && guildConfig.automod.antiLink.enabled) {
      const linkRegex = /https?:\/\/[^\s]+/gi;
      if (linkRegex.test(content)) {
        // Check whitelist
        const isWhitelisted = guildConfig.automod.antiLink.whitelist.some(domain => {
          return content.toLowerCase().includes(domain.toLowerCase());
        });

        if (!isWhitelisted) {
          await this.handleViolation(
            message,
            client,
            'warn',
            '[AutoMod] Sent unauthorized link/URL.',
            'Links are not permitted in this server.'
          );
          return; // Stop further checks on deleted message
        }
      }
    }

    // ── 2. WORD BLACKLIST CHECK ─────────────────────────────────────────────
    if (guildConfig.automod.wordBlacklist && guildConfig.automod.wordBlacklist.enabled) {
      const blacklist = guildConfig.automod.wordBlacklist.words || [];
      const lowerContent = content.toLowerCase();
      
      const hasBlacklistedWord = blacklist.some(word => {
        // Match word boundaries to prevent false positives inside other words
        const regex = new RegExp(`\\b${this.escapeRegExp(word.toLowerCase())}\\b`, 'i');
        return regex.test(lowerContent);
      });

      if (hasBlacklistedWord) {
        await this.handleViolation(
          message,
          client,
          'warn',
          '[AutoMod] Used blacklisted phrase/word.',
          'Your message contained language prohibited on this server.'
        );
        return;
      }
    }

    // ── 3. ANTI-SPAM CHECK ──────────────────────────────────────────────────
    if (guildConfig.automod.antiSpam && guildConfig.automod.antiSpam.enabled) {
      const config = guildConfig.automod.antiSpam;
      const key = `${guild.id}:${author.id}`;
      const now = Date.now();

      let timestamps = spamTracker.get(key) || [];
      
      // Filter out messages older than the time window (default 5000ms)
      const windowStart = now - config.timeWindow;
      timestamps = timestamps.filter(t => t > windowStart);

      timestamps.push(now);
      spamTracker.set(key, timestamps);

      if (timestamps.length >= config.threshold) {
        // Clear tracker for this user so we don't mute them again instantly next message
        spamTracker.delete(key);

        // Timeout (mute) the member for 5 minutes
        const duration = 5 * 60 * 1000; // 5 mins in ms
        try {
          await member.timeout(duration, '[AutoMod] Message spamming threshold exceeded');
          
          await this.handleViolation(
            message,
            client,
            'mute',
            '[AutoMod] Chat spamming threshold exceeded.',
            'You have been muted for 5 minutes for chat spamming.',
            duration
          );
        } catch (err) {
          Logger.error(`AutoMod anti-spam timeout failed for ${author.id}: ${err.message}`);
        }
      }
    }
  }

  /**
   * Helper to delete message, log case, and notify violator
   */
  static async handleViolation(message, client, type, reason, userNotice, duration = null) {
    // Delete the message
    await message.delete().catch(() => null);

    try {
      // Create case
      await CaseManager.create(message.guild, {
        userId: message.author.id,
        userTag: message.author.tag,
        moderator: client.user,
        type,
        reason,
        duration
      });

      // Send alert to the channel, delete after 5 seconds to keep chat clean
      const alert = await message.channel.send({
        content: `${message.author}, ${userNotice}`
      });
      setTimeout(() => alert.delete().catch(() => null), 5000);
    } catch (err) {
      Logger.error(`AutoMod.handleViolation log error: ${err.message}`);
    }
  }

  static escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = AutoMod;
