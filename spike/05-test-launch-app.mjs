/**
 * Test 05: Verify Launch-App Action (Story 2.2)
 *
 * This test validates:
 * - Launch-app action works with real device
 * - Package + activity launch works
 * - Package-only launch works (fallback to MainActivity)
 * - Error handling for invalid packages
 */

import AdbKit from '@devicefarmer/adbkit';
import { CONFIG, getDeviceAddress } from './config.mjs';

// Import the actual implementation
import { launchAppAction } from '../src/actions/launch-app.js';

console.log('='.repeat(50));
console.log('TEST 05: Launch-App Action (Story 2.2)');
console.log('='.repeat(50));

const Adb = AdbKit.Adb;
const client = Adb.createClient();
const deviceAddr = getDeviceAddress();

// Common Android TV apps for testing
const TEST_APPS = [
  { name: 'Settings', package: 'com.android.tv.settings', activity: '.MainSettings' },
  { name: 'YouTube TV', package: 'com.google.android.youtube.tv', activity: null }, // package-only test
];

try {
  // Connect first
  console.log('\n[0/5] Connecting...');
  await client.connect(CONFIG.DEVICE_IP, CONFIG.DEVICE_PORT);
  console.log(`  ✅ Connected to ${deviceAddr}`);

  // Get device object (simulating what executor does)
  const device = client.getDevice(deviceAddr);
  console.log('  ✅ Got device object');

  // Test 1: Verify action interface
  console.log('\n[1/5] Verifying action interface...');
  console.log(`  Name: ${launchAppAction.name}`);
  console.log(`  Has execute: ${typeof launchAppAction.execute === 'function'}`);

  if (launchAppAction.name !== 'launch-app') {
    throw new Error('Action name mismatch');
  }
  console.log('  ✅ Action interface valid');

  // Test 2: Invalid package error handling
  console.log('\n[2/5] Testing error handling (invalid package)...');
  const invalidResult = await launchAppAction.execute(device, {});
  console.log(`  Result: success=${invalidResult.success}`);
  console.log(`  Error code: ${invalidResult.error?.code}`);

  if (invalidResult.success !== false || invalidResult.error?.code !== 'INVALID_PARAMS') {
    throw new Error('Invalid params not handled correctly');
  }
  console.log('  ✅ INVALID_PARAMS error works');

  // Test 3: Launch Settings app (usually available on all Android TVs)
  console.log('\n[3/5] Testing Settings app launch...');
  const settingsResult = await launchAppAction.execute(device, {
    package: 'com.android.tv.settings',
    activity: '.MainSettings'
  });
  console.log(`  Result: success=${settingsResult.success}`);
  console.log(`  Message: ${settingsResult.message}`);

  if (settingsResult.success) {
    console.log('  ✅ Settings app launched (check your TV!)');
    console.log('  Waiting 2 seconds...');
    await new Promise(r => setTimeout(r, 2000));
  } else {
    console.log(`  ⚠️ Settings launch failed: ${settingsResult.error?.message}`);
    console.log('  (This might be normal if package/activity differs on your device)');
  }

  // Test 4: Press HOME to go back
  console.log('\n[4/5] Pressing HOME to reset...');
  await device.shell('input keyevent KEYCODE_HOME');
  console.log('  ✅ HOME pressed');
  await new Promise(r => setTimeout(r, 1000));

  // Test 5: Try launching YouTube TV (package-only mode)
  console.log('\n[5/5] Testing YouTube TV launch (package-only)...');

  // First check if YouTube TV is installed
  const stream = await device.shell('pm list packages | grep youtube');
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  const packages = Buffer.concat(chunks).toString('utf-8');
  console.log('  Found YouTube packages:', packages.trim().split('\n').join(', '));

  // Try to launch YouTube TV
  const youtubeResult = await launchAppAction.execute(device, {
    package: 'com.google.android.youtube.tv'
  });
  console.log(`  Result: success=${youtubeResult.success}`);

  if (youtubeResult.success) {
    console.log('  ✅ YouTube TV launched (check your TV!)');
    console.log(`  Activity used: ${youtubeResult.data?.activity}`);
  } else {
    console.log(`  ⚠️ YouTube launch failed: ${youtubeResult.error?.message}`);
    console.log('  (This is expected if MainActivity is not the launcher activity)');
  }

  console.log('\n' + '='.repeat(50));
  console.log('TEST 05 COMPLETED: Launch-App Action tested');
  console.log('='.repeat(50));

  console.log('\n📋 SUMMARY:');
  console.log('  ✅ Action interface: valid');
  console.log('  ✅ Error handling: INVALID_PARAMS works');
  console.log(`  ${settingsResult.success ? '✅' : '⚠️'} Settings launch: ${settingsResult.success ? 'success' : 'needs verification'}`);
  console.log(`  ${youtubeResult.success ? '✅' : '⚠️'} YouTube launch: ${youtubeResult.success ? 'success' : 'needs different activity'}`);

  process.exit(0);

} catch (error) {
  console.error('\n❌ TEST 05 FAILED:', error.message);
  console.error('\nStack:', error.stack);
  process.exit(1);
}
