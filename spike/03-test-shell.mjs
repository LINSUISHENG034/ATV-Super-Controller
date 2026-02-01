/**
 * Test 03: Verify shell command execution
 *
 * This test validates:
 * - Shell commands can be executed on device
 * - Output can be captured correctly
 * - Wake up command works
 */

import AdbKit from '@devicefarmer/adbkit';
import { CONFIG, getDeviceAddress } from './config.mjs';

console.log('='.repeat(50));
console.log('TEST 03: Shell Command Execution');
console.log('='.repeat(50));

const Adb = AdbKit.Adb;
const client = Adb.createClient();
const deviceAddr = getDeviceAddress();

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function execShell(command) {
  console.log(`  Executing: ${command}`);
  const device = client.getDevice(deviceAddr);
  const stream = await device.shell(command);
  const output = await streamToString(stream);
  return output.trim();
}

try {
  // Connect first
  console.log('\n[0/4] Connecting...');
  await client.connect(CONFIG.DEVICE_IP, CONFIG.DEVICE_PORT);
  console.log('  ✅ Connected');

  // Test 1: Simple echo
  console.log('\n[1/4] Testing echo command...');
  const echoResult = await execShell('echo "spike-test-ok"');
  if (echoResult.includes('spike-test-ok')) {
    console.log('  ✅ Echo works:', echoResult);
  } else {
    throw new Error('Echo output mismatch');
  }

  // Test 2: Get device info
  console.log('\n[2/4] Getting device info...');
  const model = await execShell('getprop ro.product.model');
  const android = await execShell('getprop ro.build.version.release');
  console.log(`  ✅ Model: ${model}`);
  console.log(`  ✅ Android: ${android}`);

  // Test 3: Wake up command
  console.log('\n[3/4] Testing KEYCODE_WAKEUP...');
  await execShell('input keyevent KEYCODE_WAKEUP');
  console.log('  ✅ Wake up command sent (check if TV woke up)');

  // Test 4: Check screen state
  console.log('\n[4/4] Checking screen state...');
  const dumpsys = await execShell('dumpsys power | grep "Display Power"');
  console.log(`  Screen state: ${dumpsys || '(unable to determine)'}`);

  console.log('\n' + '='.repeat(50));
  console.log('TEST 03 PASSED: Shell execution works');
  console.log('='.repeat(50));
  process.exit(0);

} catch (error) {
  console.error('\n❌ TEST 03 FAILED:', error.message);
  process.exit(1);
}
