// scripts/migration/analyze-r2-files.ts
/**
 * 分析 R2 中的檔案並與 GCS 比較
 */

import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
import { r2Config } from "./config";

interface GCSManifest {
  files: Array<{ path: string; sizeBytes: number }>;
  totalFiles: number;
}

async function analyzeFiles() {
  console.log("📊 檔案分析比較\n");

  // 載入 GCS manifest
  const manifest: GCSManifest = JSON.parse(
    readFileSync("scripts/migration/data/gcs-audio-manifest.json", "utf-8")
  );

  // 分析 GCS 檔案
  const gcsFiles = new Set<string>();
  const gcsBaseNames = new Set<string>();

  for (const file of manifest.files) {
    gcsFiles.add(file.path);
    let baseName = file.path.split("/").pop() || "";
    baseName = baseName.replace(/_converted\.(mp3|m4a)$/i, "");
    baseName = baseName.replace(/\.(mp3|m4a)$/i, "");
    gcsBaseNames.add(baseName);
  }

  // 分析 R2 檔案
  const r2Client = new S3Client({
    region: "auto",
    endpoint: r2Config.endpoint,
    credentials: {
      accessKeyId: r2Config.accessKeyId,
      secretAccessKey: r2Config.secretAccessKey,
    },
  });

  const r2Files = new Set<string>();
  const r2BaseNames = new Set<string>();
  let continuationToken: string | undefined;

  do {
    const response = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: r2Config.bucket,
        Prefix: "audio/",
        ContinuationToken: continuationToken,
      })
    );

    for (const file of response.Contents || []) {
      r2Files.add(file.Key || "");
      let baseName = (file.Key || "").split("/").pop() || "";
      baseName = baseName.replace(/_converted\.(mp3|m4a)$/i, "");
      baseName = baseName.replace(/\.(mp3|m4a)$/i, "");
      r2BaseNames.add(baseName);
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  // 輸出結果
  console.log(
    "═══════════════════════════════════════════════════════════════\n"
  );
  console.log("GCS (來源):");
  console.log(`  總檔案數: ${manifest.totalFiles}`);
  console.log(`  唯一音檔數: ${gcsBaseNames.size}`);
  console.log("");
  console.log("R2 (目標):");
  console.log(`  總檔案數: ${r2Files.size}`);
  console.log(`  唯一音檔數: ${r2BaseNames.size}`);
  console.log("");

  // 找出缺失的檔案
  const missingBaseNames: string[] = [];
  for (const baseName of gcsBaseNames) {
    if (!r2BaseNames.has(baseName)) {
      missingBaseNames.push(baseName);
    }
  }

  if (missingBaseNames.length > 0) {
    console.log(`⚠️ 缺失的唯一音檔: ${missingBaseNames.length}`);
    console.log("   前 10 個:");
    for (const name of missingBaseNames.slice(0, 10)) {
      console.log(`   - ${name}`);
    }
    if (missingBaseNames.length > 10) {
      console.log(`   ... 還有 ${missingBaseNames.length - 10} 個`);
    }
  } else {
    console.log("✅ 所有唯一音檔都已遷移");
  }

  console.log("");
  console.log(
    "═══════════════════════════════════════════════════════════════\n"
  );
  console.log("💡 結論:");
  console.log(
    `   GCS 有 ${manifest.totalFiles} 個檔案，但包含同一音檔的多種格式`
  );
  console.log(`   實際唯一音檔: ${gcsBaseNames.size} 個`);
  console.log(`   R2 已遷移唯一音檔: ${r2BaseNames.size} 個`);

  const coverage = Math.round((r2BaseNames.size / gcsBaseNames.size) * 100);
  console.log(`   覆蓋率: ${coverage}%`);

  if (coverage >= 95) {
    console.log("\n✅ 遷移基本完成，差異可能是重複檔案或暫存檔");
  }
}

analyzeFiles().catch((error) => {
  console.error("❌ 分析失敗:", error);
  process.exit(1);
});
