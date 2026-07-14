'use strict';

const { 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionFlagsBits, 
  MessageFlags,
  ChannelType
} = require('discord.js');
const Ticket = require('../../database/models/Ticket');
const Guild = require('../../database/models/Guild');
const TranscriptGenerator = require('./TranscriptGenerator');
const Logger = require('../../core/Logger');
const { flowEmbed, successEmbed, errorEmbed } = require('../../utils/embeds');
const { EMOJIS, COLORS } = require('../../config');

class TicketManager {
  /**
   * Handle the Open Ticket button click: shows modal
   */
  static async handleOpenTicket(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('ticket_create_modal')
      .setTitle('Open Support Ticket');

    const subjectInput = new TextInputBuilder()
      .setCustomId('ticket_subject')
      .setLabel('Ticket Subject')
      .setPlaceholder('Brief summary of your issue')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const reasonInput = new TextInputBuilder()
      .setCustomId('ticket_reason')
      .setLabel('Describe your issue')
      .setPlaceholder('Provide details so staff can assist you')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(subjectInput),
      new ActionRowBuilder().addComponents(reasonInput)
    );

    await interaction.showModal(modal);
  }

  /**
   * Handle modal submission: creates private channel, records, and panel
   */
  static async handleCreateModal(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const user = interaction.user;
    const subject = interaction.fields.getTextInputValue('ticket_subject');
    const reason = interaction.fields.getTextInputValue('ticket_reason');

    try {
      // 1. Fetch guild config
      let guildDoc = interaction.client.cache.get(guild.id);
      if (!guildDoc) {
        guildDoc = await Guild.findOne({ guildId: guild.id });
      }

      if (!guildDoc || !guildDoc.channels || !guildDoc.channels.ticketCategory) {
        const err = errorEmbed('System Uninitialized', 'The ticket system has not been set up. Ask admins to run `/setup tickets`');
        return await interaction.editReply({ components: [err] });
      }

      // Check if user already has an active open ticket
      const existing = await Ticket.findOne({ guildId: guild.id, userId: user.id, status: 'open' });
      if (existing) {
        const err = errorEmbed('Ticket Already Open', `You already have an open ticket: <#${existing.channelId}>.`);
        return await interaction.editReply({ components: [err] });
      }

      // 2. Increment ticket count
      const ticketNum = guildDoc.ticketsConfig.nextTicketNumber || 1;
      await Guild.updateOne({ guildId: guild.id }, { $inc: { 'ticketsConfig.nextTicketNumber': 1 } });
      
      // Update cache count
      if (guildDoc.ticketsConfig) {
        guildDoc.ticketsConfig.nextTicketNumber = ticketNum + 1;
        interaction.client.cache.set(guild.id, guildDoc);
      }

      const paddedNum = String(ticketNum).padStart(4, '0');
      const channelName = `ticket-${paddedNum}`;

      // 3. Configure permissions
      const staffRoleIds = guildDoc.roles ? guildDoc.roles.staff : [];
      const overwrites = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles
          ]
        },
        {
          id: guild.members.me.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        }
      ];

      for (const roleId of staffRoleIds) {
        overwrites.push({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages
          ]
        });
      }

      // Create channel
      const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: guildDoc.channels.ticketCategory,
        permissionOverwrites: overwrites
      });

      // 4. Save ticket document
      const ticketDoc = new Ticket({
        ticketId: `TKT-${paddedNum}`,
        guildId: guild.id,
        channelId: ticketChannel.id,
        userId: user.id,
        userTag: user.tag,
        subject,
        number: ticketNum,
        status: 'open'
      });
      await ticketDoc.save();

      // 5. Send Control Panel in Channel
      const controlEmbed = flowEmbed(
        `Ticket #${paddedNum} — Support Panel`,
        `Welcome <@${user.id}>. A member of our staff team will assist you shortly.\n\n` +
        `**Subject:** ${subject}\n` +
        `**Reason:** ${reason}`,
        [
          { key: 'Status', value: 'Open 🟢' },
          { key: 'Opened By', value: `<@${user.id}>` }
        ]
      );

      const controlRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket_delete').setLabel('Delete').setStyle(ButtonStyle.Danger)
      );

      const controlMsg = await ticketChannel.send({
        components: [controlEmbed, controlRow],
        flags: MessageFlags.IsComponentsV2
      });

      await controlMsg.pin().catch(() => null);

      const success = successEmbed(
        'Ticket Created',
        `Your support ticket has been opened in ${ticketChannel}.`
      );

      await interaction.editReply({
        components: [success]
      });
    } catch (err) {
      Logger.error(`TicketManager.handleCreateModal error: ${err.message}`);
      const error = errorEmbed('Ticket Creation Failed', `Failed to create ticket channel: ${err.message}`);
      await interaction.editReply({ components: [error] });
    }
  }

  /**
   * Handle Close button: locks channel for typing
   */
  static async handleClose(interaction) {
    const channel = interaction.channel;
    
    try {
      const ticketDoc = await Ticket.findOne({ channelId: channel.id });
      if (!ticketDoc) return;

      if (ticketDoc.status === 'closed') {
        return await interaction.reply({
          content: 'This ticket is already closed.',
          ephemeral: true
        });
      }

      await interaction.deferReply();

      ticketDoc.status = 'closed';
      ticketDoc.closedAt = new Date();
      await ticketDoc.save();

      // Deny creator send permissions
      await channel.permissionOverwrites.edit(ticketDoc.userId, {
        SendMessages: false
      }).catch(() => null);

      // Edit control panel message
      await this.refreshControlEmbed(channel, ticketDoc);

      const closeAlert = flowEmbed(
        'Ticket Locked',
        `${EMOJIS.CHECK} Ticket closed by **${interaction.user.tag}**.`
      );

      await interaction.editReply({
        components: [closeAlert],
        flags: MessageFlags.IsComponentsV2
      });
    } catch (err) {
      Logger.error(`TicketManager.handleClose error: ${err.message}`);
    }
  }

  /**
   * Handle Reopen button: unlocks channel
   */
  static async handleReopen(interaction) {
    const channel = interaction.channel;

    try {
      const ticketDoc = await Ticket.findOne({ channelId: channel.id });
      if (!ticketDoc) return;

      if (ticketDoc.status === 'open') {
        return await interaction.reply({
          content: 'This ticket is already open.',
          ephemeral: true
        });
      }

      await interaction.deferReply();

      ticketDoc.status = 'open';
      ticketDoc.closedAt = null;
      await ticketDoc.save();

      // Restore creator permissions
      await channel.permissionOverwrites.edit(ticketDoc.userId, {
        SendMessages: true
      }).catch(() => null);

      // Edit control panel message
      await this.refreshControlEmbed(channel, ticketDoc);

      const reopenAlert = flowEmbed(
        'Ticket Reopened',
        `${EMOJIS.CHECK} Ticket reopened by **${interaction.user.tag}**.`
      );

      await interaction.editReply({
        components: [reopenAlert],
        flags: MessageFlags.IsComponentsV2
      });
    } catch (err) {
      Logger.error(`TicketManager.handleReopen error: ${err.message}`);
    }
  }

  /**
   * Handle Claim button: assigns ticket to moderator
   */
  static async handleClaim(interaction) {
    const channel = interaction.channel;
    const user = interaction.user;

    try {
      const ticketDoc = await Ticket.findOne({ channelId: channel.id });
      if (!ticketDoc) return;

      if (ticketDoc.claimedBy) {
        return await interaction.reply({
          content: `This ticket is already claimed by <@${ticketDoc.claimedBy}>.`,
          ephemeral: true
        });
      }

      await interaction.deferReply();

      ticketDoc.claimedBy = user.id;
      ticketDoc.claimedByTag = user.tag;
      await ticketDoc.save();

      // Rename channel to claimed style
      const firstName = user.username.split(/[._-]/)[0].toLowerCase();
      await channel.setName(`ticket-claimed-${firstName}`).catch(() => null);

      // Edit control panel message
      await this.refreshControlEmbed(channel, ticketDoc);

      // Alert ticket creator via DM
      try {
        const creator = await interaction.client.users.fetch(ticketDoc.userId);
        const dmEmbed = flowEmbed(
          'Ticket Claimed',
          `Your support ticket in **${interaction.guild.name}** has been claimed by staff member **${user.tag}**.`
        );
        await creator.send({ components: [dmEmbed], flags: MessageFlags.IsComponentsV2 });
      } catch {}

      const claimAlert = flowEmbed(
        'Ticket Claimed',
        `${EMOJIS.CHECK} Ticket claimed by **${user.tag}**.`
      );

      await interaction.editReply({
        components: [claimAlert],
        flags: MessageFlags.IsComponentsV2
      });
    } catch (err) {
      Logger.error(`TicketManager.handleClaim error: ${err.message}`);
    }
  }

  /**
   * Handle Delete button: compiles transcript, sends it, and deletes channel
   */
  static async handleDelete(interaction) {
    const channel = interaction.channel;
    const guild = interaction.guild;

    try {
      const ticketDoc = await Ticket.findOne({ channelId: channel.id });
      if (!ticketDoc) return;

      await interaction.reply({
        content: 'Generating transcript and deleting channel in 3 seconds...',
        ephemeral: true
      });

      // 1. Generate Transcript Buffer
      const transcriptBuffer = await TranscriptGenerator.generate(channel);

      // 2. Fetch guild transcripts channel
      let guildDoc = interaction.client.cache.get(guild.id);
      if (!guildDoc) {
        guildDoc = await Guild.findOne({ guildId: guild.id }).lean();
      }

      if (guildDoc && guildDoc.channels && guildDoc.channels.ticketTranscripts) {
        const transChannel = await guild.channels.fetch(guildDoc.channels.ticketTranscripts).catch(() => null);
        if (transChannel) {
          const paddedNum = String(ticketDoc.number).padStart(4, '0');
          
          const transcriptEmbed = flowEmbed(
            `Transcript: Ticket #${paddedNum}`,
            `Archived transcript log details.`,
            [
              { key: 'Ticket ID', value: `\`TKT-${paddedNum}\`` },
              { key: 'Opened By', value: `<@${ticketDoc.userId}> (\`${ticketDoc.userId}\`)` },
              { key: 'Claimed By', value: ticketDoc.claimedBy ? `<@${ticketDoc.claimedBy}>` : '*Unclaimed*' },
              { key: 'Closed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>` }
            ],
            COLORS.NEUTRAL
          );

          await transChannel.send({
            components: [transcriptEmbed],
            files: [{
              attachment: transcriptBuffer,
              name: `transcript-ticket-${paddedNum}.html`
            }],
            flags: MessageFlags.IsComponentsV2
          });
        }
      }

      // Update database status
      ticketDoc.status = 'deleted';
      await ticketDoc.save();

      // Delete channel
      setTimeout(() => {
        channel.delete().catch(() => null);
      }, 3000);
    } catch (err) {
      Logger.error(`TicketManager.handleDelete error: ${err.message}`);
    }
  }

  /**
   * Redraw the control panel message based on updated model status
   * @private
   */
  static async refreshControlEmbed(channel, ticketDoc) {
    try {
      const pinned = await channel.messages.fetchPinned().catch(() => null);
      if (!pinned) return;

      const controlMsg = pinned.find(m => m.components && m.components.length > 0);
      if (!controlMsg) return;

      const paddedNum = String(ticketDoc.number).padStart(4, '0');
      
      const statusLabel = ticketDoc.status === 'open' ? 'Open 🟢' : 'Closed 🔴';
      
      const controlEmbed = flowEmbed(
        `Ticket #${paddedNum} — Support Panel`,
        `Welcome <@${ticketDoc.userId}>. A member of our staff team will assist you shortly.\n\n` +
        `**Subject:** ${ticketDoc.subject}`,
        [
          { key: 'Status', value: statusLabel },
          { key: 'Opened By', value: `<@${ticketDoc.userId}>` },
          { key: 'Claimed By', value: ticketDoc.claimedBy ? `<@${ticketDoc.claimedBy}>` : '*None*' }
        ]
      );

      const controlRow = new ActionRowBuilder();

      if (ticketDoc.status === 'open') {
        controlRow.addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_claim')
            .setLabel('Claim')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!!ticketDoc.claimedBy),
          new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Close')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('ticket_delete')
            .setLabel('Delete')
            .setStyle(ButtonStyle.Danger)
        );
      } else {
        // Closed Status: swaps Close for Reopen
        controlRow.addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_reopen')
            .setLabel('Reopen')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('ticket_delete')
            .setLabel('Delete')
            .setStyle(ButtonStyle.Danger)
        );
      }

      await controlMsg.edit({
        components: [controlEmbed, controlRow],
        flags: MessageFlags.IsComponentsV2
      });
    } catch (err) {
      Logger.error(`refreshControlEmbed error: ${err.message}`);
    }
  }
}

module.exports = TicketManager;
