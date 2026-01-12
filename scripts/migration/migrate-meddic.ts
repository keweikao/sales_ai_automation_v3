// scripts/migration/migrate-meddic.ts

import { meddicAnalyses } from "../../packages/db/src/schema";
import { db, firestore, migrationConfig, withRetry } from "./config";
import { mapMeddicAnalysis } from "./mappers";
import { createProgress, loadProgress, saveProgress } from "./progress";
import type { FirestoreConversation, MigrationStats } from "./types";

/**
 * 遷移 MEDDIC Analyses
 */
export async function migrateMeddicAnalyses(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  console.log("📈 Starting MEDDIC Analyses migration...");

  // 載入進度
  const progress = (await loadProgress()) || createProgress();
  const resumeFromId = progress.lastProcessedMeddicId;

  if (resumeFromId) {
    console.log(`Resuming from MEDDIC ID: ${resumeFromId}`);
  }

  // 取得所有有分析結果的 sales_cases
  const casesSnapshot = await firestore.collection("sales_cases").get();

  // 過濾有 meddic_score 的
  const docsWithAnalysis = casesSnapshot.docs.filter((doc) => {
    const data = doc.data() as FirestoreConversation;
    return data.analysis?.meddic_score !== undefined;
  });

  stats.total = docsWithAnalysis.length;
  console.log(`Found ${stats.total} MEDDIC analyses to migrate`);

  // 找到起始位置
  let startIndex = 0;
  if (resumeFromId) {
    const resumeIndex = docsWithAnalysis.findIndex(
      (doc) => doc.id === resumeFromId
    );
    if (resumeIndex >= 0) {
      startIndex = resumeIndex + 1;
      stats.skipped = startIndex;
      console.log(`Skipping ${startIndex} already processed analyses`);
    }
  }

  // 分批處理
  for (
    let i = startIndex;
    i < docsWithAnalysis.length;
    i += migrationConfig.batchSize
  ) {
    const batch = docsWithAnalysis.slice(i, i + migrationConfig.batchSize);

    for (const doc of batch) {
      const docId = doc.id;
      const convData = doc.data() as FirestoreConversation;

      try {
        // 檢查 lead_id
        if (!convData.lead_id) {
          stats.skipped++;
          continue;
        }

        // 映射資料
        const meddicAnalysis = mapMeddicAnalysis(
          docId,
          convData,
          convData.lead_id
        );

        if (!meddicAnalysis) {
          stats.skipped++;
          continue;
        }

        if (migrationConfig.verbose) {
          console.log(
            `Migrating MEDDIC analysis for ${docId}, score: ${meddicAnalysis.overallScore}`
          );
        }

        // 寫入資料庫
        if (!migrationConfig.dryRun) {
          await withRetry(
            () =>
              db
                .insert(meddicAnalyses)
                .values(meddicAnalysis)
                .onConflictDoNothing(),
            `Inserting MEDDIC analysis ${docId}`
          );
        }

        stats.success++;

        // 更新進度
        progress.lastProcessedMeddicId = docId;
        await saveProgress(progress);
      } catch (error) {
        stats.failed++;
        stats.errors.push({
          id: docId,
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(`Failed to migrate MEDDIC analysis ${docId}:`, error);
      }
    }

    // 顯示進度
    const processed = Math.min(i + migrationConfig.batchSize, stats.total);
    console.log(
      `Progress: ${processed}/${stats.total} (${Math.round((processed / stats.total) * 100)}%)`
    );
  }

  console.log(
    `✅ MEDDIC migration complete: ${stats.success} success, ${stats.failed} failed, ${stats.skipped} skipped`
  );
  return stats;
}
