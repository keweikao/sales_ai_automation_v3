// scripts/migration/migrate-leads.ts

import { opportunities } from "../../packages/db/src/schema";
import { db, firestore, migrationConfig, withRetry } from "./config";
import { mapLeadToOpportunity } from "./mappers";
import { createProgress, loadProgress, saveProgress } from "./progress";
import type {
  FirestoreConversation,
  FirestoreLead,
  MigrationStats,
} from "./types";

/**
 * 遷移 Leads → Opportunities
 */
export async function migrateLeads(
  defaultUserId: string
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  console.log("📊 Starting Leads migration...");

  // 載入進度
  const progress = (await loadProgress()) || createProgress();
  const resumeFromId = progress.lastProcessedLeadId;

  if (resumeFromId) {
    console.log(`Resuming from lead ID: ${resumeFromId}`);
  }

  // 取得所有 leads
  const leadsSnapshot = await firestore.collection("leads").get();
  stats.total = leadsSnapshot.size;

  console.log(`Found ${stats.total} leads to migrate`);

  // 分批處理
  const docs = leadsSnapshot.docs;
  let startIndex = 0;

  // 如果有斷點，找到起始位置
  if (resumeFromId) {
    const resumeIndex = docs.findIndex((doc) => doc.id === resumeFromId);
    if (resumeIndex >= 0) {
      startIndex = resumeIndex + 1;
      stats.skipped = startIndex;
      console.log(`Skipping ${startIndex} already processed leads`);
    }
  }

  for (let i = startIndex; i < docs.length; i += migrationConfig.batchSize) {
    const batch = docs.slice(i, i + migrationConfig.batchSize);

    for (const doc of batch) {
      const docId = doc.id;
      const leadData = doc.data() as FirestoreLead;

      try {
        // 取得該 lead 的最新對話（用於提取 company_name）
        const conversationsSnapshot = await withRetry(
          () =>
            firestore
              .collection("sales_cases")
              .where("lead_id", "==", docId)
              .orderBy("created_at", "desc")
              .limit(1)
              .get(),
          `Fetching conversations for lead ${docId}`
        );

        const latestConversation = conversationsSnapshot.docs[0]?.data() as
          | FirestoreConversation
          | undefined;

        // 映射資料
        const opportunity = mapLeadToOpportunity(
          docId,
          leadData,
          latestConversation,
          defaultUserId
        );

        if (migrationConfig.verbose) {
          console.log(
            `Migrating lead ${docId} → opportunity ${opportunity.customerNumber}`
          );
        }

        // 寫入資料庫
        if (!migrationConfig.dryRun) {
          await withRetry(
            () =>
              db
                .insert(opportunities)
                .values(opportunity)
                .onConflictDoNothing(),
            `Inserting opportunity ${docId}`
          );
        }

        stats.success++;

        // 更新進度
        progress.lastProcessedLeadId = docId;
        await saveProgress(progress);
      } catch (error) {
        stats.failed++;
        stats.errors.push({
          id: docId,
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(`Failed to migrate lead ${docId}:`, error);
      }
    }

    // 顯示進度
    const processed = Math.min(i + migrationConfig.batchSize, stats.total);
    console.log(
      `Progress: ${processed}/${stats.total} (${Math.round((processed / stats.total) * 100)}%)`
    );
  }

  console.log(
    `✅ Leads migration complete: ${stats.success} success, ${stats.failed} failed`
  );
  return stats;
}
