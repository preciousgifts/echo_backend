import supabase from "../config/database.js";
import logger from "../config/logger.js";

/**
 * Performs a simple health check on the database
 * @returns {Promise<{healthy: boolean, latency: number, error?: string}>}
 */
async function checkDatabaseHealth() {
  const startTime = Date.now();
  try {
    // Simple query to check database connectivity
    const { error } = await supabase.from("users").select("user_id").limit(1);

    const latency = Date.now() - startTime;

    if (error) {
      logger.error("Database health check failed", {
        error: error.message,
        latency,
      });
      return { healthy: false, latency, error: error.message };
    }

    logger.info("Database health check passed", { latency });
    return { healthy: true, latency };
  } catch (err) {
    const latency = Date.now() - startTime;
    logger.error("Database health check error", {
      error: err.message,
      latency,
    });
    return { healthy: false, latency, error: err.message };
  }
}

/**
 * Starts the periodic health check interval
 * @returns {NodeJS.Timeout} The interval ID for potential cleanup
 */
function startHealthCheckInterval() {
  const intervalMs = parseInt(process.env.HEALTH_CHECK_INTERVAL_MS) || 30000;

  logger.info(`Starting database health check interval: ${intervalMs}ms`);

  // Run immediately on startup
  checkDatabaseHealth();

  // Then run at interval
  const intervalId = setInterval(async () => {
    await checkDatabaseHealth();
  }, intervalMs);

  return intervalId;
}

export { checkDatabaseHealth, startHealthCheckInterval, };
