/**
 * Daily Voice Tagging Handler
 * 每日批次處理已分析的對話，提取客戶聲音標籤
 */

import { processConversationVoiceTags } from "@Sales_ai_automation_v3/services";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

interface Env {
  DATABASE_URL: string;
  GEMINI_API_KEY: string;
  GEMINI_API_KEY_ICHEF?: string;
  GEMINI_API_KEY_BEAUTY?: string;
}

interface ConversationToProcess {
  id: string;
  transcript: string | { fullText?: string } | null;
  opportunityId: string | null;
  productLine: string | null;
  salesRepId: string | null;
  conversationDate: string | null;
}

// SQL 查詢結果型別
interface StatRow {
  product_line: string;
  total_conversations: string;
  total_sentences: string;
  ai_calls: string;
}

interface FeatureRow {
  tag: string;
  mention_count: string;
  unique_convs: string;
  sample_quotes: string[] | null;
}

interface PainRow {
  tag: string;
  count: string;
  common_severity: string;
}

interface ObjectionRow {
  tag: string;
  count: string;
}

interface CompetitorRow {
  name: string;
  count: string;
  positive: string;
  negative: string;
  neutral: string;
}

/**
 * 每日 Voice Tagging Handler
 * 在每日 00:30 (UTC+8) 執行
 */
export async function handleDailyVoiceTagging(env: Env): Promise<void> {
  const startTime = Date.now();
  console.log("[VoiceTagging] Starting daily voice tagging...");

  const sql = neon(env.DATABASE_URL);

  // 1. 撈取昨日已分析的對話
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split("T")[0] as string;

  console.log(`[VoiceTagging] Processing conversations from ${dateStr}`);

  const conversations = (await sql`
    SELECT
      c.id,
      c.transcript,
      c.opportunity_id as "opportunityId",
      c.product_line as "productLine",
      c.created_by as "salesRepId",
      c.conversation_date as "conversationDate"
    FROM conversations c
    LEFT JOIN customer_voice_tags cvt ON cvt.conversation_id = c.id
    WHERE c.status = 'completed'
      AND c.analyzed_at::date = ${dateStr}::date
      AND c.transcript IS NOT NULL
      AND cvt.id IS NULL
  `) as ConversationToProcess[];

  if (conversations.length === 0) {
    console.log("[VoiceTagging] No new conversations to process");
    return;
  }

  console.log(
    `[VoiceTagging] Processing ${conversations.length} conversations`
  );

  // Helper: 根據 productLine 取得對應的 Gemini API Key
  const getGeminiApiKey = (productLine: string): string => {
    if (productLine === "beauty" && env.GEMINI_API_KEY_BEAUTY) {
      return env.GEMINI_API_KEY_BEAUTY;
    }
    if (productLine === "ichef" && env.GEMINI_API_KEY_ICHEF) {
      return env.GEMINI_API_KEY_ICHEF;
    }
    return env.GEMINI_API_KEY;
  };

  // 統計
  let totalAICalls = 0;
  let totalSentences = 0;
  let processedCount = 0;
  let failedCount = 0;

  // 2. 批次處理
  for (const conv of conversations) {
    try {
      const productLine = (conv.productLine || "ichef") as "ichef" | "beauty";
      const geminiApiKey = getGeminiApiKey(productLine);

      // 處理逐字稿
      const result = await processConversationVoiceTags(
        conv.transcript || "",
        productLine,
        geminiApiKey
      );

      totalAICalls += result.aiCalls;
      totalSentences += result.totalSentences;

      // 儲存結果
      const tagId = randomUUID();
      const conversationDate = conv.conversationDate || dateStr;

      await sql`
        INSERT INTO customer_voice_tags (
          id, conversation_id, opportunity_id, product_line,
          features_mentioned, pain_tags, objection_tags,
          competitor_mentions, decision_factors,
          total_sentences, rule_matched_count, ai_processed_count, skipped_count,
          conversation_date, sales_rep_id, processing_time_ms
        ) VALUES (
          ${tagId},
          ${conv.id},
          ${conv.opportunityId},
          ${productLine},
          ${JSON.stringify(result.features)}::jsonb,
          ${JSON.stringify(result.pains)}::jsonb,
          ${JSON.stringify(result.objections)}::jsonb,
          ${JSON.stringify(result.competitors)}::jsonb,
          ${JSON.stringify(result.decisionFactors)}::jsonb,
          ${result.totalSentences},
          ${result.ruleMatched},
          ${result.aiProcessed},
          ${result.skipped},
          ${conversationDate}::date,
          ${conv.salesRepId},
          ${result.processingTime}
        )
      `;

      processedCount++;
      console.log(
        `[VoiceTagging] Processed ${conv.id}: ${result.features.length} features, ${result.pains.length} pains`
      );
    } catch (error) {
      failedCount++;
      console.error(`[VoiceTagging] Failed to process ${conv.id}:`, error);
    }
  }

  // 3. 更新每日聚合
  await updateDailySummary(sql, dateStr);

  const totalTime = Date.now() - startTime;
  console.log(
    `[VoiceTagging] Completed in ${totalTime}ms. ` +
      `Processed: ${processedCount}, Failed: ${failedCount}, ` +
      `AI calls: ${totalAICalls}, Total sentences: ${totalSentences}`
  );
}

/**
 * 更新每日聚合摘要
 */
async function updateDailySummary(
  sql: ReturnType<typeof neon<false, false>>,
  dateStr: string
): Promise<void> {
  console.log(`[VoiceTagging] Updating daily summary for ${dateStr}`);

  // 查詢當日統計
  const stats = (await sql`
    SELECT
      product_line,
      COUNT(*) as total_conversations,
      SUM(total_sentences) as total_sentences,
      SUM(ai_processed_count) as ai_calls
    FROM customer_voice_tags
    WHERE conversation_date = ${dateStr}::date
    GROUP BY product_line
  `) as StatRow[];

  for (const stat of stats) {
    const productLine = stat.product_line || "ichef";

    // 查詢 Top Features
    const topFeatures = (await sql`
      WITH feature_stats AS (
        SELECT
          f->>'tag' as tag,
          COUNT(*) as mention_count,
          COUNT(DISTINCT conversation_id) as unique_convs,
          array_agg(DISTINCT (f->'quotes'->>0)) FILTER (WHERE f->'quotes'->>0 IS NOT NULL) as sample_quotes
        FROM customer_voice_tags,
             jsonb_array_elements(features_mentioned) as f
        WHERE conversation_date = ${dateStr}::date
          AND product_line = ${productLine}
        GROUP BY f->>'tag'
      )
      SELECT * FROM feature_stats
      ORDER BY mention_count DESC
      LIMIT 10
    `) as FeatureRow[];

    // 查詢 Top Pain Points
    const topPains = (await sql`
      WITH pain_stats AS (
        SELECT
          p->>'tag' as tag,
          COUNT(*) as count,
          MODE() WITHIN GROUP (ORDER BY p->>'severity') as common_severity
        FROM customer_voice_tags,
             jsonb_array_elements(pain_tags) as p
        WHERE conversation_date = ${dateStr}::date
          AND product_line = ${productLine}
        GROUP BY p->>'tag'
      )
      SELECT * FROM pain_stats
      ORDER BY count DESC
      LIMIT 10
    `) as PainRow[];

    // 查詢 Top Objections
    const topObjections = (await sql`
      SELECT
        o->>'tag' as tag,
        COUNT(*) as count
      FROM customer_voice_tags,
           jsonb_array_elements(objection_tags) as o
      WHERE conversation_date = ${dateStr}::date
        AND product_line = ${productLine}
      GROUP BY o->>'tag'
      ORDER BY count DESC
      LIMIT 5
    `) as ObjectionRow[];

    // 查詢競品統計
    const competitorStats = (await sql`
      SELECT
        c->>'name' as name,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE c->>'sentiment' = 'positive') as positive,
        COUNT(*) FILTER (WHERE c->>'sentiment' = 'negative') as negative,
        COUNT(*) FILTER (WHERE c->>'sentiment' = 'neutral') as neutral
      FROM customer_voice_tags,
           jsonb_array_elements(competitor_mentions) as c
      WHERE conversation_date = ${dateStr}::date
        AND product_line = ${productLine}
      GROUP BY c->>'name'
      ORDER BY count DESC
    `) as CompetitorRow[];

    // 儲存或更新每日摘要
    const summaryId = randomUUID();
    await sql`
      INSERT INTO daily_voice_summary (
        id, summary_date, product_line,
        top_features, top_pain_points, top_objections, competitor_stats,
        total_conversations, total_sentences_processed, ai_calls_made
      ) VALUES (
        ${summaryId},
        ${dateStr}::date,
        ${productLine},
        ${JSON.stringify(
          topFeatures.map((f: FeatureRow) => ({
            tag: f.tag,
            count: Number(f.mention_count),
            uniqueConversations: Number(f.unique_convs),
            sampleQuotes: f.sample_quotes?.slice(0, 3) || [],
          }))
        )}::jsonb,
        ${JSON.stringify(
          topPains.map((p: PainRow) => ({
            tag: p.tag,
            count: Number(p.count),
            avgSeverity: p.common_severity,
            sampleQuotes: [],
          }))
        )}::jsonb,
        ${JSON.stringify(
          topObjections.map((o: ObjectionRow) => ({
            tag: o.tag,
            count: Number(o.count),
            sampleQuotes: [],
          }))
        )}::jsonb,
        ${JSON.stringify(
          competitorStats.map((c: CompetitorRow) => ({
            name: c.name,
            count: Number(c.count),
            sentimentBreakdown: {
              positive: Number(c.positive),
              negative: Number(c.negative),
              neutral: Number(c.neutral),
            },
          }))
        )}::jsonb,
        ${Number(stat.total_conversations)},
        ${Number(stat.total_sentences)},
        ${Number(stat.ai_calls)}
      )
      ON CONFLICT (summary_date, product_line)
      DO UPDATE SET
        top_features = EXCLUDED.top_features,
        top_pain_points = EXCLUDED.top_pain_points,
        top_objections = EXCLUDED.top_objections,
        competitor_stats = EXCLUDED.competitor_stats,
        total_conversations = EXCLUDED.total_conversations,
        total_sentences_processed = EXCLUDED.total_sentences_processed,
        ai_calls_made = EXCLUDED.ai_calls_made
    `;

    console.log(
      `[VoiceTagging] Updated daily summary for ${productLine}: ${stat.total_conversations} conversations`
    );
  }
}
