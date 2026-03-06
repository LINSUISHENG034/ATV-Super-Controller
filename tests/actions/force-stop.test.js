import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdbKit from '@devicefarmer/adbkit';
import { forceStopAction } from '../../src/actions/force-stop.js';

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

describe('Force-Stop Action', () => {
  let mockDevice;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDevice = {
      id: '192.168.0.145:5555',
      shell: vi.fn().mockResolvedValue({})
    };
    AdbKit.Adb.util.readAll.mockResolvedValue(Buffer.from(''));
  });

  it('should expose action name', () => {
    expect(forceStopAction.name).toBe('force-stop');
  });

  it('should return INVALID_PARAMS for missing package', async () => {
    const result = await forceStopAction.execute(mockDevice, {});
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('INVALID_PARAMS');
  });

  it('should force-stop package successfully', async () => {
    const result = await forceStopAction.execute(mockDevice, {
      package: 'com.example.app'
    });

    expect(mockDevice.shell).toHaveBeenCalledWith("am force-stop 'com.example.app'");
    expect(result.success).toBe(true);
  });

  it('should return FORCE_STOP_FAILED on shell error', async () => {
    mockDevice.shell.mockRejectedValue(new Error('ADB error'));

    const result = await forceStopAction.execute(mockDevice, {
      package: 'com.example.app'
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('FORCE_STOP_FAILED');
  });
});
