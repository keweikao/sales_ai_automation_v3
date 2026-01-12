// scripts/migration/index.ts

import { migrationConfig } from "./config";
import { migrateConversations } from "./migrate-conversations";
import { migrateLeads } from "./migrate-leads";
import { migrateMeddicAnalyses } from "./migrate-meddic";
import {
  clearProgress,
  isPhaseComplete,
  loadProgress,
  markPhaseComplete,
} from "./progress";
import { generateReport, saveReport } from "./report";
import type { MigrationResult } from "./types";
import { createEmptyStats } from "./types";
import { validateMigration } from "./validate";

async function main() {
  console.log("🚀 Starting V2 → V3 Migration...\n");
  console.log(
    "═══════════════════════════════════════════════════════════════\n"
  );

  if (migrationConfig.dryRun) {
    console.log("⚠️  DRY RUN MODE - No data will be written\n");
  }

  if (migrationConfig.verbose) {
    console.log("📝 VERBOSE MODE - Detailed logging enabled\n");
  }

  // 檢查必要的環境變數
  const requiredEnvVars = [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "DATABASE_URL",
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`❌ Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  // 取得預設使用者 ID（用於 Opportunity）
  const defaultUserId = process.env.MIGRATION_USER_ID;
  if (!defaultUserId) {
    console.error("❌ Missing MIGRATION_USER_ID environment variable");
    console.error(
      "Please set MIGRATION_USER_ID to a valid user ID for the migrated opportunities"
    );
    process.exit(1);
  }

  const startedAt = new Date();
  const startTime = Date.now();

  const result: MigrationResult = {
    leads: createEmptyStats(),
    conversations: createEmptyStats(),
    meddicAnalyses: createEmptyStats(),
    audioFiles: createEmptyStats(),
    duration: 0,
    startedAt,
    completedAt: new Date(),
  };

  try {
    // 檢查是否有未完成的遷移
    const progress = await loadProgress();
    if (progress && progress.completedPhases.length > 0) {
      console.log("📋 Found existing migration progress:");
      console.log(
        `   Completed phases: ${progress.completedPhases.join(", ")}`
      );
      console.log(`   Last updated: ${progress.updatedAt}`);
      console.log("");
    }

    // Phase 1: Migrate Leads → Opportunities
    if (await isPhaseComplete("leads")) {
      console.log(
        "\n📊 Phase 1: Leads migration already completed, skipping...\n"
      );
    } else {
      console.log("\n📊 Phase 1: Migrating Leads...\n");
      result.leads = await migrateLeads(defaultUserId);
      await markPhaseComplete("leads");
    }

    // Phase 2: Migrate Conversations (includes audio)
    if (await isPhaseComplete("conversations")) {
      console.log(
        "\n💬 Phase 2: Conversations migration already completed, skipping...\n"
      );
    } else {
      console.log("\n💬 Phase 2: Migrating Conversations...\n");
      result.conversations = await migrateConversations();
      await markPhaseComplete("conversations");
    }

    // Phase 3: Migrate MEDDIC Analyses
    if (await isPhaseComplete("meddic")) {
      console.log(
        "\n📈 Phase 3: MEDDIC migration already completed, skipping...\n"
      );
    } else {
      console.log("\n📈 Phase 3: Migrating MEDDIC Analyses...\n");
      result.meddicAnalyses = await migrateMeddicAnalyses();
      await markPhaseComplete("meddic");
    }

    // Phase 4: Validate Migration
    console.log("\n🔍 Phase 4: Validating Migration...\n");
    const validation = await validateMigration();

    if (!validation.passed) {
      console.error("\n❌ Validation failed!");
      console.error("Errors:", validation.errors);
      process.exitCode = 1;
    }

    // Generate Report
    result.completedAt = new Date();
    result.duration = (Date.now() - startTime) / 1000;

    const report = generateReport(result);
    console.log("\n" + report);

    // Save report to file
    await saveReport(result);

    if (validation.passed) {
      console.log("\n🎉 Migration completed successfully!\n");
      // 清除進度檔案
      await clearProgress();
    }
  } catch (error) {
    console.error("\n❌ Migration failed with error:", error);
    process.exitCode = 1;
  }
}

main();
