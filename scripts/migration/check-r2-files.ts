// scripts/migration/check-r2-files.ts
/**
 * 檢查 R2 中已遷移的檔案數量
 */

import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { r2Config } from "./config";

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function checkR2Files() {
  console.log("🔍 檢查 R2 中的檔案...\n");

  const r2Client = new S3Client({
    region: "auto",
    endpoint: r2Config.endpoint,
    credentials: {
      accessKeyId: r2Config.accessKeyId,
      secretAccessKey: r2Config.secretAccessKey,
    },
  });

  let totalFiles = 0;
  let totalSize = 0;
  let continuationToken: string | undefined;

  do {
    const response = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: r2Config.bucket,
        Prefix: "audio/",
        ContinuationToken: continuationToken,
      })
    );

    const files = response.Contents || [];
    totalFiles += files.length;

    for (const file of files) {
      totalSize += file.Size || 0;
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  console.log(
    "═══════════════════════════════════════════════════════════════\n"
  );
  console.log("✅ R2 音檔統計");
  console.log(`   - 總檔案數: ${totalFiles}`);
  console.log(`   - 總大小: ${formatSize(totalSize)}`);
  console.log(`   - Bucket: ${r2Config.bucket}`);
  console.log(`   - Public URL: ${r2Config.publicUrl}`);
  console.log("");
}

checkR2Files().catch((error) => {
  console.error("❌ 檢查失敗:", error);
  process.exit(1);
});
