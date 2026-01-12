/**
 * Test all external service connections
 * Run: tsx test-connections.ts
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// Get __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from apps/server/.env
config({ path: resolve(__dirname, "../../apps/server/.env") });

import {
  createGeminiClient,
  createGroqWhisperService,
  createR2Service,
  validateEnvironment,
} from "./src/index.js";

async function testConnections() {
  console.log("🧪 Testing External Service Connections...\n");

  // Step 1: Validate environment variables
  console.log("📋 Step 1: Validating environment variables...");
  const envCheck = validateEnvironment();

  if (!envCheck.valid) {
    console.error("❌ Missing required environment variables:");
    envCheck.missing.forEach((key) => console.error(`   - ${key}`));
    process.exit(1);
  }
  console.log("✅ All environment variables are set\n");

  // Step 2: Test Gemini API
  console.log("📋 Step 2: Testing Gemini API...");
  try {
    const gemini = createGeminiClient();
    const geminiOk = await gemini.testConnection();

    if (geminiOk) {
      console.log("✅ Gemini API connection successful");
    } else {
      console.log("❌ Gemini API connection failed");
    }
  } catch (error) {
    console.error("❌ Gemini API error:", (error as Error).message);
  }
  console.log();

  // Step 3: Test Groq Whisper API
  console.log("📋 Step 3: Testing Groq Whisper API...");
  try {
    const _whisper = createGroqWhisperService();
    console.log("✅ Groq Whisper client initialized");
    console.log("   Note: Full transcription test requires audio file");
  } catch (error) {
    console.error("❌ Groq Whisper error:", (error as Error).message);
  }
  console.log();

  // Step 4: Test Cloudflare R2
  console.log("📋 Step 4: Testing Cloudflare R2...");
  try {
    const r2 = createR2Service();
    const r2Ok = await r2.testConnection();

    if (r2Ok) {
      console.log("✅ Cloudflare R2 connection successful");
      console.log(`   Bucket: ${process.env.CLOUDFLARE_R2_BUCKET}`);
    } else {
      console.log("❌ Cloudflare R2 connection failed");
    }
  } catch (error) {
    console.error("❌ Cloudflare R2 error:", (error as Error).message);
  }
  console.log();

  // Step 5: Test prompts loading (will fail until prompts are migrated)
  console.log("📋 Step 5: Testing MEDDIC prompts loading...");
  try {
    const { validatePrompts } = await import("./src/llm/prompts.js");
    const promptsOk = validatePrompts();

    if (promptsOk) {
      console.log("✅ All 7 MEDDIC prompts loaded successfully");
    } else {
      console.log("⚠️  MEDDIC prompts validation failed");
    }
  } catch (_error) {
    console.log("⚠️  MEDDIC prompts not yet migrated from V2");
    console.log("   Action required: Copy 7 prompt files from V2 repository");
    console.log("   See: packages/services/prompts/meddic/README.md");
  }
  console.log();

  console.log("🎉 Connection tests completed!");
  console.log("\n📝 Next steps:");
  console.log("   1. If any service failed, check your API keys in .env");
  console.log("   2. Migrate 7 MEDDIC prompts from V2 (see README.md)");
  console.log("   3. Run full MEDDIC analysis test with sample audio");
}

// Run tests
testConnections().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
