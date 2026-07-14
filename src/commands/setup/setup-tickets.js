'use strict';

const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Guild = require('../../database/models/Guild');
const { flowEmbed, successEmbed, errorEmbed, v2Reply } = require('../../utils/embeds');
const { EMOJIS, COLORS } = require('../../config');
const Logger = require('../../core/Logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-tickets')
    .setDescription('Initialize the ticket system, creating categories, transcripts channel, and the panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(option =>
      option.setName('panel-channel')
        .setDescription('Channel where the ticket panel will be posted')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const panelChannel = interaction.options.getChannel('panel-channel');
    const guild = interaction.guild;

    try {
      // 1. Create Ticket Category (private to @everyone, visible to staff)
      let guildDoc = await Guild.findOne({ guildId: guild.id });
      if (!guildDoc) {
        guildDoc = new Guild({ guildId: guild.id });
      }

      // Collect staff roles to authorize on the category
      const staffRoleIds = guildDoc.roles ? guildDoc.roles.staff : [];
      
      const categoryPermissions = [
        {
          id: guild.roles.everyone.id,
          deny: ['ViewChannel']
        },
        {
          id: guild.members.me.id,
          allow: ['ViewChannel', 'SendMessages', 'ManageChannels', 'ManageMessages', 'ReadMessageHistory']
        }
      ];

      for (const roleId of staffRoleIds) {
        const role = guild.roles.cache.get(roleId);
        if (role) {
          categoryPermissions.push({
            id: roleId,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages']
          });
        }
      }

      const ticketCategory = await guild.channels.create({
        name: 'Tickets',
        type: ChannelType.GuildCategory,
        permissionOverwrites: categoryPermissions
      });

      // 2. Create Transcripts Channel inside Category
      const transcriptChannel = await guild.channels.create({
        name: 'ticket-transcripts',
        type: ChannelType.GuildText,
        parent: ticketCategory.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: ['ViewChannel', 'SendMessages']
          },
          ...staffRoleIds.map(roleId => ({
            id: roleId,
            allow: ['ViewChannel', 'ReadMessageHistory']
          }))
        ]
      });

      // 3. Save to database
      guildDoc.channels.ticketCategory = ticketCategory.id;
      guildDoc.channels.ticketTranscripts = transcriptChannel.id;
      guildDoc.ticketsConfig.panelChannelId = panelChannel.id;
      await guildDoc.save();

      // Update cache
      interaction.client.cache.set(guild.id, guildDoc.toObject());

      // 4. Send Panel to designated panel channel
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

      const panelMsg = await panelChannel.send({
        components: [panelEmbed, panelRow],
        flags: MessageFlags.IsComponentsV2
      });

      // Save panel message ID
      guildDoc.ticketsConfig.panelMessageId = panelMsg.id;
      await guildDoc.save();
      interaction.client.cache.set(guild.id, guildDoc.toObject());

      const successContainer = successEmbed(
        'Ticket System Initialized',
        `The ticket support lifecycle has been successfully configured.\n\n` +
        `- **Category:** ${ticketCategory} (\`${ticketCategory.id}\`)\n` +
        `- **Transcripts:** ${transcriptChannel} (\`${transcriptChannel.id}\`)\n` +
        `- **Panel Location:** ${panelChannel} (\`${panelChannel.id}\`)`
      );

      await v2EditReply(interaction, successContainer);
    } catch (err) {
      Logger.error(`setup-tickets error: ${err.message}`);
      const errContainer = errorEmbed('Ticket Setup Failed', `An error occurred: ${err.message}`);
      await v2EditReply(interaction, errContainer);
    }
  }
};
