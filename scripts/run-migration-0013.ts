/**
 * 執行 Migration 0013
 * 用途：新增 conversations 表的搜尋索引
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function runMigration() {
	console.log("🚀 開始執行 Migration 0013...\n");

	// 讀取 .env 檔案取得 DATABASE_URL
	const envPath = join(process.cwd(), "apps/server/.env");
	const envContent = readFileSync(envPath, "utf-8");
	const databaseUrlMatch = envContent.match(/DATABASE_URL=(.+)/);

	if (!databaseUrlMatch) {
		throw new Error("找不到 DATABASE_URL");
	}

	const DATABASE_URL = databaseUrlMatch[1].trim();
	console.log("📡 連接資料庫...\n");

	const sql = neon(DATABASE_URL);

	const migrationSQL = readFileSync(
		join(
			process.cwd(),
			"packages/db/migrations/0013_add_conversation_search_indexes.sql"
		),
		"utf-8"
	);

	console.log("📄 Migration 檔案：0013_add_conversation_search_indexes.sql");
	console.log("⏳ 執行 SQL...\n");

	try {
		// 分割多個 SQL 語句並逐一執行
		const statements = migrationSQL
			.split(";")
			.map((s) => s.trim())
			.filter((s) => s && !s.startsWith("--") && s.length > 0);

		for (const statement of statements) {
			console.log(`執行：${statement.substring(0, 80)}...`);
			await (sql as any).query(statement, [], {
				fullResults: false,
			});
		}

		console.log("\n✅ Migration 0013 完成！");
		console.log("已建立以下索引：");
		console.log("  - idx_conversations_store_name (店名搜尋)");
		console.log("  - idx_conversations_opp_created (最新對話查詢)");
	} catch (error) {
		console.error("❌ Migration 執行失敗:", error);
		throw error;
	}
}

runMigration().catch((error) => {
	console.error("❌ Migration failed:", error);
	process.exit(1);
});
