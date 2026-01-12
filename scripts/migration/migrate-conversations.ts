// scripts/migration/migrate-conversations.ts

import { conversations } from "../../packages/db/src/schema";
import { db, firestore, migrationConfig, withRetry } from "./config";
import { mapConversation } from "./mappers";
import { migrateAudioFile } from "./migrate-audio";
import { createProgress, loadProgress, saveProgress } from "./progress";
import type { FirestoreConversation, MigrationStats } from "./types";

// 用於追蹤案件編號序列
const caseNumberSequence: Map<string, number> = new Map();

function getNextCaseNumber(yearMonth: string): string {
  const current = caseNumberSequence.get(yearMonth) || 0;
  const next = current + 1;
  caseNumberSequence.set(yearMonth, next);
  return `${yearMonth}-IC${String(next).padStart(3, "0")}`;
}

/**
 * 遷移 Sales Cases → Conversations
 */
export async function migrateConversations(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  console.log("💬 Starting Conversations migration...");

  // 載入進度
  const progress = (await loadProgress()) || createProgress();
  const resumeFromId = progress.lastProcessedConversationId;

  if (resumeFromId) {
    console.log(`Resuming from conversation ID: ${resumeFromId}`);
  }

  // 取得所有 sales_cases
  const casesSnapshot = await firestore
    .collection("sales_cases")
    .orderBy("created_at", "asc") // 按時間排序以正確生成案件編號
    .get();

  stats.total = casesSnapshot.size;
  console.log(`Found ${stats.total} conversations to migrate`);

  // 分批處理
  const docs = casesSnapshot.docs;
  let startIndex = 0;

  // 如果有斷點，找到起始位置
  if (resumeFromId) {
    const resumeIndex = docs.findIndex((doc) => doc.id === resumeFromId);
    if (resumeIndex >= 0) {
      startIndex = resumeIndex + 1;
      stats.skipped = startIndex;
      console.log(`Skipping ${startIndex} already processed conversations`);

      // 重建案件編號序列
      for (let i = 0; i < startIndex; i++) {
        const convData = docs[i].data() as FirestoreConversation;
        const createdAt = convData.created_at?.toDate() || new Date();
        const yearMonth = `${createdAt.getFullYear()}${String(createdAt.getMonth() + 1).padStart(2, "0")}`;
        getNextCaseNumber(yearMonth);
      }
    }
  }

  for (let i = startIndex; i < docs.length; i += migrationConfig.batchSize) {
    const batch = docs.slice(i, i + migrationConfig.batchSize);

    for (const doc of batch) {
      const docId = doc.id;
      const convData = doc.data() as FirestoreConversation;

      try {
        // 檢查 lead_id 是否存在
        if (!convData.lead_id) {
          stats.skipped++;
          console.warn(`Skipping conversation ${docId}: no lead_id`);
          continue;
        }

        // 遷移音檔（如果有）
        let r2AudioUrl: string | undefined;
        if (convData.audio_gcs_uri && !migrationConfig.dryRun) {
          try {
            r2AudioUrl = await migrateAudioFile(convData.audio_gcs_uri, docId);
          } catch (audioError) {
            console.warn(`Failed to migrate audio for ${docId}:`, audioError);
            // 音檔遷移失敗不阻止對話遷移
          }
        }

        // 生成案件編號
        const createdAt = convData.created_at?.toDate() || new Date();
        const yearMonth = `${createdAt.getFullYear()}${String(createdAt.getMonth() + 1).padStart(2, "0")}`;
        const caseNumber = getNextCaseNumber(yearMonth);

        // 映射資料
        const conversation = mapConversation(
          docId,
          convData,
          r2AudioUrl,
          caseNumber
        );

        if (migrationConfig.verbose) {
          console.log(`Migrating conversation ${docId} → ${caseNumber}`);
        }

        // 寫入資料庫
        if (!migrationConfig.dryRun) {
          await withRetry(
            () =>
              db
                .insert(conversations)
                .values(conversation)
                .onConflictDoNothing(),
            `Inserting conversation ${docId}`
          );
        }

        stats.success++;

        // 更新進度
        progress.lastProcessedConversationId = docId;
        await saveProgress(progress);
      } catch (error) {
        stats.failed++;
        stats.errors.push({
          id: docId,
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(`Failed to migrate conversation ${docId}:`, error);
      }
    }

    // 顯示進度
    const processed = Math.min(i + migrationConfig.batchSize, stats.total);
    console.log(
      `Progress: ${processed}/${stats.total} (${Math.round((processed / stats.total) * 100)}%)`
    );
  }

  console.log(
    `✅ Conversations migration complete: ${stats.success} success, ${stats.failed} failed, ${stats.skipped} skipped`
  );
  return stats;
}
