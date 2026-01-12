import { Storage } from "@google-cloud/storage";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

// Load migration env
const migrationEnvPath = resolve(__dirname, "../../.env.migration");
if (existsSync(migrationEnvPath)) {
  const text = readFileSync(migrationEnvPath, "utf-8");
  for (const line of text.split("\n")) {
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
    if (!process.env[key]) process.env[key] = value;
  }
}

const gcsStorage = new Storage({
  projectId: process.env.FIREBASE_PROJECT_ID,
  credentials: {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
});

async function main() {
  console.log("========================================");
  console.log(" GCS Bucket 狀態檢查");
  console.log("========================================\n");

  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || "";
  console.log("Bucket:", bucketName);

  const bucket = gcsStorage.bucket(bucketName);
  const [files] = await bucket.getFiles();

  let totalSize = 0;
  for (const file of files) {
    totalSize += Number.parseInt(file.metadata.size || "0", 10);
  }

  console.log("\n=== 統計 ===");
  console.log("總檔案數:", files.length);
  console.log("總大小:", (totalSize / 1024 / 1024 / 1024).toFixed(2), "GB");

  // Show first 10 files
  console.log("\n=== 範例檔案（前 10 個）===");
  for (let i = 0; i < Math.min(10, files.length); i++) {
    const file = files[i];
    const sizeMB = (
      Number.parseInt(file.metadata.size || "0", 10) /
      1024 /
      1024
    ).toFixed(2);
    console.log("  " + file.name + " (" + sizeMB + " MB)");
  }

  console.log("\n========================================");
}

main().catch(console.error);
