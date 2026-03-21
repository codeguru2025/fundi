/**
 * Standalone subscription expiry check — run as a scheduled job on DO App Platform.
 *
 * Add a scheduled job in DO App Platform:
 *   Run command: node -e "import('./dist/cron.cjs').then(m => m.runSubscriptionCheck())"
 *   Schedule: 0 2 * * *  (2 AM daily UTC)
 *
 * Or run manually: npx tsx server/cron.ts
 */

import { storage } from "./storage";
import { logger } from "./index";

export async function runSubscriptionCheck(): Promise<void> {
  logger.info("Running subscription expiry check...");
  try {
    await storage.checkExpiredSubscriptions();
    logger.info("Subscription expiry check complete.");
  } catch (err) {
    logger.error(err, "Subscription expiry check failed");
    process.exit(1);
  }
  process.exit(0);
}

// Allow running directly: npx tsx server/cron.ts
if (process.argv[1]?.endsWith("cron.ts") || process.argv[1]?.endsWith("cron.cjs")) {
  runSubscriptionCheck();
}
