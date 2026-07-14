'use strict';

const mongoose = require('mongoose');

const LinkedAccountSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true, index: true },
  robloxId: { type: Number, required: true, index: true },
  robloxUsername: { type: String, required: true },
  verificationCode: { type: String },
  verified: { type: Boolean, default: false },
  verifiedAt: { type: Date },
  updatedAt: { type: Date, default: Date.now }
});

LinkedAccountSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('LinkedAccount', LinkedAccountSchema);
