/**
 * App Manager Service
 * Provides Android TV app discovery and metadata via ADB shell commands.
 */
import AdbKit from '@devicefarmer/adbkit';
import { getDevice } from './adb-client.js';
import { logger, logAdbCommand } from '../utils/logger.js';
import { shellQuote, isValidPackageName } from '../utils/shell.js';

function requireConnectedDevice() {
  const device = getDevice();
  if (!device) {
    const error = new Error('No device connected');
    error.code = 'DEVICE_NOT_CONNECTED';
    throw error;
  }
  return device;
}

/**
 * Execute adb shell command and return stdout as string
 * @param {object} device - Connected adbkit device
 * @param {string} command - Shell command
 * @returns {Promise<string>} Command stdout
 */
async function readShell(device, command) {
  logAdbCommand(command, device.id);
  const stream = await device.shell(command);
  const output = await AdbKit.Adb.util.readAll(stream);
  return output.toString().trim();
}

function validatePackageName(packageName) {
  if (!isValidPackageName(packageName)) {
    const error = new Error('Invalid package name');
    error.code = 'INVALID_PACKAGE';
    throw error;
  }
}

/**
 * Parse `pm list packages -f -3` output
 * @param {string} output - Raw command output
 * @returns {Array<{package: string, path: string}>} Parsed package records
 */
function parsePackageList(output) {
  return output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      if (!line.startsWith('package:')) {
        return null;
      }

      const separatorIndex = line.lastIndexOf('=');
      if (separatorIndex < 0) {
        return null;
      }

      const path = line.slice('package:'.length, separatorIndex).trim();
      const packageName = line.slice(separatorIndex + 1).trim();
      if (!path || !packageName) {
        return null;
      }

      return { package: packageName, path };
    })
    .filter(Boolean);
}

/**
 * Parse app size from `du -s` output (KB units)
 * @param {string} output - Raw du output
 * @returns {number} Size in bytes
 */
function parseSizeBytes(output) {
  const match = output.match(/^(\d+)/);
  if (!match) {
    return 0;
  }
  const kib = parseInt(match[1], 10);
  if (Number.isNaN(kib) || kib < 0) {
    return 0;
  }
  return kib * 1024;
}

/**
 * Resolve APK file path for a package from `pm path`
 * @param {object} device - Connected adbkit device
 * @param {string} packageName - Android package name
 * @returns {Promise<string>} APK path
 */
async function resolvePackageApkPath(device, packageName) {
  const output = await readShell(device, `pm path ${shellQuote(packageName)}`);
  const line = output
    .split(/\r?\n/)
    .map(entry => entry.trim())
    .find(entry => entry.startsWith('package:'));

  if (!line) {
    const error = new Error(`Package not found: ${packageName}`);
    error.code = 'PACKAGE_NOT_FOUND';
    throw error;
  }

  return line.slice('package:'.length).trim();
}

/**
 * Collect app metadata for one package
 * @param {object} device - Connected adbkit device
 * @param {string} packageName - Android package name
 * @param {string} [knownPath] - Optional pre-resolved APK path
 * @returns {Promise<{package: string, name: string, version: string, size: number, path: string, firstInstallTime: string|null}>}
 */
async function getAppInfoForDevice(device, packageName, knownPath) {
  validatePackageName(packageName);

  const apkPath = knownPath || await resolvePackageApkPath(device, packageName);
  const safePackage = shellQuote(packageName);
  const safePath = shellQuote(apkPath);

  const metadataOutput = await readShell(
    device,
    `dumpsys package ${safePackage} | grep -E "versionName=|firstInstallTime="`
  );

  const versionMatch = metadataOutput.match(/versionName=([^\r\n]+)/);
  const firstInstallMatch = metadataOutput.match(/firstInstallTime=([^\r\n]+)/);

  const labelOutput = await readShell(
    device,
    `dumpsys package ${safePackage} | grep -m 1 "application-label:"`
  );
  const nameMatch = labelOutput.match(/application-label:\s*'?([^'\r\n]+)'?/);

  const sizeOutput = await readShell(device, `du -s ${safePath}`);

  return {
    package: packageName,
    name: (nameMatch?.[1] || packageName).trim(),
    version: (versionMatch?.[1] || 'unknown').trim(),
    size: parseSizeBytes(sizeOutput),
    path: apkPath,
    firstInstallTime: firstInstallMatch?.[1]?.trim() || null
  };
}

/**
 * List all installed third-party apps
 * @returns {Promise<Array<{package: string, name: string, version: string, size: number, path: string}>>}
 */
async function listInstalledApps() {
  const device = requireConnectedDevice();
  const listOutput = await readShell(device, 'pm list packages -f -3');
  const packages = parsePackageList(listOutput);

  const apps = await Promise.all(
    packages.map(async app => {
      try {
        return await getAppInfoForDevice(device, app.package, app.path);
      } catch (error) {
        logger.warn('Partial app metadata unavailable', {
          package: app.package,
          reason: error.message
        });
        return {
          package: app.package,
          name: app.package,
          version: 'unknown',
          size: 0,
          path: app.path,
          firstInstallTime: null
        };
      }
    })
  );

  return apps.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get detailed metadata for one installed app
 * @param {string} packageName - Android package name
 * @returns {Promise<{package: string, name: string, version: string, size: number, path: string, firstInstallTime: string|null}>}
 */
async function getAppInfo(packageName) {
  const device = requireConnectedDevice();
  return getAppInfoForDevice(device, packageName);
}

/**
 * Resolve and return APK path for one installed app
 * @param {string} packageName - Android package name
 * @returns {Promise<string>} APK path
 */
async function getAppApkPath(packageName) {
  validatePackageName(packageName);
  const device = requireConnectedDevice();
  return resolvePackageApkPath(device, packageName);
}

export { listInstalledApps, getAppInfo, getAppApkPath };
