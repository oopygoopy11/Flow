'use strict';

const Shift = require('../../database/models/Shift');
const Guild = require('../../database/models/Guild');
const Logger = require('../../core/Logger');
const { flowEmbed, successEmbed, errorEmbed } = require('../../utils/embeds');
const { EMOJIS, COLORS } = require('../../config');
const { formatDuration, formatRelativeTimestamp } = require('../../utils/time');
const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class ShiftManager {
  /**
   * Start a staff shift
   */
  static async startShift(userId, guildId) {
    const existing = await Shift.findOne({ userId, guildId, status: { $ne: 'off_duty' } });
    if (existing) {
      throw new Error('You already have an active shift. End it before starting a new one.');
    }

    const shift = new Shift({
      userId,
      guildId,
      status: 'on_duty',
      startTime: new Date(),
      totalBreakMs: 0,
      totalDurationMs: 0
    });

    await shift.save();
    return shift;
  }

  /**
   * Toggle break status on/off
   * @returns {Promise<{ shift: object, breakStarted: boolean }>}
   */
  static async toggleBreak(userId, guildId) {
    const shift = await Shift.findOne({ userId, guildId, status: { $ne: 'off_duty' } });
    if (!shift) {
      throw new Error('No active shift found. Start a shift first.');
    }

    let breakStarted = false;
    const now = new Date();

    if (shift.status === 'on_duty') {
      shift.status = 'on_break';
      shift.breakStart = now;
      breakStarted = true;
    } else if (shift.status === 'on_break') {
      shift.status = 'on_duty';
      const elapsed = now.getTime() - shift.breakStart.getTime();
      shift.totalBreakMs += elapsed;
      shift.breakStart = null;
      breakStarted = false;
    }

    await shift.save();
    return { shift, breakStarted };
  }

  /**
   * End a staff shift and calculate durations
   */
  static async endShift(userId, guildId) {
    const shift = await Shift.findOne({ userId, guildId, status: { $ne: 'off_duty' } });
    if (!shift) {
      throw new Error('No active shift found to end.');
    }

    const now = new Date();
    
    // If currently on break, finalize it
    if (shift.status === 'on_break') {
      const elapsed = now.getTime() - shift.breakStart.getTime();
      shift.totalBreakMs += elapsed;
      shift.breakStart = null;
    }

    const totalDuration = now.getTime() - shift.startTime.getTime() - shift.totalBreakMs;

    shift.status = 'off_duty';
    shift.endTime = now;
    shift.totalDurationMs = Math.max(0, totalDuration);
    await shift.save();

    return shift;
  }

  // ── BUTTON INTERACTION HANDLERS ──────────────────────────────────────────

  static async handleStart(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const shift = await this.startShift(interaction.user.id, interaction.guildId);
      
      const { panel, row } = this.buildShiftPanel(shift, interaction.user);
      
      // Update original message
      await interaction.message.edit({
        components: [panel, row],
        flags: MessageFlags.IsComponentsV2
      });

      const confirm = successEmbed('Shift Started', `You are now **On-Duty**.\n- Start Time: <t:${Math.floor(shift.startTime.getTime() / 1000)}:t>`);
      await interaction.editReply({ components: [confirm] });
    } catch (err) {
      await interaction.editReply({ components: [errorEmbed('Shift Start Failed', err.message)] });
    }
  }

  static async handleBreak(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const { shift, breakStarted } = await this.toggleBreak(interaction.user.id, interaction.guildId);
      
      const { panel, row } = this.buildShiftPanel(shift, interaction.user);
      
      await interaction.message.edit({
        components: [panel, row],
        flags: MessageFlags.IsComponentsV2
      });

      const text = breakStarted 
        ? 'You are now **On Break**. Shift clock paused.' 
        : 'You are now back **On-Duty**. Shift clock resumed.';

      const confirm = successEmbed(breakStarted ? 'Break Started' : 'Break Ended', text);
      await interaction.editReply({ components: [confirm] });
    } catch (err) {
      await interaction.editReply({ components: [errorEmbed('Break Action Failed', err.message)] });
    }
  }

  static async handleEnd(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const shift = await this.endShift(interaction.user.id, interaction.guildId);
      
      const { panel, row } = this.buildShiftPanel(shift, interaction.user);
      
      await interaction.message.edit({
        components: [panel, row],
        flags: MessageFlags.IsComponentsV2
      });

      // Post final stats to the logging channel if configured
      let guildDoc = interaction.client.cache.get(interaction.guildId);
      if (!guildDoc) {
        guildDoc = await Guild.findOne({ guildId: interaction.guildId }).lean();
      }

      if (guildDoc && guildDoc.channels && guildDoc.channels.shiftLog) {
        const logChannel = await interaction.guild.channels.fetch(guildDoc.channels.shiftLog).catch(() => null);
        if (logChannel) {
          const formattedDuration = formatDuration(shift.totalDurationMs);
          const logEmbed = flowEmbed(
            'Patrol Shift Ended',
            `Staff member clock-out details.`,
            [
              { key: 'Staff Member', value: `<@${shift.userId}> (\`${interaction.user.tag}\`)` },
              { key: 'Patrol Duration', value: `**${formattedDuration}**` },
              { key: 'Break Accumulation', value: `**${formatDuration(shift.totalBreakMs)}**` },
              { key: 'Shift Span', value: `<t:${Math.floor(shift.startTime.getTime() / 1000)}:t> — <t:${Math.floor(shift.endTime.getTime() / 1000)}:t>` }
            ],
            COLORS.NEUTRAL
          );

          await logChannel.send({
            components: [logEmbed],
            flags: MessageFlags.IsComponentsV2
          });
        }
      }

      const confirm = successEmbed(
        'Shift Logged', 
        `Successfully logged your patrol shift.\n- Total Active Time: **${formatDuration(shift.totalDurationMs)}**\n- Break Duration: **${formatDuration(shift.totalBreakMs)}**`
      );
      await interaction.editReply({ components: [confirm] });
    } catch (err) {
      await interaction.editReply({ components: [errorEmbed('Shift Clock-Out Failed', err.message)] });
    }
  }

  /**
   * Helper to build Components v2 shift panel representation
   */
  static buildShiftPanel(shift, user) {
    const isOffDuty = shift.status === 'off_duty';
    const isOnBreak = shift.status === 'on_break';
    const isOnDuty = shift.status === 'on_duty';

    let statusLabel = 'Off-Duty 🔴';
    let accent = COLORS.ERROR;
    
    if (isOnDuty) {
      statusLabel = 'On-Duty 🟢';
      accent = COLORS.SUCCESS;
    } else if (isOnBreak) {
      statusLabel = 'On Break 🟡';
      accent = COLORS.WARNING;
    }

    const fields = [
      { key: 'Staff Member', value: `<@${user.id}>` },
      { key: 'Shift Status', value: statusLabel }
    ];

    if (!isOffDuty) {
      fields.push(
        { key: 'Clocked In', value: `<t:${Math.floor(shift.startTime.getTime() / 1000)}:t> (${formatRelativeTimestamp(shift.startTime)})` },
        { key: 'Accumulated Break Time', value: formatDuration(shift.totalBreakMs) }
      );
    } else {
      fields.push(
        { key: 'Patrol Duration', value: `**${formatDuration(shift.totalDurationMs)}**` },
        { key: 'Break Accumulation', value: `**${formatDuration(shift.totalBreakMs)}**` },
        { key: 'Shift Span', value: `<t:${Math.floor(shift.startTime.getTime() / 1000)}:t> — <t:${Math.floor(shift.endTime.getTime() / 1000)}:t>` }
      );
    }

    const panel = flowEmbed(
      'Staff Duty Manager',
      'Manage your active patrol and service shift logs natively below.',
      fields,
      accent
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('shift_start')
        .setLabel('On-Duty')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!isOffDuty),
      new ButtonBuilder()
        .setCustomId('shift_break')
        .setLabel('Toggle Break')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(isOffDuty),
      new ButtonBuilder()
        .setCustomId('shift_end')
        .setLabel('Off-Duty')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(isOffDuty)
    );

    return { panel, row };
  }
}

module.exports = ShiftManager;
