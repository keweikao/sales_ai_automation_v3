import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load env
const envContent = readFileSync(
  resolve(__dirname, "../../apps/server/.env"),
  "utf-8"
);
const envVars: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex === -1) continue;
  const key = trimmed.slice(0, eqIndex).trim();
  let value = trimmed.slice(eqIndex + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  envVars[key] = value;
}

const r2Client = new S3Client({
  region: "auto",
  endpoint: envVars.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: envVars.CLOUDFLARE_R2_ACCESS_KEY,
    secretAccessKey: envVars.CLOUDFLARE_R2_SECRET_KEY,
  },
});

async function main() {
  console.log("========================================");
  console.log(" R2 Bucket 狀態檢查");
  console.log("========================================\n");

  const bucket = envVars.CLOUDFLARE_R2_BUCKET;
  console.log("Bucket:", bucket);

  let totalFiles = 0;
  let totalSize = 0;
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
    });

    const response = await r2Client.send(command);

    if (response.Contents) {
      for (const obj of response.Contents) {
        totalFiles++;
        totalSize += obj.Size || 0;
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  console.log("\n=== 統計 ===");
  console.log("總檔案數:", totalFiles);
  console.log("總大小:", (totalSize / 1024 / 1024 / 1024).toFixed(2), "GB");

  // List first 10 files as sample
  const sampleCommand = new ListObjectsV2Command({
    Bucket: bucket,
    MaxKeys: 10,
  });
  const sampleResponse = await r2Client.send(sampleCommand);

  console.log("\n=== 範例檔案（前 10 個）===");
  if (sampleResponse.Contents) {
    for (const obj of sampleResponse.Contents) {
      const sizeMB = ((obj.Size || 0) / 1024 / 1024).toFixed(2);
      console.log("  " + obj.Key + " (" + sizeMB + " MB)");
    }
  }

  console.log("\n========================================");
}

main().catch(console.error);
