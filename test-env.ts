/**
 * 簡單的環境變數測試腳本
 */

import { resolve } from "node:path";
import { config } from "dotenv";

// 載入環境變數
config({ path: resolve(__dirname, "./apps/server/.env") });

console.log("🧪 測試環境變數設定...\n");

const requiredVars = {
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_URL_DIRECT: process.env.DATABASE_URL_DIRECT,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  CLOUDFLARE_R2_ACCESS_KEY: process.env.CLOUDFLARE_R2_ACCESS_KEY,
  CLOUDFLARE_R2_SECRET_KEY: process.env.CLOUDFLARE_R2_SECRET_KEY,
  CLOUDFLARE_R2_BUCKET: process.env.CLOUDFLARE_R2_BUCKET,
  CLOUDFLARE_R2_ENDPOINT: process.env.CLOUDFLARE_R2_ENDPOINT,
  SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
  SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET,
};

let allSet = true;

for (const [key, value] of Object.entries(requiredVars)) {
  if (value) {
    console.log(
      `✅ ${key}: ***${value.substring(0, 3)}...${value.substring(value.length - 3)}***`
    );
  } else {
    console.log(`❌ ${key}: NOT SET`);
    allSet = false;
  }
}

console.log(`\n${"=".repeat(60)}`);

if (allSet) {
  console.log("✅ 所有必要環境變數已設定!");
  process.exit(0);
} else {
  console.log("❌ 部分環境變數未設定");
  process.exit(1);
}
