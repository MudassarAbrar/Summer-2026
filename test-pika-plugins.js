/**
 * Test script to verify Pika-Plugins skills are available
 *
 * Prerequisites:
 *   - Set PIKA_MCP_TOKEN environment variable
 *   - Have a working internet connection to api.pika.me
 */

const pika = require('./pika-api.js');

async function main() {
  console.log('🔍 Testing Pika-Plugins MCP integration...\n');

  try {
    // Test 1: List available skills
    console.log('Test 1: Listing available skills...');
    const list = await pika.call('skill:List');
    console.log('Skills response:', JSON.stringify(list, null, 2));
  } catch (err) {
    console.error('Error listing skills:', err.message);
  }

  // Test 2: Check explainer skill (simple text-to-speech demo)
  console.log('\nTest 2: Testing explainer skill...');
  try {
    const explained = await pika.call('explainer', { topic: 'Pika-MCP setup' });
    console.log('Explanation:', explained);
  } catch (err) {
    console.error('Error using explainer:', err.message);
  }
}

main();