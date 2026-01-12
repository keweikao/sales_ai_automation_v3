// scripts/migration/check-cases-complete.ts
import { firestore } from "./config";

async function checkCasesComplete() {
  console.log("檢查有完整資料的 cases...\n");

  try {
    // 查找有 transcription 資料的 cases
    const casesSnapshot = await firestore
      .collection("cases")
      .where("status", "==", "completed")
      .limit(2)
      .get();

    console.log(`找到 ${casesSnapshot.size} 筆已完成的 cases\n`);

    for (const doc of casesSnapshot.docs) {
      console.log(`=== ${doc.id} ===`);
      const data = doc.data();

      // 顯示主要欄位
      console.log("主要欄位:");
      console.log("  - customerId:", data.customerId);
      console.log("  - customerName:", data.customerName);
      console.log("  - caseId:", data.caseId);
      console.log("  - salesRepName:", data.salesRepName);
      console.log("  - salesRepEmail:", data.salesRepEmail);
      console.log("  - unit:", data.unit);
      console.log("  - status:", data.status);
      console.log("  - sourceType:", data.sourceType);

      // Audio 資訊
      if (data.audio) {
        console.log("\nAudio:");
        console.log("  - url:", data.audio.url?.substring(0, 80) + "...");
        console.log("  - duration:", data.audio.duration);
        console.log("  - mimeType:", data.audio.mimeType);
      }

      // Transcription 資訊
      if (data.transcription) {
        console.log("\nTranscription:");
        console.log("  - fullText 長度:", data.transcription.fullText?.length);
        console.log("  - segments 數量:", data.transcription.segments?.length);
        console.log("  - language:", data.transcription.language);
      }

      // 時間戳
      console.log("\n時間:");
      console.log("  - createdAt:", data.createdAt?._seconds);
      console.log("  - updatedAt:", data.updatedAt?._seconds);

      console.log("\n" + "=".repeat(50) + "\n");
    }

    // 也檢查一下非 completed 狀態的數量
    const allSnapshot = await firestore.collection("cases").count().get();
    const completedSnapshot = await firestore
      .collection("cases")
      .where("status", "==", "completed")
      .count()
      .get();

    console.log(`\n總計: ${allSnapshot.data().count} 筆 cases`);
    console.log(`已完成: ${completedSnapshot.data().count} 筆`);

  } catch (error) {
    console.error("查詢失敗:", error);
  }
}

checkCasesComplete();
