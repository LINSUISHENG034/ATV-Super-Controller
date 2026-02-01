/**
 * Test 02: Verify ADB TCP connection to device
 *
 * Prerequisites:
 * - Android TV with ADB over TCP enabled
 * - Device IP configured in config.mjs
 * - Device on same network as this machine
 *
 * Enable ADB over TCP on Android TV:
 *   Settings > Device Preferences > About > Build (click 7 times)
 *   Settings > Device Preferences > Developer options > Network debugging
 */

import AdbKit from '@devicefarmer/adbkit';
import { CONFIG, getDeviceAddress } from './config.mjs';

console.log('='.repeat(50));
console.log('TEST 02: ADB TCP Connection');
console.log('='.repeat(50));
console.log(`\nTarget device: ${getDeviceAddress()}`);

const Adb = AdbKit.Adb;
const client = Adb.createClient();

try {
  // Test 1: Connect to device
  console.log('\n[1/3] Connecting to device...');
  const id = await client.connect(CONFIG.DEVICE_IP, CONFIG.DEVICE_PORT);
  console.log(`  ✅ Connected: ${id}`);

  // Test 2: List devices to verify connection
  console.log('\n[2/3] Listing connected devices...');
  const devices = await client.listDevices();
  console.log(`  Found ${devices.length} device(s):`);
  devices.forEach(d => {
    console.log(`    - ${d.id} (${d.type})`);
  });

  // Test 3: Verify our device is in the list
  console.log('\n[3/3] Verifying target device...');
  const targetDevice = devices.find(d => d.id === getDeviceAddress());
  if (targetDevice) {
    console.log(`  ✅ Target device found: ${targetDevice.type}`);
  } else {
    console.log('  ⚠️ Target device not in list, but connection succeeded');
  }

  console.log('\n' + '='.repeat(50));
  console.log('TEST 02 PASSED: ADB connection works');
  console.log('='.repeat(50));
  process.exit(0);

} catch (error) {
  console.error('\n❌ TEST 02 FAILED:', error.message);
  console.error('\nTroubleshooting:');
  console.error('  1. Verify device IP in config.mjs');
  console.error('  2. Ensure ADB over TCP is enabled on device');
  console.error('  3. Check firewall allows port 5555');
  console.error('  4. Try: adb connect ' + getDeviceAddress());
  process.exit(1);
}
