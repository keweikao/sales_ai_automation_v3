// scripts/migration/verify-audio-mapping.ts
/**
 * 音檔對應驗證腳本
 * 驗證 GCS 音檔與 PostgreSQL conversations 的對應關係
 */

import { conversations, db } from "../../packages/db/src/index";

interface AudioManifest {
  exportedAt: string;
  bucket: string;
  totalFiles: number;
  totalSizeBytes: number;
  files: Array<{
    gcsUri: string;
    path: string;
    sizeBytes: number;
    contentType: string;
    createdAt: string;
    conversationId?: string;
  }>;
}

interface VerificationResult {
  matched: number;
  orphanedAudio: string[]; // 有音檔但沒有對應 conversation
  missingAudio: string[]; // 有 conversation 但沒有音檔
  gcsMapped: string[]; // 有 GCS URL 的 conversation（需要遷移）
}

async function verifyAudioMapping() {
  console.log("🔍 驗證音檔對應關係...\n");

  // 讀取 manifest
  const manifestPath = "scripts/migration/data/gcs-audio-manifest.json";
  const manifestFile = Bun.file(manifestPath);

  if (!(await manifestFile.exists())) {
    console.error("❌ 找不到音檔清單檔案");
    console.error("   請先執行: bun run scripts/migration/list-gcs-audio.ts");
    process.exit(1);
  }

  const manifest: AudioManifest = await manifestFile.json();
  console.log(`📋 載入音檔清單: ${manifest.totalFiles} 個檔案\n`);

  // 從 manifest 建立 conversationId -> gcsUri 的對應
  const audioByConversationId = new Map<string, string>();
  for (const file of manifest.files) {
    if (file.conversationId) {
      audioByConversationId.set(file.conversationId, file.gcsUri);
    }
  }

  // 查詢 PostgreSQL 中的所有 conversations
  const dbConversations = await db
    .select({
      id: conversations.id,
      audioUrl: conversations.audioUrl,
      caseNumber: conversations.caseNumber,
    })
    .from(conversations);

  console.log(`📊 資料庫中的對話: ${dbConversations.length} 筆\n`);

  const result: VerificationResult = {
    matched: 0,
    orphanedAudio: [],
    missingAudio: [],
    gcsMapped: [],
  };

  // 追蹤已匹配的音檔
  const matchedAudioIds = new Set<string>();

  // 檢查每個 conversation
  for (const conv of dbConversations) {
    const hasAudioInManifest = audioByConversationId.has(conv.id);
    const hasGcsUrl = conv.audioUrl?.startsWith("gs://");

    if (hasAudioInManifest) {
      result.matched++;
      matchedAudioIds.add(conv.id);
    } else if (hasGcsUrl) {
      // 有 GCS URL 但不在 manifest 中（可能需要手動處理）
      result.gcsMapped.push(conv.id);
    } else if (!conv.audioUrl) {
      // 沒有音檔 URL
      result.missingAudio.push(conv.id);
    }
  }

  // 檢查 orphaned audio（在 manifest 中但沒有對應的 conversation）
  for (const file of manifest.files) {
    if (file.conversationId && !matchedAudioIds.has(file.conversationId)) {
      // 檢查 DB 中是否有這個 conversation
      const exists = dbConversations.some((c) => c.id === file.conversationId);
      if (!exists) {
        result.orphanedAudio.push(file.gcsUri);
      }
    }
  }

  // 輸出結果
  console.log("Verifying audio file mapping...\n");
  console.log(
    "═══════════════════════════════════════════════════════════════\n"
  );

  if (result.orphanedAudio.length === 0) {
    console.log(
      `✅ All ${manifest.totalFiles} audio files have matching conversations`
    );
  } else {
    console.log(
      `⚠️ Found ${result.orphanedAudio.length} orphaned audio files (no matching conversation)`
    );
  }

  console.log(`   - Matched: ${result.matched}`);
  console.log(
    `   - Orphaned (no conversation): ${result.orphanedAudio.length}`
  );
  console.log(
    `   - Missing (conversation but no audio): ${result.missingAudio.length}`
  );
  console.log(`   - GCS URLs to migrate: ${result.gcsMapped.length}`);
  console.log("");

  // 詳細報告
  if (result.orphanedAudio.length > 0) {
    console.log("⚠️ Orphaned audio files (前 10 筆):");
    for (const uri of result.orphanedAudio.slice(0, 10)) {
      console.log(`   - ${uri}`);
    }
    if (result.orphanedAudio.length > 10) {
      console.log(`   ... 還有 ${result.orphanedAudio.length - 10} 筆`);
    }
    console.log("");
  }

  if (result.gcsMapped.length > 0) {
    console.log("📋 需要遷移的 GCS URLs (前 10 筆):");
    for (const id of result.gcsMapped.slice(0, 10)) {
      console.log(`   - Conversation: ${id}`);
    }
    if (result.gcsMapped.length > 10) {
      console.log(`   ... 還有 ${result.gcsMapped.length - 10} 筆`);
    }
    console.log("");
  }

  // 儲存驗證結果
  const reportPath = "scripts/migration/data/audio-mapping-verification.json";
  await Bun.write(
    reportPath,
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        manifestFile: manifestPath,
        totalAudioFiles: manifest.totalFiles,
        totalConversations: dbConversations.length,
        ...result,
      },
      null,
      2
    )
  );

  console.log(`📄 驗證報告已儲存: ${reportPath}`);

  // 回傳是否可以繼續遷移
  const canProceed = result.matched > 0 || result.gcsMapped.length > 0;

  if (canProceed) {
    console.log("\n✅ 驗證完成，可以開始音檔遷移");
  } else {
    console.log("\n⚠️ 沒有找到需要遷移的音檔");
  }

  return result;
}

// 執行
verifyAudioMapping().catch((error) => {
  console.error("❌ 驗證失敗:", error);
  process.exit(1);
});
