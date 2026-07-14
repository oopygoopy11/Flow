'use strict';

const mongoose = require('mongoose');

/**
 * Generate a sequential, 0-padded case ID for a guild (e.g. CASE-00001, CASE-00002)
 * @param {string} guildId 
 * @returns {Promise<string>}
 */
async function generateCaseId(guildId) {
  const ModerationCase = mongoose.model('ModerationCase');
  
  // Find highest case number in the guild
  const lastCase = await ModerationCase.findOne({ guildId })
    .sort({ timestamp: -1 })
    .exec();

  let nextNum = 1;
  if (lastCase && lastCase.caseId) {
    const match = lastCase.caseId.match(/CASE-(\d+)/i);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  // Return zero-padded 5 digit case ID
  const paddedNum = String(nextNum).padStart(5, '0');
  return `CASE-${paddedNum}`;
}

/**
 * Parse Case ID string to number
 * @param {string} caseId 
 * @returns {number}
 */
function parseCaseId(caseId) {
  const match = caseId.match(/CASE-(\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}

module.exports = {
  generateCaseId,
  parseCaseId
};
