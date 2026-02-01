/**
 * Test 01: Verify adb-kit installation and basic import
 *
 * This test validates:
 * - adb-kit can be imported
 * - createClient function exists
 * - Basic API structure is correct
 */

console.log('='.repeat(50));
console.log('TEST 01: adb-kit Installation Verification');
console.log('='.repeat(50));

try {
  // Test 1: Dynamic import
  console.log('\n[1/3] Testing dynamic import...');
  const Adb = await import('@devicefarmer/adbkit');
  console.log('  ✅ adb-kit imported successfully');

  // Test 2: Check default export
  console.log('\n[2/3] Checking module structure...');
  const AdbClass = Adb.default.Adb;
  console.log('  Module keys:', Object.keys(Adb.default));

  // Test 3: Verify createClient exists
  console.log('\n[3/3] Verifying createClient function...');
  if (typeof AdbClass.createClient === 'function') {
    console.log('  ✅ createClient is a function');

    const client = AdbClass.createClient();
    console.log('  ✅ Client created successfully');
    console.log('  Client methods:', Object.keys(Object.getPrototypeOf(client)));
  } else {
    throw new Error('createClient is not a function');
  }

  console.log('\n' + '='.repeat(50));
  console.log('TEST 01 PASSED: adb-kit is properly installed');
  console.log('='.repeat(50));
  process.exit(0);

} catch (error) {
  console.error('\n❌ TEST 01 FAILED:', error.message);
  console.error('\nTroubleshooting:');
  console.error('  1. Run: npm install');
  console.error('  2. Check Node.js version: node --version (need 18+)');
  process.exit(1);
}
