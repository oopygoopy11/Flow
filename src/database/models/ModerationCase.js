'use strict';

const mongoose = require('mongoose');

const ModerationCaseSchema = new mongoose.Schema({
  caseId: { type: String, required: true, unique: true, index: true },
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  userTag: { type: String },
  moderatorId: { type: String, required: true },
  moderatorTag: { type: String },
  type: { 
    type: String, 
    required: true, 
    enum: ['warn', 'mute', 'kick', 'ban', 'unban', 'note'] 
  },
  reason: { type: String, default: 'No reason provided' },
  duration: { type: Number }, // millisecond duration for mutes/tempbans
  active: { type: Boolean, default: true }, // active warnings/mutes
  timestamp: { type: Date, default: Date.now }
});

ModerationCaseSchema.statics.findByUser = function (guildId, userId) {
  return this.find({ guildId, userId }).sort({ timestamp: -1 }).exec();
};

module.exports = mongoose.model('ModerationCase', ModerationCaseSchema);
