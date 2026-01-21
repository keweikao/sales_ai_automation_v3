/**
 * 測試各項服務連線
 */

import { resolve } from "node:path";
import { ListBucketsCommand, S3Client } from "@aws-sdk/client-s3";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "dotenv";

// 載入環境變數
config({ path: resolve(__dirname, "./apps/server/.env") });

console.log("🧪 測試外部服務連線...\n");

// Test 1: Gemini API
async function testGemini() {
  console.log("📋 Step 1: 測試 Gemini API...");
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const result = await model.generateContent("Hi, respond with just 'OK'");
    const response = await result.response;
    const text = response.text();

    if (text) {
      console.log("✅ Gemini API 連線成功");
      return true;
    }
    console.log("❌ Gemini API 回應異常");
    return false;
  } catch (error) {
    console.error("❌ Gemini API 錯誤:", (error as Error).message);
    return false;
  }
}

// Test 2: Groq Whisper API
async function testGroq() {
  console.log("\n📋 Step 2: 測試 Groq API...");
  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
    });

    if (response.ok) {
      console.log("✅ Groq API 認證成功");
      return true;
    }
    console.log("❌ Groq API 認證失敗:", response.status);
    return false;
  } catch (error) {
    console.error("❌ Groq API 錯誤:", (error as Error).message);
    return false;
  }
}

// Test 3: Cloudflare R2
async function testR2() {
  console.log("\n📋 Step 3: 測試 Cloudflare R2...");
  try {
    const s3Client = new S3Client({
      region: "auto",
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY!,
      },
    });

    const command = new ListBucketsCommand({});
    const response = await s3Client.send(command);

    const bucketExists = response.Buckets?.some(
      (b) => b.Name === process.env.CLOUDFLARE_R2_BUCKET
    );

    if (bucketExists) {
      console.log(
        `✅ Cloudflare R2 連線成功,找到 bucket: ${process.env.CLOUDFLARE_R2_BUCKET}`
      );
      return true;
    }
    console.log(
      `⚠️  Cloudflare R2 連線成功,但找不到 bucket: ${process.env.CLOUDFLARE_R2_BUCKET}`
    );
    console.log(
      `   可用的 buckets: ${response.Buckets?.map((b) => b.Name).join(", ")}`
    );
    return false;
  } catch (error) {
    console.error("❌ Cloudflare R2 錯誤:", (error as Error).message);
    return false;
  }
}

// Test 4: Database
async function testDatabase() {
  console.log("\n📋 Step 4: 測試 Database 連線...");
  try {
    // 使用 node-postgres 測試連線
    const { Client } = await import("pg");
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });

    await client.connect();
    const result = await client.query("SELECT 1 as test");
    await client.end();

    if (result.rows[0].test === 1) {
      console.log("✅ Database 連線成功");
      return true;
    }
    console.log("❌ Database 查詢異常");
    return false;
  } catch (error) {
    console.error("❌ Database 錯誤:", (error as Error).message);
    return false;
  }
}

// 執行所有測試
async function runAllTests() {
  const results = {
    gemini: await testGemini(),
    groq: await testGroq(),
    r2: await testR2(),
    database: await testDatabase(),
  };

  console.log(`\n${"=".repeat(60)}`);
  console.log("📊 測試結果:");
  console.log("=".repeat(60));
  console.log(`Gemini API:     ${results.gemini ? "✅ 成功" : "❌ 失敗"}`);
  console.log(`Groq API:       ${results.groq ? "✅ 成功" : "❌ 失敗"}`);
  console.log(`Cloudflare R2:  ${results.r2 ? "✅ 成功" : "❌ 失敗"}`);
  console.log(`Database:       ${results.database ? "✅ 成功" : "❌ 失敗"}`);
  console.log("=".repeat(60));

  const allPassed = Object.values(results).every((r) => r);

  if (allPassed) {
    console.log("\n🎉 所有服務連線測試通過!");
    process.exit(0);
  } else {
    console.log("\n⚠️  部分服務連線測試失敗,請檢查對應的 API Keys");
    process.exit(1);
  }
}

runAllTests().catch((error) => {
  console.error("測試執行錯誤:", error);
  process.exit(1);
});
