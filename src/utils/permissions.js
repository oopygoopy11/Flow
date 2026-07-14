'use strict';

/**
 * Check if member has admin permissions or is configured as an admin in guild config
 * @param {GuildMember} member 
 * @param {object} guildConfig 
 * @returns {boolean}
 */
function hasAdminRole(member, guildConfig) {
  if (!member || !guildConfig) return false;
  
  // Discord administrator permission is an automatic bypass
  if (member.permissions.has('Administrator')) return true;
  
  // Guild owner bypass
  if (member.guild.ownerId === member.id) return true;

  if (guildConfig.roles && Array.isArray(guildConfig.roles.admin)) {
    return member.roles.cache.some(role => guildConfig.roles.admin.includes(role.id));
  }
  
  return false;
}

/**
 * Check if member is staff (admin or staff role)
 * @param {GuildMember} member 
 * @param {object} guildConfig 
 * @returns {boolean}
 */
function hasStaffRole(member, guildConfig) {
  if (!member || !guildConfig) return false;
  if (hasAdminRole(member, guildConfig)) return true;

  if (guildConfig.roles && Array.isArray(guildConfig.roles.staff)) {
    return member.roles.cache.some(role => guildConfig.roles.staff.includes(role.id));
  }

  return false;
}

/**
 * Check if member has a specific department role
 * @param {GuildMember} member 
 * @param {object} guildConfig 
 * @param {string} dept - 'leo' | 'ems' | 'fire' | 'civ'
 * @returns {boolean}
 */
function hasDepartmentRole(member, guildConfig, dept) {
  if (!member || !guildConfig || !dept) return false;
  
  const roles = guildConfig.roles ? guildConfig.roles[dept] : null;
  if (roles && Array.isArray(roles)) {
    return member.roles.cache.some(role => roles.includes(role.id));
  }
  
  return false;
}

/**
 * Check if guild is configured with essential fields
 * @param {object} guildConfig 
 * @returns {object} { configured: boolean, missing: string[] }
 */
function isConfigured(guildConfig) {
  const missing = [];
  if (!guildConfig) {
    return { configured: false, missing: ['No database record found. Initialize using `/setup core`'] };
  }
  if (!guildConfig.erlcApiKey) missing.push('ER:LC API Key');
  if (!guildConfig.erlcServerId) missing.push('ER:LC Server ID');
  
  return {
    configured: missing.length === 0,
    missing
  };
}

/**
 * Check if the bot can moderate the target member (higher in role hierarchy)
 * @param {Guild} guild 
 * @param {GuildMember} target 
 * @returns {boolean}
 */
function botCanModerate(guild, target) {
  if (!guild || !target) return false;
  const botMember = guild.members.me;
  if (!botMember) return false;
  
  // Bot cannot moderate guild owner
  if (guild.ownerId === target.id) return false;
  
  // Bot role hierarchy check
  return botMember.roles.highest.position > target.roles.highest.position;
}

module.exports = {
  hasAdminRole,
  hasStaffRole,
  hasDepartmentRole,
  isConfigured,
  botCanModerate
};
