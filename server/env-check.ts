/**
 * Centralized environment variable validation.
 * Call validateEnv() at server startup to fail fast if required vars are missing.
 */
import { logger } from "./index";

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
}

const ENV_VARS: EnvVar[] = [
  // Core
  { name: "DATABASE_URL", required: true, description: "PostgreSQL connection string (pooled)" },
  { name: "SESSION_SECRET", required: true, description: "Secret for signing session cookies" },

  // Google OAuth
  { name: "GOOGLE_CLIENT_ID", required: true, description: "Google OAuth client ID" },
  { name: "GOOGLE_CLIENT_SECRET", required: true, description: "Google OAuth client secret" },

  // DigitalOcean Spaces (file storage)
  { name: "DO_SPACES_KEY", required: true, description: "DO Spaces access key" },
  { name: "DO_SPACES_SECRET", required: true, description: "DO Spaces secret key" },
  { name: "DO_SPACES_BUCKET", required: true, description: "DO Spaces bucket name" },
  { name: "DO_SPACES_REGION", required: true, description: "DO Spaces region (e.g. ams3)" },

  // Optional but recommended
  { name: "APP_URL", required: false, description: "Public app URL (used for CORS, OAuth callbacks)" },
  { name: "DEFAULT_ADMIN_EMAIL", required: false, description: "Email auto-promoted to admin on first login" },
  { name: "PAYNOW_INTEGRATION_ID", required: false, description: "Paynow payment gateway integration ID" },
  { name: "PAYNOW_INTEGRATION_KEY", required: false, description: "Paynow payment gateway integration key" },
  { name: "LOG_LEVEL", required: false, description: "Pino log level (default: info)" },
];

export function validateEnv(): void {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const v of ENV_VARS) {
    const value = process.env[v.name];
    if (!value || value.trim() === "") {
      if (v.required) {
        missing.push(`  ${v.name} — ${v.description}`);
      } else {
        warnings.push(`  ${v.name} — ${v.description}`);
      }
    }
  }

  if (warnings.length > 0) {
    logger.warn(`Optional env vars not set:\n${warnings.join("\n")}`);
  }

  if (missing.length > 0) {
    const msg = `Missing required environment variables:\n${missing.join("\n")}`;
    logger.error(msg);
    if (process.env.NODE_ENV === "production") {
      throw new Error(msg);
    }
  }
}
