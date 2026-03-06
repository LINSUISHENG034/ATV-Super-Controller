import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdbKit from '@devicefarmer/adbkit';
import { installAppAction } from '../../src/actions/install-app.js';

vi.mock('@devicefarmer/adbkit', () => ({
  default: {
    Adb: {
      util: {
        readAll: vi.fn()
      }
    }
  }
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  },
  logAdbCommand: vi.fn()
}));

describe('Install-App Action', () => {
  let mockDevice;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDevice = {
      id: '192.168.0.145:5555',
      shell: vi.fn().mockResolvedValue({})
    };
  });

  it('should expose action name', () => {
    expect(installAppAction.name).toBe('install-app');
  });

  it('should return INVALID_PARAMS when apkPath is missing', async () => {
    const result = await installAppAction.execute(mockDevice, {});
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('INVALID_PARAMS');
  });

  it('should install APK when shell output contains Success', async () => {
    AdbKit.Adb.util.readAll.mockResolvedValue(Buffer.from('Success'));

    const result = await installAppAction.execute(mockDevice, {
      apkPath: '/data/local/tmp/upload.apk'
    });

    expect(mockDevice.shell).toHaveBeenCalledWith(
      "pm install -r '/data/local/tmp/upload.apk'"
    );
    expect(result.success).toBe(true);
  });

  it('should return INSTALL_FAILED when shell output is not successful', async () => {
    AdbKit.Adb.util.readAll.mockResolvedValue(Buffer.from('Failure [INSTALL_FAILED_INVALID_APK]'));

    const result = await installAppAction.execute(mockDevice, {
      apkPath: '/data/local/tmp/upload.apk'
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('INSTALL_FAILED');
  });
});
