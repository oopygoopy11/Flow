'use strict';

const mongoose = require('mongoose');
const Logger = require('../core/Logger');

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/flow';
  
  const options = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000
  };

  let retries = 3;
  while (retries > 0) {
    try {
      await mongoose.connect(uri, options);
      Logger.info('Connected successfully to MongoDB.');
      break;
    } catch (err) {
      retries--;
      Logger.error(`Database connection failed: ${err.message}. Retries remaining: ${retries}`);
      if (retries === 0) {
        Logger.error('Fatal: Could not connect to database.');
        process.exit(1);
      }
      // Wait 5 seconds before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Handle connection events
mongoose.connection.on('disconnected', () => {
  Logger.warn('Mongoose connection disconnected.');
});

mongoose.connection.on('error', (err) => {
  Logger.error(`Mongoose connection error: ${err.message}`);
});

module.exports = { connectDB };
