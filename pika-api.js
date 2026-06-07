/**
 * Pika API Helper Module
 *
 * Usage:
 *   const pika = require('./pika-api.js');
 *   const result = await pika.call('skill:List');
 *   console.log(result);
 *
 * Environment: Set PIKA_MCP_TOKEN before using
 */

const https = require('https');

const API_HOST = 'api.pika.me';
const API_PATH = '/pika';

async function call(action, data = {}, method = 'POST') {
  const token = process.env.PIKA_MCP_TOKEN;

  if (!token) {
    throw new Error('PIKA_MCP_TOKEN environment variable is not set');
  }

  const payload = JSON.stringify({ action, ...data });

  const options = {
    hostname: API_HOST,
    path: API_PATH,
    method: method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': payload.length,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = { call };