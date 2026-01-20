/**
 * 簡單的資料庫查詢 - 使用 pg 直接連線
 */

import * as dotenv from "dotenv";
import pg from "pg";

// 載入環境變數
dotenv.config();

async function checkDatabase() {
  console.log("🔍 檢查最新的 Conversations 記錄\n");
  console.log("=".repeat(80));

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("✅ 資料庫連線成功\n");

    // 查詢最新的 5 筆 conversations
    const convResult = await client.query(`
      SELECT
        id,
        opportunity_id,
        title,
        transcription_status,
        audio_url,
        created_at,
        updated_at
      FROM conversations
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (convResult.rows.length === 0) {
      console.log("⚠️  資料庫中沒有任何 conversation 記錄\n");
      console.log("可能的原因:");
      console.log("  1. Slack Bot 尚未成功接收到音檔");
      console.log("  2. 上傳過程中發生錯誤");
      return;
    }

    console.log(`✅ 找到 ${convResult.rows.length} 筆記錄:\n`);

    for (const conv of convResult.rows) {
      console.log(`📝 Conversation ID: ${conv.id}`);
      console.log(`   Opportunity ID: ${conv.opportunity_id}`);
      console.log(`   標題: ${conv.title || "無標題"}`);
      console.log(`   狀態: ${conv.transcription_status}`);
      if (conv.audio_url) {
        console.log(`   音檔 URL: ${conv.audio_url.substring(0, 60)}...`);
      }
      console.log(`   建立時間: ${conv.created_at}`);
      console.log(`   更新時間: ${conv.updated_at}`);

      // 檢查是否有 MEDDIC 分析結果
      const analysisResult = await client.query(
        `
        SELECT
          overall_score,
          qualification_status,
          created_at
        FROM meddic_analyses
        WHERE conversation_id = $1
        LIMIT 1
      `,
        [conv.id]
      );

      if (analysisResult.rows.length > 0) {
        const analysis = analysisResult.rows[0];
        console.log("   ✅ MEDDIC 分析: 已完成");
        console.log(`      - 總分: ${analysis.overall_score}`);
        console.log(`      - 狀態: ${analysis.qualification_status}`);
        console.log(`      - 分析時間: ${analysis.created_at}`);
      } else {
        console.log("   ⏳ MEDDIC 分析: 處理中或失敗");
      }

      console.log("");
    }

    // 統計資訊
    const statsResult = await client.query(`
      SELECT
        transcription_status,
        COUNT(*) as count
      FROM conversations
      WHERE created_at >= NOW() - INTERVAL '1 hour'
      GROUP BY transcription_status
    `);

    console.log("=".repeat(80));
    console.log("\n📊 過去 1 小時的狀態統計:");

    if (statsResult.rows.length === 0) {
      console.log("   無記錄");
    } else {
      for (const stat of statsResult.rows) {
        const emoji =
          stat.transcription_status === "completed"
            ? "✅"
            : stat.transcription_status === "processing"
              ? "🔄"
              : stat.transcription_status === "failed"
                ? "❌"
                : "⏸️";
        console.log(`   ${emoji} ${stat.transcription_status}: ${stat.count}`);
      }
    }

    console.log("");
  } catch (error) {
    console.error("\n❌ 查詢失敗:", error);
    console.error("\n請檢查:");
    console.error("  1. DATABASE_URL 環境變數是否正確設定");
    console.error("  2. 資料庫是否可連線");
    process.exit(1);
  } finally {
    await client.end();
  }
}

// 執行檢查
checkDatabase();
