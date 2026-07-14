'use strict';

/**
 * Format milliseconds into a readable string (e.g. 2h 30m 15s)
 * @param {number} ms 
 * @returns {string}
 */
function formatDuration(ms) {
  if (ms < 0) ms = 0;
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}

/**
 * Format a Date to a Discord relative timestamp string (<t:unix:R>)
 * @param {Date} date 
 * @returns {string}
 */
function formatRelativeTimestamp(date) {
  const unix = Math.floor(date.getTime() / 1000);
  return `<t:${unix}:R>`;
}

/**
 * Format a Date to a Discord full timestamp string (<t:unix:F>)
 * @param {Date} date 
 * @returns {string}
 */
function formatFullTimestamp(date) {
  const unix = Math.floor(date.getTime() / 1000);
  return `<t:${unix}:F>`;
}

/**
 * Convert ms to float hours
 * @param {number} ms 
 * @returns {number}
 */
function msToHours(ms) {
  return parseFloat((ms / (1000 * 60 * 60)).toFixed(2));
}

/**
 * Parse time string (e.g. '10m', '1h', '2d') into milliseconds
 * @param {string} str 
 * @returns {number|null}
 */
function parseTimeString(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)([smhd])$/i);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

module.exports = {
  formatDuration,
  formatRelativeTimestamp,
  formatFullTimestamp,
  msToHours,
  parseTimeString
};
