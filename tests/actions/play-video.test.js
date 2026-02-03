import { vi, describe, it, expect, beforeEach } from 'vitest';
import { playVideoAction } from '../../src/actions/play-video.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  },
  logAdbCommand: vi.fn()
}));

describe('Play-Video Action', () => {
  let mockDevice;

  beforeEach(() => {
    vi.resetAllMocks();

    mockDevice = {
      id: '192.168.0.145:5555',
      shell: vi.fn()
    };
  });

  describe('action interface', () => {
    it('should have correct name', () => {
      expect(playVideoAction.name).toBe('play-video');
    });

    it('should have execute function', () => {
      expect(typeof playVideoAction.execute).toBe('function');
    });
  });

  describe('execute with full YouTube URL (AC1)', () => {
    it('should play video with full YouTube URL', async () => {
      mockDevice.shell.mockResolvedValue({});

      const result = await playVideoAction.execute(mockDevice, {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });

      expect(mockDevice.shell).toHaveBeenCalledWith(
        'am start -a android.intent.action.VIEW -d "https://www.youtube.com/watch?v=dQw4w9WgXcQ"'
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe('Video playback started');
      expect(result.data.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });
  });

  describe('execute with short YouTube URL (AC1)', () => {
    it('should play video with short YouTube URL', async () => {
      mockDevice.shell.mockResolvedValue({});

      const result = await playVideoAction.execute(mockDevice, {
        url: 'https://youtu.be/dQw4w9WgXcQ'
      });

      expect(mockDevice.shell).toHaveBeenCalledWith(
        'am start -a android.intent.action.VIEW -d "https://youtu.be/dQw4w9WgXcQ"'
      );
      expect(result.success).toBe(true);
    });
  });

  describe('execute with video ID only (AC1)', () => {
    it('should play video with video ID only', async () => {
      mockDevice.shell.mockResolvedValue({});

      const result = await playVideoAction.execute(mockDevice, {
        videoId: 'dQw4w9WgXcQ'
      });

      expect(mockDevice.shell).toHaveBeenCalledWith(
        'am start -a android.intent.action.VIEW -d "https://www.youtube.com/watch?v=dQw4w9WgXcQ"'
      );
      expect(result.success).toBe(true);
    });

    it('should normalize video ID passed as url parameter', async () => {
      mockDevice.shell.mockResolvedValue({});

      const result = await playVideoAction.execute(mockDevice, {
        url: 'dQw4w9WgXcQ'
      });

      expect(mockDevice.shell).toHaveBeenCalledWith(
        'am start -a android.intent.action.VIEW -d "https://www.youtube.com/watch?v=dQw4w9WgXcQ"'
      );
      expect(result.success).toBe(true);
    });
  });

  describe('invalid URL handling (AC2)', () => {
    it('should return error for missing URL and videoId', async () => {
      const result = await playVideoAction.execute(mockDevice, {});

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_PARAMS');
      expect(result.error.message).toBe('Valid YouTube URL or video ID is required');
    });

    it('should return error for invalid URL format', async () => {
      const result = await playVideoAction.execute(mockDevice, {
        url: 'not-a-valid-url'
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_PARAMS');
    });

    it('should return error for invalid video ID format', async () => {
      const result = await playVideoAction.execute(mockDevice, {
        videoId: 'invalid'
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_PARAMS');
    });
  });

  describe('no YouTube app installed (AC3)', () => {
    it('should return error when no app handles video URL - Activity not started', async () => {
      mockDevice.shell.mockRejectedValue(
        new Error('Error: Activity not started, unable to resolve Intent')
      );

      const result = await playVideoAction.execute(mockDevice, {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NO_APP_FOR_URL');
      expect(result.error.message).toBe('No app found to handle video URL');
      expect(result.error.details.suggestion).toContain('Install YouTube');
    });

    it('should return error when no app handles video URL - No Activity found', async () => {
      mockDevice.shell.mockRejectedValue(
        new Error('Error: No Activity found to handle Intent')
      );

      const result = await playVideoAction.execute(mockDevice, {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NO_APP_FOR_URL');
    });
  });

  describe('shell command failure', () => {
    it('should handle generic shell command failure', async () => {
      mockDevice.shell.mockRejectedValue(new Error('Connection timeout'));

      const result = await playVideoAction.execute(mockDevice, {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('PLAY_VIDEO_FAILED');
      expect(result.error.details.reason).toBe('Connection timeout');
    });
  });

  describe('result structure', () => {
    it('should return proper success result structure', async () => {
      mockDevice.shell.mockResolvedValue({});

      const result = await playVideoAction.execute(mockDevice, {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('url');
    });

    it('should return proper error result structure', async () => {
      const result = await playVideoAction.execute(mockDevice, {});

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error).toHaveProperty('code');
      expect(result.error).toHaveProperty('message');
    });
  });
});
