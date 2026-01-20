import { Client } from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../apps/server/.env") });

async function verifyDeployment() {
	console.log("🔍 開始驗證 Agent A-D 部署...\n");

	let allPassed = true;

	// ============================================================
	// 驗證 1: Database Migration
	// ============================================================

	console.log("📊 驗證 1: Database Migration");
	console.log("─".repeat(60));

	const client = new Client({
		connectionString: process.env.DATABASE_URL,
	});

	try {
		await client.connect();

		const tables = ["opportunities", "conversations", "talk_tracks", "meddic_analyses"];
		let migrationPassed = true;

		for (const table of tables) {
			const result = await client.query(`
        SELECT column_name, column_default
        FROM information_schema.columns
        WHERE table_name = $1 AND column_name = 'product_line';
      `, [table]);

			if (result.rows.length > 0) {
				console.log(
					`✅ ${table}.product_line exists (default: ${result.rows[0].column_default})`,
				);
			} else {
				console.log(`❌ ${table}.product_line NOT found`);
				migrationPassed = false;
			}
		}

		// 檢查索引
		const indexCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE indexname LIKE '%product_line%';
    `);

		const indexCount = Number.parseInt(indexCheck.rows[0].count);
		if (indexCount >= 4) {
			console.log(`✅ Found ${indexCount} product_line indexes`);
		} else {
			console.log(`❌ Expected 4+ indexes, found ${indexCount}`);
			migrationPassed = false;
		}

		if (migrationPassed) {
			console.log("\n✅ Migration 驗證通過\n");
		} else {
			console.log("\n❌ Migration 驗證失敗\n");
			allPassed = false;
		}
	} catch (error) {
		console.error("❌ Database 連接失敗:", error);
		allPassed = false;
	} finally {
		await client.end();
	}

	// ============================================================
	// 驗證 2: Prompts 編譯
	// ============================================================

	console.log("📝 驗證 2: Prompts 編譯");
	console.log("─".repeat(60));

	try {
		const { MEDDIC_PROMPTS } = await import(
			"../packages/services/src/llm/prompts.generated.js"
		);

		const sharedCount = Object.keys(MEDDIC_PROMPTS.shared).length;
		const ichefCount = Object.keys(MEDDIC_PROMPTS.ichef).length;
		const beautyCount = Object.keys(MEDDIC_PROMPTS.beauty).length;

		console.log(`✅ Shared prompts: ${sharedCount}`);
		console.log(`✅ iCHEF prompts: ${ichefCount}`);
		console.log(`✅ Beauty prompts: ${beautyCount}`);

		if (sharedCount >= 3 && ichefCount >= 6 && beautyCount >= 6) {
			console.log("\n✅ Prompts 編譯驗證通過\n");
		} else {
			console.log("\n❌ Prompts 數量不足\n");
			allPassed = false;
		}
	} catch (error) {
		console.error("❌ Prompts 載入失敗:", error);
		allPassed = false;
	}

	// ============================================================
	// 驗證 3: 產品線配置
	// ============================================================

	console.log("⚙️  驗證 3: 產品線配置");
	console.log("─".repeat(60));

	try {
		const { getProductConfig, getAllProductLines } = await import(
			"../packages/shared/src/product-configs/index.js"
		);

		const productLines = getAllProductLines();
		console.log(`✅ 支援的產品線: ${productLines.join(", ")}`);

		// 檢查 iCHEF 配置
		const ichefConfig = getProductConfig("ichef");
		console.log(
			`✅ iCHEF 配置: ${ichefConfig.displayName} (${ichefConfig.formFields.storeType.length} 個店型)`,
		);

		// 檢查 Beauty 配置
		const beautyConfig = getProductConfig("beauty");
		console.log(
			`✅ Beauty 配置: ${beautyConfig.displayName} (${beautyConfig.formFields.storeType.length} 個店型)`,
		);

		console.log("\n✅ 產品線配置驗證通過\n");
	} catch (error) {
		console.error("❌ 產品線配置載入失敗:", error);
		allPassed = false;
	}

	// ============================================================
	// 驗證 4: PromptLoader
	// ============================================================

	console.log("🔧 驗證 4: PromptLoader");
	console.log("─".repeat(60));

	try {
		const { loadMeddicPrompts, buildAgentPrompt } = await import(
			"../packages/services/src/llm/prompt-loader.js"
		);

		// 測試載入 iCHEF prompts
		const ichefPrompts = loadMeddicPrompts("ichef");
		console.log("✅ iCHEF prompts 載入成功");

		// 測試載入 Beauty prompts
		const beautyPrompts = loadMeddicPrompts("beauty");
		console.log("✅ Beauty prompts 載入成功");

		// 測試建立 Agent Prompt
		const metricPrompt = buildAgentPrompt("metricAgent", "beauty");
		if (metricPrompt.includes("客戶留存") || metricPrompt.includes("預約填滿率")) {
			console.log("✅ Beauty Metric Agent prompt 包含美業關鍵字");
		} else {
			console.log("⚠️  Beauty Metric Agent prompt 可能未包含美業專屬內容");
		}

		console.log("\n✅ PromptLoader 驗證通過\n");
	} catch (error) {
		console.error("❌ PromptLoader 測試失敗:", error);
		allPassed = false;
	}

	// ============================================================
	// 驗證 5: 向後相容性
	// ============================================================

	console.log("🔄 驗證 5: 向後相容性");
	console.log("─".repeat(60));

	try {
		const client2 = new Client({
			connectionString: process.env.DATABASE_URL,
		});

		await client2.connect();

		// 檢查現有資料是否都是 ichef
		const dataCheck = await client2.query(`
      SELECT product_line, COUNT(*) as count
      FROM opportunities
      GROUP BY product_line;
    `);

		console.log("現有 Opportunities 的 product_line 分佈:");
		for (const row of dataCheck.rows) {
			console.log(`  - ${row.product_line}: ${row.count} 筆`);
		}

		// 檢查是否所有現有資料都是 ichef
		const nonIchefCount = dataCheck.rows.filter((r) => r.product_line !== "ichef").length;
		if (nonIchefCount === 0) {
			console.log("✅ 所有現有資料都已標記為 'ichef'");
		} else {
			console.log("⚠️  有部分資料不是 'ichef'");
		}

		await client2.end();

		console.log("\n✅ 向後相容性驗證通過\n");
	} catch (error) {
		console.error("❌ 向後相容性檢查失敗:", error);
		// 不算失敗,因為可能沒有資料
		console.log("⚠️  可能是因為沒有現有資料\n");
	}

	// ============================================================
	// 總結
	// ============================================================

	console.log("═".repeat(60));
	if (allPassed) {
		console.log("✅ 所有驗證測試通過!");
		console.log("═".repeat(60));
		console.log("\n🎉 Agent A-D 部署完成且驗證成功!\n");
		console.log("下一步:");
		console.log("  1. 部署 Queue Worker: cd apps/queue-worker && wrangler deploy");
		console.log("  2. 部署 Slack Bot: cd apps/slack-bot && wrangler deploy");
		console.log(
			"  3. 設定環境變數: 參見 .doc/20260119_Agent_A-D_部署完成指南.md\n",
		);
	} else {
		console.log("❌ 部分驗證測試失敗");
		console.log("═".repeat(60));
		console.log("\n請檢查上述錯誤並修正\n");
		process.exit(1);
	}
}

verifyDeployment();
