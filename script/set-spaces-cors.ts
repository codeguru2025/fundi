/**
 * One-time script: set CORS on the DO Spaces bucket so the browser can PUT directly.
 * Run: npx tsx script/set-spaces-cors.ts
 */
import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";

// Load .env manually since dotenv isn't installed
try {
  const envFile = readFileSync(".env", "utf-8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch (_) {}

const region = process.env.DO_SPACES_REGION;
const key = process.env.DO_SPACES_KEY;
const secret = process.env.DO_SPACES_SECRET;
const bucket = process.env.DO_SPACES_BUCKET;

if (!region || !key || !secret || !bucket) {
  console.error("Missing env vars: DO_SPACES_REGION, DO_SPACES_KEY, DO_SPACES_SECRET, DO_SPACES_BUCKET");
  process.exit(1);
}

const client = new S3Client({
  endpoint: `https://${region}.digitaloceanspaces.com`,
  region,
  credentials: { accessKeyId: key, secretAccessKey: secret },
});

async function main() {
  await client.send(new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: ["https://fundi-46s3y.ondigitalocean.app"],
          AllowedMethods: ["GET", "PUT", "HEAD"],
          AllowedHeaders: ["*"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }));
  console.log(`CORS configured on bucket: ${bucket}`);
}

main().catch(err => { console.error(err); process.exit(1); });
