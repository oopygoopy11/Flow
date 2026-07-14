'use strict';

const { MessageFlags } = require('discord.js');
const Logger = require('../core/Logger');
const { errorEmbed, v2Reply } = require('../utils/embeds');

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    // ── 1. SLASH COMMANDS ───────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        Logger.warn(`Slash command not found: ${interaction.commandName}`);
        return;
      }

      try {
        await command.execute(interaction, client);
      } catch (err) {
        Logger.error(`Error executing command ${interaction.commandName}: ${err.message}`);
        Logger.error(err.stack);
        
        const embed = errorEmbed('Command Error', `An error occurred while executing this command: ${err.message}`);
        
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ components: [embed], flags: MessageFlags.IsComponentsV2 | 64 });
          } else {
            await interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | 64 });
          }
        } catch (replyErr) {
          Logger.error(`Failed to send error reply: ${replyErr.message}`);
        }
      }
      return;
    }

    // ── 2. BUTTONS ─────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      const customId = interaction.customId;

      try {
        // Tickets System
        if (customId === 'ticket_open') {
          const TicketManager = require('../modules/tickets/TicketManager');
          await TicketManager.handleOpenTicket(interaction);
          return;
        }
        if (customId === 'ticket_close') {
          const TicketManager = require('../modules/tickets/TicketManager');
          await TicketManager.handleClose(interaction);
          return;
        }
        if (customId === 'ticket_reopen') {
          const TicketManager = require('../modules/tickets/TicketManager');
          await TicketManager.handleReopen(interaction);
          return;
        }
        if (customId === 'ticket_delete') {
          const TicketManager = require('../modules/tickets/TicketManager');
          await TicketManager.handleDelete(interaction);
          return;
        }
        if (customId === 'ticket_claim') {
          const TicketManager = require('../modules/tickets/TicketManager');
          await TicketManager.handleClaim(interaction);
          return;
        }

        // Shift Tracking System
        if (customId === 'shift_start') {
          const ShiftManager = require('../modules/shifts/ShiftManager');
          await ShiftManager.handleStart(interaction);
          return;
        }
        if (customId === 'shift_break') {
          const ShiftManager = require('../modules/shifts/ShiftManager');
          await ShiftManager.handleBreak(interaction);
          return;
        }
        if (customId === 'shift_end') {
          const ShiftManager = require('../modules/shifts/ShiftManager');
          await ShiftManager.handleEnd(interaction);
          return;
        }

        // Moderation Case History Pagination
        if (customId.startsWith('mod_page_')) {
          const HistoryCommand = require('../commands/moderation/history');
          await HistoryCommand.handlePagination(interaction);
          return;
        }
      } catch (err) {
        Logger.error(`Error processing button click (${customId}): ${err.message}`);
        const embed = errorEmbed('Interaction Error', `An error occurred: ${err.message}`);
        try {
          await interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | 64 });
        } catch {}
      }
      return;
    }

    // ── 3. MODALS ──────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      const customId = interaction.customId;

      try {
        if (customId === 'setup_core_modal') {
          const SetupWizard = require('../modules/setup/SetupWizard');
          await SetupWizard.handleCoreModal(interaction);
          return;
        }
        if (customId === 'ticket_create_modal') {
          const TicketManager = require('../modules/tickets/TicketManager');
          await TicketManager.handleCreateModal(interaction);
          return;
        }
      } catch (err) {
        Logger.error(`Error processing modal submission (${customId}): ${err.message}`);
        const embed = errorEmbed('Form Submission Error', `An error occurred: ${err.message}`);
        try {
          await interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | 64 });
        } catch {}
      }
      return;
    }

    // ── 4. SELECT MENUS (Role, Channel, String) ─────────────────────────────
    if (interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu() || interaction.isStringSelectMenu()) {
      const customId = interaction.customId;

      try {
        if (customId.startsWith('setup_role_')) {
          const SetupWizard = require('../modules/setup/SetupWizard');
          await SetupWizard.handleRolesSelect(interaction);
          return;
        }
        if (customId.startsWith('setup_channel_')) {
          const SetupWizard = require('../modules/setup/SetupWizard');
          await SetupWizard.handleChannelsSelect(interaction);
          return;
        }
      } catch (err) {
        Logger.error(`Error processing select menu (${customId}): ${err.message}`);
        const embed = errorEmbed('Selection Error', `An error occurred: ${err.message}`);
        try {
          await interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | 64 });
        } catch {}
      }
      return;
    }
  }
};
