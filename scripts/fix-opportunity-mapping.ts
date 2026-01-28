/**
 * 診斷和修復商機關聯錯誤的案件
 *
 * 問題：當 createOpportunity 失敗時，系統會 fallback 到最近的商機，
 * 導致案件的「關聯商機」與用戶填寫的「客戶名稱」不匹配。
 */

import * as dotenv from "dotenv";
import pg from "pg";

// 載入環境變數 (從 apps/server/.env)
dotenv.config({ path: "apps/server/.env" });

interface MismatchedCase {
  conversationId: string;
  caseNumber: string;
  title: string;
  expectedCustomerName: string;
  currentOpportunityId: string;
  currentOpportunityName: string;
  suggestedAction: "create_new" | "link_existing" | "manual_review";
  matchedOpportunityId?: string;
  matchedOpportunityName?: string;
}

async function diagnoseAndFix() {
  console.log("🔍 診斷商機關聯錯誤的案件\n");
  console.log("=".repeat(80));

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("✅ 資料庫連線成功\n");

    // 查詢從 202601-IC001 開始的所有案件，包含關聯的商機
    const casesResult = await client.query(`
      SELECT
        c.id as conversation_id,
        c.case_number,
        c.title,
        c.opportunity_id,
        o.company_name as opportunity_name,
        c.created_at
      FROM conversations c
      LEFT JOIN opportunities o ON c.opportunity_id = o.id
      WHERE c.case_number LIKE '202601-IC%'
      ORDER BY c.case_number
    `);

    console.log(`\n📋 找到 ${casesResult.rows.length} 筆 202601 案件\n`);

    const mismatches: MismatchedCase[] = [];

    for (const c of casesResult.rows) {
      // 從 title 提取預期的客戶名稱
      // title 格式: "客戶名稱 - Slack 上傳" 或 "Slack 上傳: 檔名.m4a"
      let expectedName = "";
      const title = c.title || "";

      if (title.includes(" - Slack 上傳")) {
        expectedName = title.replace(" - Slack 上傳", "").trim();
      } else if (title.startsWith("Slack 上傳: ")) {
        // 從檔名提取（如 "花蓮便當 - 陳晉廷.m4a" → "花蓮便當"）
        const fileName = title.replace("Slack 上傳: ", "");
        if (fileName.includes(" - ")) {
          expectedName = fileName.split(" - ")[0].trim();
        }
      }

      // 如果無法提取預期名稱，跳過
      if (!expectedName) {
        continue;
      }

      // 比對是否匹配
      const currentName = c.opportunity_name || "";
      const isMatch =
        currentName.toLowerCase() === expectedName.toLowerCase() ||
        currentName.toLowerCase().includes(expectedName.toLowerCase()) ||
        expectedName.toLowerCase().includes(currentName.toLowerCase());

      if (!isMatch && expectedName !== currentName) {
        console.log(`❌ 案件 ${c.case_number} 關聯錯誤:`);
        console.log(`   標題: ${c.title}`);
        console.log(`   預期客戶: "${expectedName}"`);
        console.log(`   目前關聯: "${currentName}"`);

        // 搜尋是否有匹配的商機
        const matchResult = await client.query(
          `
          SELECT id, company_name
          FROM opportunities
          WHERE LOWER(company_name) = LOWER($1)
             OR LOWER(company_name) LIKE LOWER($2)
          LIMIT 1
        `,
          [expectedName, `%${expectedName}%`]
        );

        const mismatch: MismatchedCase = {
          conversationId: c.conversation_id,
          caseNumber: c.case_number || "",
          title: c.title || "",
          expectedCustomerName: expectedName,
          currentOpportunityId: c.opportunity_id,
          currentOpportunityName: currentName,
          suggestedAction: "manual_review",
        };

        if (matchResult.rows.length > 0) {
          mismatch.suggestedAction = "link_existing";
          mismatch.matchedOpportunityId = matchResult.rows[0].id;
          mismatch.matchedOpportunityName = matchResult.rows[0].company_name;
          console.log(
            `   ✅ 找到匹配商機: "${matchResult.rows[0].company_name}" (${matchResult.rows[0].id})`
          );
        } else {
          mismatch.suggestedAction = "create_new";
          console.log(`   ⚠️  需要建立新商機: "${expectedName}"`);
        }

        mismatches.push(mismatch);
        console.log("");
      }
    }

    console.log("=".repeat(80));
    console.log(`\n📊 診斷結果:`);
    console.log(`   總案件數: ${casesResult.rows.length}`);
    console.log(`   關聯錯誤: ${mismatches.length}`);

    if (mismatches.length === 0) {
      console.log("\n✅ 沒有發現關聯錯誤的案件！");
      return;
    }

    // 開始修復
    console.log("\n" + "=".repeat(80));
    console.log("\n🔧 開始修復...\n");

    let fixedCount = 0;
    let createdCount = 0;

    for (const mismatch of mismatches) {
      if (
        mismatch.suggestedAction === "link_existing" &&
        mismatch.matchedOpportunityId
      ) {
        // 更新關聯到正確的商機
        await client.query(
          `UPDATE conversations SET opportunity_id = $1 WHERE id = $2`,
          [mismatch.matchedOpportunityId, mismatch.conversationId]
        );

        console.log(
          `✅ ${mismatch.caseNumber}: 已關聯到 "${mismatch.matchedOpportunityName}"`
        );
        fixedCount++;
      } else if (mismatch.suggestedAction === "create_new") {
        // 建立新商機
        const newOpportunityId = crypto.randomUUID();
        const customerNumber = `202601-${String(Date.now()).slice(-6)}`;

        await client.query(
          `
          INSERT INTO opportunities (
            id, user_id, customer_number, company_name,
            source, status, product_line, notes, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        `,
          [
            newOpportunityId,
            "service-account",
            customerNumber,
            mismatch.expectedCustomerName,
            "slack",
            "new",
            "ichef",
            `由修復腳本建立，原案件: ${mismatch.caseNumber}`,
          ]
        );

        // 更新 conversation 關聯
        await client.query(
          `UPDATE conversations SET opportunity_id = $1 WHERE id = $2`,
          [newOpportunityId, mismatch.conversationId]
        );

        console.log(
          `✅ ${mismatch.caseNumber}: 已建立新商機 "${mismatch.expectedCustomerName}" 並關聯`
        );
        fixedCount++;
        createdCount++;
      } else {
        console.log(`⏭️  ${mismatch.caseNumber}: 需要手動檢查`);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log(`\n📊 修復結果:`);
    console.log(`   已修復: ${fixedCount} 筆`);
    console.log(`   新建商機: ${createdCount} 個`);
    console.log(`   需手動處理: ${mismatches.length - fixedCount} 筆`);
  } catch (error) {
    console.error("\n❌ 執行失敗:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// 執行
diagnoseAndFix();
