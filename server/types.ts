/**
 * Express type augmentations — makes req.user type-safe across all routes.
 *
 * The user object stored on req.user is the full User row from the DB
 * minus the sensitive paynowIntegrationKey field (stripped in deserializeUser).
 */
import type { User } from "@shared/schema";

export type SafeUser = Omit<User, "paynowIntegrationKey">;

declare global {
  namespace Express {
    interface User extends SafeUser {}
  }
}
