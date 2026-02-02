import { vi, describe, it, expect, beforeEach } from 'vitest';
import { wakeUpAction } from '../../src/actions/wake-up.js'; // This imports the module which imports AdbKit
import AdbKit from '@devicefarmer/adbkit'; // Import to mock

// Mock AdbKit
vi.mock('@devicefarmer/adbkit', () => ({
  default: {
    Adb: {
      util: {
        readAll: vi.fn()
      }
    }
  }
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Wake-Up Action', () => {
  let mockDevice;
  let mockStream;

  beforeEach(() => {
    vi.resetAllMocks();
    
    // Mock device
    mockDevice = {
      id: '192.168.0.145:5555',
      shell: vi.fn()
    };

    // Mock stream
    mockStream = { id: 'mock-stream' };
    
    // Default behavior: Dumpsys returns Asleep, then Wakeup command works
    mockDevice.shell.mockImplementation((cmd) => {
      if (cmd.includes('dumpsys')) {
        return Promise.resolve(mockStream);
      }
      return Promise.resolve(mockStream); // Input command also returns a stream usually
    });

    // Default readAll behavior: Return 'Asleep' for dumpsys
    AdbKit.Adb.util.readAll.mockImplementation((stream) => {
      return Promise.resolve(Buffer.from('mWakefulness=Asleep'));
    });
  });

  describe('action interface', () => {
    it('should have correct name', () => {
      expect(wakeUpAction.name).toBe('wake-up');
    });

    it('should have execute function', () => {
      expect(typeof wakeUpAction.execute).toBe('function');
    });
  });

  describe('execute', () => {
    it('should send KEYCODE_WAKEUP command when device is asleep', async () => {
      const result = await wakeUpAction.execute(mockDevice, {});

      // Should check status first
      expect(mockDevice.shell).toHaveBeenCalledWith('dumpsys power | grep mWakefulness=');
      // Then send wakeup
      expect(mockDevice.shell).toHaveBeenCalledWith('input keyevent KEYCODE_WAKEUP');
      expect(result.success).toBe(true);
      expect(result.data.keycode).toBe('KEYCODE_WAKEUP');
    });

    it('should NOT send KEYCODE_WAKEUP if device is already awake', async () => {
      // Setup mock to return Awake
      AdbKit.Adb.util.readAll.mockResolvedValue(Buffer.from('mWakefulness=Awake'));

      const result = await wakeUpAction.execute(mockDevice, {});

      // Should check status
      expect(mockDevice.shell).toHaveBeenCalledWith('dumpsys power | grep mWakefulness=');
      // Should NOT send wakeup
      expect(mockDevice.shell).not.toHaveBeenCalledWith('input keyevent KEYCODE_WAKEUP');
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Device already awake');
    });

    it('should handle failures in status check gracefully', async () => {
      // Mock failure on first shell call
      mockDevice.shell.mockRejectedValueOnce(new Error('Connection lost'));

      const result = await wakeUpAction.execute(mockDevice, {});

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('WAKEUP_FAILED');
      expect(result.error.details.reason).toBe('Connection lost');
    });
    
    it('should handle failures in wakeup command', async () => {
      // First call (dumpsys) succeeds
      mockDevice.shell.mockResolvedValueOnce(mockStream);
      
      // Second call (wakeup) fails
      mockDevice.shell.mockRejectedValueOnce(new Error('Command failed'));

      const result = await wakeUpAction.execute(mockDevice, {});

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('WAKEUP_FAILED');
    });
  });
});
