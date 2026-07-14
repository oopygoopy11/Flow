'use strict';

const axios = require('axios');
const axiosRetry = require('axios-retry');
const Logger = require('../../core/Logger');
const { ERLC } = require('../../config');

class ERLCApiClient {
  /**
   * Get pre-configured Axios instance for a specific guild key
   * @private
   */
  static _getClient(apiKey) {
    const instance = axios.create({
      baseURL: ERLC.BASE_URL,
      headers: {
        'server-key': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: ERLC.TIMEOUT_MS
    });

    // Configure retry logic (retry 3 times on network errors or 5xx status codes)
    axiosRetry(instance, {
      retries: ERLC.MAX_RETRIES,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response && error.response.status >= 500);
      }
    });

    return instance;
  }

  /**
   * Handle API HTTP response errors uniformly
   */
  static _handleError(err, context) {
    if (err.response) {
      const status = err.response.status;
      if (status === 401 || status === 403) {
        throw new Error('INVALID_API_KEY');
      }
      if (status === 429) {
        throw new Error('RATE_LIMITED');
      }
      const apiCode = err.response.data && err.response.data.code;
      if (apiCode === 2002) {
        throw new Error('INVALID_API_KEY');
      }
      if (apiCode === 4001) {
        throw new Error('RATE_LIMITED');
      }
      throw new Error(`API error (${status}): ${err.response.data?.message || err.message}`);
    }
    Logger.error(`ER:LC API error in ${context}: ${err.message}`);
    throw new Error(`Connection failed: ${err.message}`);
  }

  /**
   * Test connection to the private server
   */
  static async testConnection(apiKey) {
    try {
      const client = this._getClient(apiKey);
      const res = await client.get('/server');
      return { success: true, data: res.data };
    } catch (err) {
      if (err.message === 'INVALID_API_KEY') {
        return { success: false, error: 'Invalid or expired ER:LC API Server Key' };
      }
      return { success: false, error: err.message };
    }
  }

  /**
   * Get general server status
   */
  static async getServer(apiKey) {
    try {
      const client = this._getClient(apiKey);
      const res = await client.get('/server');
      return res.data;
    } catch (err) {
      this._handleError(err, 'getServer');
    }
  }

  /**
   * Get active players list
   */
  static async getPlayers(apiKey) {
    try {
      const client = this._getClient(apiKey);
      const res = await client.get('/server/players');
      return res.data; // Array of Player objects
    } catch (err) {
      this._handleError(err, 'getPlayers');
    }
  }

  /**
   * Get active queue
   */
  static async getQueue(apiKey) {
    try {
      const client = this._getClient(apiKey);
      const res = await client.get('/server/queue');
      return res.data; // Array of Roblox IDs
    } catch (err) {
      this._handleError(err, 'getQueue');
    }
  }

  /**
   * Get server bans list
   */
  static async getBans(apiKey) {
    try {
      const client = this._getClient(apiKey);
      const res = await client.get('/server/bans');
      return res.data; // Array of Ban objects
    } catch (err) {
      this._handleError(err, 'getBans');
    }
  }

  /**
   * Execute an in-game command (e.g. :kick username reason, :m announcement)
   */
  static async executeCommand(apiKey, command) {
    try {
      const client = this._getClient(apiKey);
      const res = await client.post('/server/command', { command });
      return res.data;
    } catch (err) {
      this._handleError(err, 'executeCommand');
    }
  }

  // --- POLLING LOGS ENDPOINTS ---

  static async getKillLogs(apiKey) {
    try {
      const client = this._getClient(apiKey);
      const res = await client.get('/server/killlogs');
      return res.data; // Array of KillLog entries
    } catch (err) {
      this._handleError(err, 'getKillLogs');
    }
  }

  static async getJoinLogs(apiKey) {
    try {
      const client = this._getClient(apiKey);
      const res = await client.get('/server/joinlogs');
      return res.data; // Array of JoinLog entries
    } catch (err) {
      this._handleError(err, 'getJoinLogs');
    }
  }

  static async getCommandLogs(apiKey) {
    try {
      const client = this._getClient(apiKey);
      const res = await client.get('/server/commandlogs');
      return res.data; // Array of CommandLog entries
    } catch (err) {
      this._handleError(err, 'getCommandLogs');
    }
  }
}

module.exports = ERLCApiClient;
