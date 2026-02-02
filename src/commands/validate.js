/**
 * Validate command - validates configuration file against JSON Schema
 */
import { loadConfigFile, validateConfig } from '../utils/config.js';

/**
 * Execute validate command
 * @param {object} options - Command options
 * @param {string} options.config - Path to config file
 */
export async function validateCommand(options) {
  const configPath = options.config;

  try {
    // Load config file
    const config = await loadConfigFile(configPath);

    // Validate against schema
    const result = validateConfig(config);

    if (result.valid) {
      console.log('✓ Configuration is valid');
      console.log(`  Device: ${config.device.ip}:${config.device.port}`);
      console.log(`  Tasks: ${config.tasks.length} task(s) configured`);
      process.exitCode = 0;
    } else {
      console.log('✗ Configuration validation failed\n');
      for (const error of result.errors) {
        console.log(`  ${error.path || '/'}: ${error.message}`);
        if (error.value !== undefined) {
          console.log(`    Value: ${JSON.stringify(error.value)}`);
        }
        console.log('');
      }
      process.exitCode = 1;
    }
  } catch (error) {
    if (error.code === 'CONFIG_NOT_FOUND') {
      console.log(`✗ ${error.message}`);
    } else if (error.code === 'CONFIG_PARSE_ERROR') {
      console.log(`✗ ${error.message}`);
    } else {
      console.log(`✗ Unexpected error: ${error.message}`);
    }
    process.exitCode = 1;
  }
}

export { validateCommand as default };
