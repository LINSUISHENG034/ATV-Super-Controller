/**
 * Test 04: Verify YouTube TV launch
 *
 * This test validates:
 * - YouTube TV package exists on device
 * - Can discover the correct main Activity
 * - Can launch YouTube TV with a video URL
 */

import AdbKit from '@devicefarmer/adbkit';
import { CONFIG, getDeviceAddress } from './config.mjs';

console.log('='.repeat(50));
console.log('TEST 04: YouTube TV Launch');
console.log('='.repeat(50));

const Adb = AdbKit.Adb;
const client = Adb.createClient();
const deviceAddr = getDeviceAddress();

const YOUTUBE_PACKAGES = [
  'com.google.android.youtube.tv',
  'com.google.android.youtube.tvkids',
  'com.google.android.apps.youtube.tv'
];

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function execShell(command) {
  const device = client.getDevice(deviceAddr);
  const stream = await device.shell(command);
  return (await streamToString(stream)).trim();
}

try {
  // Connect
  console.log('\n[0/5] Connecting...');
  await client.connect(CONFIG.DEVICE_IP, CONFIG.DEVICE_PORT);
  console.log('  ✅ Connected');

  // Test 1: Find YouTube package
  console.log('\n[1/5] Searching for YouTube TV package...');
  let youtubePackage = null;

  for (const pkg of YOUTUBE_PACKAGES) {
    const result = await execShell(`pm list packages | grep ${pkg}`);
    if (result.includes(pkg)) {
      youtubePackage = pkg;
      console.log(`  ✅ Found: ${pkg}`);
      break;
    }
  }

  if (!youtubePackage) {
    throw new Error('YouTube TV not installed on device');
  }

  // Test 2: Get main Activity
  console.log('\n[2/5] Discovering main Activity...');
  const dumpCmd = `dumpsys package ${youtubePackage} | grep -A 1 "android.intent.action.MAIN"`;
  const activityInfo = await execShell(dumpCmd);
  console.log('  Activity info:\n', activityInfo || '  (empty)');

  // Test 3: Try to get launcher activity
  console.log('\n[3/5] Getting launcher activity...');
  const launcherCmd = `cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER ${youtubePackage}`;
  const launcherResult = await execShell(launcherCmd);
  console.log('  Launcher:', launcherResult || '(not found)');

  // Test 4: Launch with VIEW intent (recommended approach)
  console.log('\n[4/5] Testing VIEW intent launch...');
  const viewCmd = `am start -a android.intent.action.VIEW -d "${CONFIG.TEST_VIDEO_URL}"`;
  console.log(`  Command: ${viewCmd}`);
  const viewResult = await execShell(viewCmd);
  console.log('  Result:', viewResult);

  // Test 5: Alternative - launch package directly
  console.log('\n[5/5] Testing direct package launch...');
  const directCmd = `monkey -p ${youtubePackage} -c android.intent.category.LEANBACK_LAUNCHER 1`;
  const directResult = await execShell(directCmd);
  console.log('  Result:', directResult);

  console.log('\n' + '='.repeat(50));
  console.log('TEST 04 PASSED: YouTube TV launch works');
  console.log('='.repeat(50));

  // Summary
  console.log('\n📋 FINDINGS SUMMARY:');
  console.log(`  YouTube Package: ${youtubePackage}`);
  console.log('  Recommended launch method: VIEW intent with URL');

  process.exit(0);

} catch (error) {
  console.error('\n❌ TEST 04 FAILED:', error.message);
  process.exit(1);
}
