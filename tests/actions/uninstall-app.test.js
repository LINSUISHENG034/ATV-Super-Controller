import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdbKit from '@devicefarmer/adbkit';
import { uninstallAppAction } from '../../src/actions/uninstall-app.js';

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

describe('Uninstall-App Action', () => {
  let mockDevice;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDevice = {
      id: '192.168.0.145:5555',
      shell: vi.fn().mockResolvedValue({})
    };
  });

  it('should expose action name', () => {
    expect(uninstallAppAction.name).toBe('uninstall-app');
  });

  it('should return INVALID_PARAMS for missing package', async () => {
    const result = await uninstallAppAction.execute(mockDevice, {});
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('INVALID_PARAMS');
  });

  it('should uninstall package when output contains Success', async () => {
    AdbKit.Adb.util.readAll.mockResolvedValue(Buffer.from('Success'));

    const result = await uninstallAppAction.execute(mockDevice, {
      package: 'com.example.app'
    });

    expect(mockDevice.shell).toHaveBeenCalledWith("pm uninstall 'com.example.app'");
    expect(result.success).toBe(true);
  });

  it('should return UNINSTALL_FAILED when output indicates failure', async () => {
    AdbKit.Adb.util.readAll.mockResolvedValue(Buffer.from('Failure [DELETE_FAILED_INTERNAL_ERROR]'));

    const result = await uninstallAppAction.execute(mockDevice, {
      package: 'com.example.app'
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('UNINSTALL_FAILED');
  });
});
