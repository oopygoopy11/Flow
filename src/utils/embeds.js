'use strict';

const { 
  ContainerBuilder, 
  TextDisplayBuilder, 
  SeparatorBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  SeparatorSpacingSize 
} = require('discord.js');
const { EMOJIS, COLORS } = require('../config');

// Flag value for Components v2 is 32768
const IS_COMPONENTS_V2_FLAG = 32768;

/**
 * Build standard reply flags (adding Ephemeral if requested)
 * @param {boolean} ephemeral 
 * @returns {number}
 */
function flagsFor(ephemeral = false) {
  return ephemeral ? (IS_COMPONENTS_V2_FLAG | 64) : IS_COMPONENTS_V2_FLAG; // 64 is Ephemeral flag
}

/**
 * Standard branded flow container
 * @param {string} title 
 * @param {string} description 
 * @param {Array<{key: string, value: string}>} fields 
 * @param {number} accentColor 
 * @returns {ContainerBuilder}
 */
function flowEmbed(title, description, fields = [], accentColor = COLORS.ACCENT) {
  const container = new ContainerBuilder().setAccentColor(accentColor);
  
  let headerText = `## ${EMOJIS.FLOW} **${title}**`;
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(headerText)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  if (description) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(description)
    );
  }

  if (fields.length > 0) {
    const fieldsText = fields.map(f => `-# ${EMOJIS.MENTION} **${f.key}** — ${f.value}`).join('\n');
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(fieldsText)
    );
  }

  return container;
}

function successEmbed(title, description, fields = []) {
  return flowEmbed(`${EMOJIS.CHECK} ${title}`, description, fields, COLORS.SUCCESS);
}

function errorEmbed(title, description) {
  return flowEmbed(`${EMOJIS.CROSS} ${title}`, description, [], COLORS.ERROR);
}

function warningEmbed(title, description) {
  return flowEmbed(`${EMOJIS.WARNING_E} ${title}`, description, [], COLORS.WARNING);
}

function infoEmbed(title, description, fields = []) {
  return flowEmbed(`${EMOJIS.STATS} ${title}`, description, fields, COLORS.INFO);
}

/**
 * Standard moderation case embed representation
 * @param {object} caseData 
 * @returns {ContainerBuilder}
 */
function caseEmbed(caseData) {
  const typesMap = {
    warn: { label: 'WARNING', color: COLORS.WARNING },
    mute: { label: 'MUTE', color: COLORS.WARNING }, // Mutes yellow/orange
    kick: { label: 'KICK', color: COLORS.ERROR },
    ban: { label: 'BAN', color: COLORS.ERROR },
    unban: { label: 'UNBAN', color: COLORS.SUCCESS },
    note: { label: 'NOTE', color: COLORS.INFO }
  };

  const currentType = typesMap[caseData.type] || { label: caseData.type.toUpperCase(), color: COLORS.NEUTRAL };
  
  const fields = [
    { key: 'Target User', value: `<@${caseData.userId}> (\`${caseData.userId}\`)` },
    { key: 'Moderator', value: `<@${caseData.moderatorId}>` },
    { key: 'Reason', value: caseData.reason }
  ];

  if (caseData.duration) {
    const { formatDuration } = require('./time');
    fields.push({ key: 'Duration', value: formatDuration(caseData.duration) });
  }

  fields.push({ key: 'Issued At', value: `<t:${Math.floor(caseData.timestamp.getTime() / 1000)}:F>` });

  return flowEmbed(`Case #${caseData.caseId} — [${currentType.label}]`, null, fields, currentType.color);
}

/**
 * Confirm/Cancel row builder
 * @param {string} confirmId 
 * @param {string} cancelId 
 * @returns {ActionRowBuilder}
 */
function confirmRow(confirmId, cancelId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(confirmId).setLabel('Confirm').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(cancelId).setLabel('Cancel').setStyle(ButtonStyle.Danger)
  );
}

/**
 * Pagination buttons row builder
 * @param {string} prevId 
 * @param {string} nextId 
 * @param {number} page 
 * @param {number} totalPages 
 * @returns {ActionRowBuilder}
 */
function paginationRow(prevId, nextId, page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(prevId)
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(nextId)
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages)
  );
}

async function v2Reply(interaction, container, ephemeral = false) {
  return await interaction.reply({
    components: [container],
    flags: flagsFor(ephemeral)
  });
}

async function v2EditReply(interaction, container) {
  return await interaction.editReply({
    components: [container]
  });
}

async function v2FollowUp(interaction, container, ephemeral = false) {
  return await interaction.followUp({
    components: [container],
    flags: flagsFor(ephemeral)
  });
}

module.exports = {
  flagsFor,
  flowEmbed,
  successEmbed,
  errorEmbed,
  warningEmbed,
  infoEmbed,
  caseEmbed,
  confirmRow,
  paginationRow,
  v2Reply,
  v2EditReply,
  v2FollowUp
};
