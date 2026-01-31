/**
 * 比較 AI 分析 vs 規則匹配的結果
 */

import { neon } from "@neondatabase/serverless";
import { createGeminiClient } from "../packages/services/src/llm/gemini";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const gemini = createGeminiClient(process.env.GEMINI_API_KEY);

  // 抽樣 5 筆有足夠內容的對話
  const samples = await sql`
    SELECT c.id, c.transcript, cvt.features_mentioned, cvt.pain_tags, cvt.objection_tags
    FROM conversations c
    JOIN customer_voice_tags cvt ON cvt.conversation_id = c.id
    WHERE c.status = 'completed'
      AND cvt.total_sentences > 50
      AND cvt.rule_matched_count > 10
    ORDER BY RANDOM()
    LIMIT 5
  `;

  console.log(`抽樣 ${samples.length} 筆對話進行 AI vs 規則比較\n`);

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i] as {
      id: string;
      transcript: string | { fullText?: string };
      features_mentioned: Array<{ tag: string }>;
      pain_tags: Array<{ tag: string }>;
      objection_tags: Array<{ tag: string }>;
    };

    const transcript =
      typeof sample.transcript === "string"
        ? sample.transcript
        : sample.transcript?.fullText || "";

    console.log("\n" + "=".repeat(60));
    console.log(`樣本 ${i + 1}: ${sample.id}`);
    console.log("=".repeat(60));

    // 取前 2000 字進行分析
    const textSample = transcript.substring(0, 2000);

    // 規則匹配結果（從資料庫）
    console.log("\n📋 【規則匹配結果】");
    console.log(
      "Features:",
      sample.features_mentioned
        ?.slice(0, 5)
        .map((f) => f.tag)
        .join(", ") || "無"
    );
    console.log(
      "Pains:",
      sample.pain_tags
        ?.slice(0, 3)
        .map((p) => p.tag)
        .join(", ") || "無"
    );
    console.log(
      "Objections:",
      sample.objection_tags
        ?.slice(0, 3)
        .map((o) => o.tag)
        .join(", ") || "無"
    );

    // AI 分析
    console.log("\n🤖 【AI 分析結果】");
    try {
      const aiPrompt = `你是一個銷售對話分析專家。請分析以下 iCHEF POS 系統的銷售對話，提取：

1. **功能需求** (Features): 客戶提到或詢問的產品功能
2. **痛點** (Pain Points): 客戶目前遇到的問題或困擾
3. **異議** (Objections): 客戶對購買的顧慮或反對意見
4. **競品提及** (Competitors): 提到的其他競爭產品

請用 JSON 格式回覆：
{
  "features": ["功能1", "功能2"],
  "pains": ["痛點1", "痛點2"],
  "objections": ["異議1", "異議2"],
  "competitors": ["競品1"],
  "insights": "一句話總結這個對話的關鍵洞察"
}

對話內容：
${textSample}`;

      const response = await gemini.generateJSON(aiPrompt);

      console.log("Features:", response.features?.join(", ") || "無");
      console.log("Pains:", response.pains?.join(", ") || "無");
      console.log("Objections:", response.objections?.join(", ") || "無");
      console.log("Competitors:", response.competitors?.join(", ") || "無");
      console.log("\n💡 AI 洞察:", response.insights || "無");
    } catch (error) {
      console.log(
        "AI 分析失敗:",
        error instanceof Error ? error.message : error
      );
    }

    // 稍微等待避免 rate limit
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("\n\n✅ 比較完成");
}

main().catch(console.error);
