/**
 * Configuration loader and validator module
 * Handles loading config files and validating against JSON Schema
 */
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load schema once at module initialization
const schemaPath = join(__dirname, '../../schemas/config.schema.json');
import { readFileSync } from 'fs';
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

// Initialize ajv with formats support
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

/**
 * Load configuration from a JSON file
 * @param {string} filePath - Path to the config file
 * @returns {object} Parsed configuration object
 * @throws {Error} If file not found or invalid JSON
 */
async function loadConfigFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const err = new Error(`Configuration file not found: ${filePath}`);
      err.code = 'CONFIG_NOT_FOUND';
      throw err;
    }
    if (error instanceof SyntaxError) {
      const err = new Error(`Invalid JSON in configuration file: ${error.message}`);
      err.code = 'CONFIG_PARSE_ERROR';
      throw err;
    }
    throw error;
  }
}

/**
 * Validate configuration against JSON Schema
 * @param {object} config - Configuration object to validate
 * @returns {object} Validation result with valid flag and errors array
 */
function validateConfig(config) {
  const valid = validate(config);

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors = validate.errors.map(err => ({
    path: err.instancePath,
    message: err.message,
    value: err.data
  }));

  return { valid: false, errors };
}

export { loadConfigFile, validateConfig };
