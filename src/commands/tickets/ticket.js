'use strict';

const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Guild = require('../../database/models/Guild');
const Ticket = require('../../database/models/Ticket');
const TicketManager = require('../../modules/tickets/TicketManager');
const { hasStaffRole } = require('../../utils/permissions');
const { flowEmbed, successEmbed, errorEmbed } = require('../../utils/embeds');
const { EMOJIS } = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Commands for managing the support ticket system.')
    .addSubcommandGroup(group =>
      group.setName('panel')
        .setDescription('Manage the ticket creation panel')
        .addSubcommand(sub =>
          sub.setName('create')
            .setDescription('Post the ticket panel embed in a text channel.')
            .addChannelOption(opt =>
              opt.setName('channel')
                .setDescription('The channel to send the panel to')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a user to the current ticket channel.')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('The user to add')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a user from the current ticket channel.')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('The user to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('close')
        .setDescription('Close the current support ticket.')
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    // ── Staff Check ────────────────────────────────────────────────────────
    let guildConfig = interaction.client.cache.get(guild.id);
    if (!guildConfig) {
      guildConfig = await Guild.findOne({ guildId: guild.id }).lean();
    }

    if (subcommandGroup === 'panel' && subcommand === 'create') {
      // Panel setup requires Admin/ManageGuild
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        const err = errorEmbed('Permission Denied', 'You need `Manage Server` permissions to run this command.');
        return await interaction.reply({ components: [err], flags: MessageFlags.IsComponentsV2 | 64 });
      }

      await interaction.deferReply({ ephemeral: true });

      const targetChannel = interaction.options.getChannel('channel');

      try {
        const panelEmbed = flowEmbed(
          'Support Tickets',
          'Need assistance? Click the button below to open a support ticket.\n\nOur staff team will assist you as soon as possible. Please do not ping staff members once your ticket is open.'
        );

        const panelRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_open')
            .setLabel('Open Ticket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(EMOJIS.TICKET_E)
        );

        const panelMsg = await targetChannel.send({
          components: [panelEmbed, panelRow],
          flags: MessageFlags.IsComponentsV2
        });

        // Save status
        let guildDoc = await Guild.findOne({ guildId: guild.id });
        if (!guildDoc) guildDoc = new Guild({ guildId: guild.id });
        
        guildDoc.ticketsConfig.panelChannelId = targetChannel.id;
        guildDoc.ticketsConfig.panelMessageId = panelMsg.id;
        await guildDoc.save();
        interaction.client.cache.set(guild.id, guildDoc.toObject());

        const success = successEmbed(
          'Panel Created',
          `Successfully posted the ticket opening panel in ${targetChannel}.`
        );

        await interaction.editReply({ components: [success] });
      } catch (err) {
        const error = errorEmbed('Panel Creation Failed', `Failed to send panel: ${err.message}`);
        await interaction.editReply({ components: [error] });
      }
      return;
    }

    // ── TICKET ACTIONS (ADD / REMOVE / CLOSE) ───────────────────────────────
    
    // Check if command is executed in a valid ticket channel
    const ticketDoc = await Ticket.findOne({ channelId: interaction.channelId });
    if (!ticketDoc || ticketDoc.status === 'deleted') {
      const err = errorEmbed('Invalid Channel', 'This command can only be executed within an active ticket channel.');
      return await interaction.reply({ components: [err], flags: MessageFlags.IsComponentsV2 | 64 });
    }

    // Must have staff role or be the ticket opener to close
    const isOpener = ticketDoc.userId === interaction.user.id;
    const isStaff = hasStaffRole(interaction.member, guildConfig);

    if (!isOpener && !isStaff) {
      const err = errorEmbed('Permission Denied', 'You do not have permission to manage this ticket.');
      return await interaction.reply({ components: [err], flags: MessageFlags.IsComponentsV2 | 64 });
    }

    if (subcommand === 'close') {
      await TicketManager.handleClose(interaction);
      return;
    }

    // Add / Remove requires Staff
    if (!isStaff) {
      const err = errorEmbed('Permission Denied', 'Only staff members can add or remove users from tickets.');
      return await interaction.reply({ components: [err], flags: MessageFlags.IsComponentsV2 | 64 });
    }

    const targetUser = interaction.options.getUser('user');

    if (subcommand === 'add') {
      await interaction.deferReply();
      try {
        await interaction.channel.permissionOverwrites.edit(targetUser.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });

        const success = successEmbed(
          'User Added',
          `Successfully added <@${targetUser.id}> (\`${targetUser.tag}\`) to the ticket channel.`
        );
        await interaction.editReply({ components: [success], flags: MessageFlags.IsComponentsV2 });
      } catch (err) {
        const error = errorEmbed('Action Failed', `Failed to add user: ${err.message}`);
        await interaction.editReply({ components: [error], flags: MessageFlags.IsComponentsV2 | 64 });
      }
    } else if (subcommand === 'remove') {
      await interaction.deferReply();
      try {
        await interaction.channel.permissionOverwrites.delete(targetUser.id);

        const success = successEmbed(
          'User Removed',
          `Successfully removed <@${targetUser.id}> from the ticket channel.`
        );
        await interaction.editReply({ components: [success], flags: MessageFlags.IsComponentsV2 });
      } catch (err) {
        const error = errorEmbed('Action Failed', `Failed to remove user: ${err.message}`);
        await interaction.editReply({ components: [error], flags: MessageFlags.IsComponentsV2 | 64 });
      }
    }
  }
};
