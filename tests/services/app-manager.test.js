import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdbKit from '@devicefarmer/adbkit';
import { listInstalledApps, getAppInfo, getAppApkPath } from '../../src/services/app-manager.js';

const { mockGetDevice } = vi.hoisted(() => ({
  mockGetDevice: vi.fn()
}));

vi.mock('../../src/services/adb-client.js', () => ({
  getDevice: mockGetDevice
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    warn: vi.fn()
  },
  logAdbCommand: vi.fn()
}));

vi.mock('@devicefarmer/adbkit', () => ({
  default: {
    Adb: {
      util: {
        readAll: vi.fn()
      }
    }
  }
}));

describe('App Manager Service', () => {
  let mockDevice;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDevice = {
      id: '192.168.0.145:5555',
      shell: vi.fn().mockResolvedValue({})
    };
    mockGetDevice.mockReturnValue(mockDevice);
  });

  it('should list installed apps with metadata', async () => {
    AdbKit.Adb.util.readAll
      .mockResolvedValueOnce(Buffer.from('package:/data/app/~~abc/com.example.app/base.apk=com.example.app'))
      .mockResolvedValueOnce(Buffer.from('versionName=2.3.4\nfirstInstallTime=2026-02-01 10:00:00'))
      .mockResolvedValueOnce(Buffer.from("application-label:'Example App'"))
      .mockResolvedValueOnce(Buffer.from('2048\t/data/app/~~abc/com.example.app/base.apk'));

    const apps = await listInstalledApps();

    expect(apps).toHaveLength(1);
    expect(apps[0]).toEqual(expect.objectContaining({
      package: 'com.example.app',
      name: 'Example App',
      version: '2.3.4',
      size: 2048 * 1024,
      path: '/data/app/~~abc/com.example.app/base.apk'
    }));
  });

  it('should throw DEVICE_NOT_CONNECTED when no device is available', async () => {
    mockGetDevice.mockReturnValue(null);

    await expect(listInstalledApps()).rejects.toMatchObject({
      code: 'DEVICE_NOT_CONNECTED'
    });
  });

  it('should reject invalid package name in getAppInfo', async () => {
    await expect(getAppInfo('../bad')).rejects.toMatchObject({
      code: 'INVALID_PACKAGE'
    });
  });

  it('should resolve APK path for a package', async () => {
    AdbKit.Adb.util.readAll.mockResolvedValue(
      Buffer.from('package:/data/app/~~abc/com.example.app/base.apk')
    );

    const apkPath = await getAppApkPath('com.example.app');

    expect(apkPath).toBe('/data/app/~~abc/com.example.app/base.apk');
    expect(mockDevice.shell).toHaveBeenCalledWith("pm path 'com.example.app'");
  });
});
