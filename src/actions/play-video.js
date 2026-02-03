/**
 * Play-Video Action
 * Plays a YouTube video on Android TV using VIEW intent
 * Uses VIEW intent for cross-device compatibility - do NOT hardcode Activity names
 */
import { logger, logAdbCommand } from '../utils/logger.js';
import { successResult, errorResult } from './result.js';

/**
 * Normalize YouTube URL from various input formats
 * @param {string} url - Full URL, short URL, or video ID
 * @param {string} videoId - Video ID only
 * @returns {string|null} Normalized YouTube URL or null if invalid
 */
const YOUTUBE_VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Normalize YouTube URL from various input formats
 * @param {string} url - Full URL, short URL, or video ID
 * @param {string} videoId - Video ID only
 * @returns {string|null} Normalized YouTube URL or null if invalid
 */
function normalizeYouTubeUrl(url, videoId) {
  // If videoId provided and matches pattern
  if (videoId && YOUTUBE_VIDEO_ID_REGEX.test(videoId)) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  if (!url) return null;

  // Try to treat url as a video ID if it matches the pattern
  if (YOUTUBE_VIDEO_ID_REGEX.test(url)) {
    return `https://www.youtube.com/watch?v=${url}`;
  }

  // Helper to validate and normalize URL strings
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    
    // Check allowlist of domains
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      // Basic sanity check for shell safety - URLs shouldn't contain quotes
      if (url.includes('"') || url.includes("'") || url.includes('`')) {
        return null;
      }
      return url;
    }
  } catch (e) {
    // Invalid URL format
    return null;
  }

  return null;
}

const playVideoAction = {
  name: 'play-video',
  async execute(device, params, context = {}) {
    const { url, videoId } = params;
    const youtubeConfig = context.youtube;

    // Normalize and validate URL
    const videoUrl = normalizeYouTubeUrl(url, videoId);
    if (!videoUrl) {
      return errorResult(
        'INVALID_PARAMS',
        'Valid YouTube URL or video ID is required',
        { provided: { url, videoId } }
      );
    }

    try {
      let command;
      
      // If youtube client configured, use explicit component
      if (youtubeConfig?.package && youtubeConfig?.activity) {
        const component = `${youtubeConfig.package}/${youtubeConfig.activity}`;
        command = `am start -a android.intent.action.VIEW -d "${videoUrl}" -n ${component}`;
        logger.debug('Using configured YouTube client', { package: youtubeConfig.package });
      } else {
        // Default: generic VIEW intent (works for official YouTube TV)
        command = `am start -a android.intent.action.VIEW -d "${videoUrl}"`;
      }

      logAdbCommand(command, device.id);
      await device.shell(command);

      logger.info('Video playback started', { url: videoUrl });
      return successResult('Video playback started', { 
        url: videoUrl,
        client: youtubeConfig?.package || 'system-default'
      });
    } catch (error) {
      // Check for "Activity not started" or "No Activity found" patterns
      if (
        error.message.includes('Activity not started') ||
        error.message.includes('No Activity found')
      ) {
        logger.error('No app found to handle video URL', { url: videoUrl });
        return errorResult(
          'NO_APP_FOR_URL',
          'No app found to handle video URL',
          { 
            url: videoUrl, 
            suggestion: youtubeConfig 
              ? 'Check youtube.package and youtube.activity in config' 
              : 'Install YouTube app or configure youtube client in config.json'
          }
        );
      }

      logger.error('Failed to play video', { url: videoUrl, reason: error.message });
      return errorResult(
        'PLAY_VIDEO_FAILED',
        `Failed to play video: ${videoUrl}`,
        { reason: error.message }
      );
    }
  }
};

export { playVideoAction };
