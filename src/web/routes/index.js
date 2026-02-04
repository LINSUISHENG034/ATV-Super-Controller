/**
 * Route Aggregator
 * Registers all web routes
 */
import { registerApiRoutes } from './api.js';

/**
 * Register all routes with Express app
 * @param {express.Application} app - Express app instance
 */
export function registerRoutes(app) {
  // Register API routes
  registerApiRoutes(app);

  // Future routes can be registered here
  // e.g., registerTaskRoutes(app);
  // e.g., registerLogRoutes(app);
}
