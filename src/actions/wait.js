/**
 * Wait action - pauses execution for specified duration
 */
import { logger } from '../utils/logger.js';

const waitAction = {
  name: 'wait',

  /**
   * Execute wait action
   * @param {object} device - ADB device object (unused but required by interface)
   * @param {object} params - Action parameters
   * @param {number} params.duration - Wait duration in milliseconds
   * @returns {object} Action result
   */
  async execute(device, params) {
    const { duration } = params;

    if (duration === undefined || typeof duration !== 'number' || duration < 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_DURATION',
          message: 'Duration must be a non-negative number',
          details: { duration }
        }
      };
    }

    logger.info(`Waiting for ${duration}ms`);
    await new Promise((resolve) => setTimeout(resolve, duration));

    return {
      success: true,
      message: `Waited ${duration}ms`
    };
  }
};

export { waitAction };
