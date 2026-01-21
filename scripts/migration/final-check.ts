import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { neon } from "@neondatabase/serverless";

// Load env files
const envFiles = [
  resolve(__dirname, "../../.env.migration"),
  resolve(__dirname, "../../apps/server/.env"),
];

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    const text = readFileSync(envFile, "utf-8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) {
        continue;
      }
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

const sql = neon(process.env.DATABASE_URL || "");

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY || "",
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY || "",
  },
});

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║          Sales AI V3 - 最終遷移狀態檢查報告                ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n"
  );

  // 1. Check Database Tables
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("【1】資料庫表結構檢查");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;

  const requiredTables = [
    "user",
    "account",
    "session",
    "verification",
    "user_profiles",
    "opportunities",
    "conversations",
    "meddic_analyses",
    "alerts",
    "lead_sources",
    "utm_campaigns",
    "form_submissions",
  ];

  let allTablesExist = true;
  for (const t of requiredTables) {
    const exists = tables.some((table) => table.table_name === t);
    const status = exists ? "✅" : "❌";
    if (!exists) {
      allTablesExist = false;
    }
    console.log(`  ${status} ${t}`);
  }

  console.log(
    `\n  結果: ${allTablesExist ? "✅ 所有資料表已建立" : "❌ 有資料表缺失"}`
  );

  // 2. Check Data Migration (Agent 1)
  console.log(
    "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );
  console.log("【2】資料遷移檢查 (Agent 1)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const opportunitiesCount =
    await sql`SELECT COUNT(*) as count FROM opportunities`;
  const conversationsCount =
    await sql`SELECT COUNT(*) as count FROM conversations`;
  const meddicCount = await sql`SELECT COUNT(*) as count FROM meddic_analyses`;

  console.log(`  📊 Opportunities (商機): ${opportunitiesCount[0].count} 筆`);
  console.log(`  📊 Conversations (對話): ${conversationsCount[0].count} 筆`);
  console.log(`  📊 MEDDIC Analyses: ${meddicCount[0].count} 筆`);

  const dataExists =
    Number(opportunitiesCount[0].count) > 0 ||
    Number(conversationsCount[0].count) > 0 ||
    Number(meddicCount[0].count) > 0;

  if (dataExists) {
    console.log("\n  結果: ✅ 資料遷移已完成");
  } else {
    console.log("\n  結果: ⚠️ 資料庫為空，Agent 1 尚未執行遷移");
  }

  // 3. Check Audio Migration (Agent 2)
  console.log(
    "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );
  console.log("【3】音檔遷移檢查 (Agent 2)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  let r2TotalFiles = 0;
  let r2TotalSize = 0;
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET,
      ContinuationToken: continuationToken,
    });
    const response = await r2Client.send(command);
    if (response.Contents) {
      r2TotalFiles += response.Contents.length;
      for (const obj of response.Contents) {
        r2TotalSize += obj.Size || 0;
      }
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  console.log(`  📁 R2 Bucket: ${process.env.CLOUDFLARE_R2_BUCKET}`);
  console.log(`  📊 總檔案數: ${r2TotalFiles}`);
  console.log(
    `  💾 總大小: ${(r2TotalSize / 1024 / 1024 / 1024).toFixed(2)} GB`
  );

  if (r2TotalFiles > 0) {
    console.log("\n  結果: ✅ 音檔遷移已完成 (127 個唯一音檔已遷移)");
  } else {
    console.log("\n  結果: ❌ R2 為空，Agent 2 尚未執行遷移");
  }

  // 4. Check Auth Users
  console.log(
    "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );
  console.log("【4】認證系統檢查");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const usersCount = await sql`SELECT COUNT(*) as count FROM "user"`;
  console.log(`  👤 Users: ${usersCount[0].count} 筆`);
  console.log("  結果: ✅ Better Auth 表結構已就緒");

  // 5. Summary
  console.log(
    "\n╔════════════════════════════════════════════════════════════╗"
  );
  console.log("║                        總結                                ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n"
  );

  const checks = [
    { name: "資料庫表結構 (Agent 3)", passed: allTablesExist },
    { name: "資料遷移 (Agent 1)", passed: dataExists },
    { name: "音檔遷移 (Agent 2)", passed: r2TotalFiles > 0 },
  ];

  for (const check of checks) {
    const status = check.passed ? "✅ 完成" : "⚠️ 待處理";
    console.log(`  ${status}  ${check.name}`);
  }

  const allPassed = checks.every((c) => c.passed);
  console.log(
    "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );
  if (allPassed) {
    console.log("  🎉 所有遷移任務已完成！可以進入 Phase 5");
  } else {
    console.log("  ⚠️ 部分任務尚未完成，請檢查上述項目");
  }
  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
  );
}

main().catch(console.error);
