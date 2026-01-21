#!/usr/bin/env node
import { Client } from "pg";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 載入環境變數
config({ path: resolve(__dirname, "../apps/server/.env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("❌ DATABASE_URL 未設定");
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl });

async function main() {
  console.log("📊 建立 share_tokens 表格...\n");

  try {
    await client.connect();
    console.log("✅ 資料庫連線成功");

    // 步驟 1: 建立表格
    console.log("\n[1/4] 建立 share_tokens 表格...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS share_tokens (
        id text PRIMARY KEY NOT NULL,
        conversation_id text NOT NULL,
        token text NOT NULL,
        expires_at timestamp NOT NULL,
        is_revoked boolean DEFAULT false NOT NULL,
        view_count text DEFAULT '0' NOT NULL,
        last_viewed_at timestamp,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL,
        CONSTRAINT share_tokens_token_unique UNIQUE(token)
      );
    `);
    console.log("  ✅ 表格建立成功");

    // 步驟 2: 加入外鍵約束
    console.log("\n[2/4] 加入外鍵約束...");
    try {
      await client.query(`
        ALTER TABLE share_tokens
        ADD CONSTRAINT share_tokens_conversation_id_conversations_id_fk
        FOREIGN KEY (conversation_id)
        REFERENCES conversations(id)
        ON DELETE CASCADE;
      `);
      console.log("  ✅ 外鍵約束加入成功");
    } catch (error) {
      if (error.message.includes("already exists")) {
        console.log("  ⚠️  外鍵約束已存在，跳過");
      } else {
        throw error;
      }
    }

    // 步驟 3: 建立索引
    console.log("\n[3/4] 建立索引...");
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_share_tokens_conversation_id ON share_tokens (conversation_id);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_share_tokens_token ON share_tokens (token);
      `);
      console.log("  ✅ 索引建立成功");
    } catch (error) {
      if (error.message.includes("already exists")) {
        console.log("  ⚠️  索引已存在，跳過");
      } else {
        throw error;
      }
    }

    // 步驟 4: 驗證表格
    console.log("\n[4/4] 驗證表格結構...");
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'share_tokens';
    `);

    if (result.rows.length > 0) {
      console.log("  ✅ share_tokens 表格已存在");

      // 檢查表格結構
      const columns = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'share_tokens'
        ORDER BY ordinal_position;
      `);

      console.log("\n表格結構:");
      console.table(columns.rows);

      console.log("\n✅ Migration 完成！share_tokens 表格已準備就緒。");
    } else {
      console.log("  ❌ 表格建立失敗");
      process.exit(1);
    }

  } catch (error) {
    console.error("\n❌ 執行失敗:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
