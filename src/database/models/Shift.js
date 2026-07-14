'use strict';

const mongoose = require('mongoose');

const ShiftSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  guildId: { type: String, required: true, index: true },
  status: { 
    type: String, 
    enum: ['on_duty', 'on_break', 'off_duty'], 
    default: 'off_duty' 
  },
  startTime: { type: Date },
  endTime: { type: Date },
  breakStart: { type: Date },
  totalBreakMs: { type: Number, default: 0 },
  totalDurationMs: { type: Number, default: 0 }, // calculated on shift end: (endTime - startTime) - totalBreakMs
  createdAt: { type: Date, default: Date.now }
});

ShiftSchema.statics.getLeaderboard = function (guildId, startDate) {
  const match = {
    guildId,
    status: 'off_duty',
    endTime: { $gte: startDate }
  };

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$userId',
        totalDuration: { $sum: '$totalDurationMs' },
        shiftCount: { $sum: 1 }
      }
    },
    { $sort: { totalDuration: -1 } }
  ]).exec();
};

module.exports = mongoose.model('Shift', ShiftSchema);
