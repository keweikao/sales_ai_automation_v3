/**
 * Test MEDDIC analysis for a specific conversation
 * Usage: bun run scripts/test-meddic-analysis.ts
 */

import { Client } from "pg";
import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../apps/server/.env") });

import {
  createGeminiClient,
  createOrchestrator,
} from "../packages/services/src/index.js";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // 獲取 transcript
  const result = await client.query(
    `
    SELECT transcript, opportunity_id, id as conversation_id
    FROM conversations
    WHERE case_number = $1;
  `,
    ["202601-IC008"]
  );

  const row = result.rows[0];
  console.log("Transcript segments:", row.transcript?.segments?.length);

  // 嘗試執行 MEDDIC 分析
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.error("Missing GEMINI_API_KEY");
    process.exit(1);
  }

  console.log("Starting MEDDIC analysis...");
  const geminiClient = createGeminiClient(geminiApiKey);
  const orchestrator = createOrchestrator(geminiClient);

  try {
    const segments =
      row.transcript?.segments?.map(
        (seg: { speaker?: string; text: string; start: number; end: number }) => ({
          speaker: seg.speaker || "Unknown",
          text: seg.text,
          start: seg.start,
          end: seg.end,
        })
      ) || [];

    console.log("Analyzing", segments.length, "segments...");

    const analysisResult = await orchestrator.analyze(segments, {
      leadId: row.opportunity_id,
      conversationId: row.conversation_id,
      salesRep: "Unknown",
      conversationDate: new Date(),
      productLine: "ichef",
    });

    console.log("Analysis completed!");
    console.log("Overall score:", analysisResult.overallScore);
  } catch (error) {
    console.error("Analysis failed:", (error as Error).message);
    console.error("Stack:", (error as Error).stack);
  }

  await client.end();
}

main();
