import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdbKit from '@devicefarmer/adbkit';
import { clearCacheAction } from '../../src/actions/clear-cache.js';

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

describe('Clear-Cache Action', () => {
  let mockDevice;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDevice = {
      id: '192.168.0.145:5555',
      shell: vi.fn().mockResolvedValue({})
    };
  });

  it('should expose action name', () => {
    expect(clearCacheAction.name).toBe('clear-cache');
  });

  it('should return INVALID_PARAMS for missing package', async () => {
    const result = await clearCacheAction.execute(mockDevice, {});
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('INVALID_PARAMS');
  });

  it('should clear app data when command returns Success', async () => {
    AdbKit.Adb.util.readAll.mockResolvedValue(Buffer.from('Success'));

    const result = await clearCacheAction.execute(mockDevice, {
      package: 'com.example.app'
    });

    expect(mockDevice.shell).toHaveBeenCalledWith("pm clear 'com.example.app'");
    expect(result.success).toBe(true);
  });

  it('should return CLEAR_CACHE_FAILED when output is not successful', async () => {
    AdbKit.Adb.util.readAll.mockResolvedValue(Buffer.from('Failed'));

    const result = await clearCacheAction.execute(mockDevice, {
      package: 'com.example.app'
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('CLEAR_CACHE_FAILED');
  });
});
