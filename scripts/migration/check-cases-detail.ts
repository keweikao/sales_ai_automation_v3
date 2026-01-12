// scripts/migration/check-cases-detail.ts
import { firestore } from "./config";

async function checkCasesDetail() {
  console.log("檢查 Firestore cases 集合詳細結構...\n");

  try {
    // 取得一筆完整的 case 資料
    const casesSnapshot = await firestore.collection("cases").limit(1).get();

    for (const doc of casesSnapshot.docs) {
      console.log(`=== ${doc.id} ===\n`);
      const data = doc.data();
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("查詢失敗:", error);
  }
}

checkCasesDetail();
