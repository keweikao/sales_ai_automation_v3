/**
 * Voice Tagger - 客戶聲音標籤處理器
 * 整合規則匹配和 AI 分析
 */

import { GeminiClient } from "../llm/gemini";
import { getObjectionTagList } from "./dictionaries/common";
import { getFeatureTagList, getPainTagList } from "./dictionaries/ichef";
import type {
  ClassifiedSentence,
  UncertainReason,
} from "./sentence-classifier";
import {
  classifySentence,
  extractSentences,
  matchRules,
} from "./sentence-classifier";

/**
 * AI 標籤結果
 */
export interface AITagResult {
  index: number;
  tags: Array<{
    category: "feature" | "pain" | "objection" | "competitor";
    tag: string;
    confidence: number;
  }>;
  implicitNeed?: string;
  severity?: "critical" | "high" | "medium" | "low";
}

/**
 * 處理結果
 */
export interface VoiceTaggingResult {
  features: Array<{
    tag: string;
    category: string;
    quotes: string[];
    count: number;
    source: "rule" | "ai";
  }>;
  pains: Array<{
    tag: string;
    severity: "critical" | "high" | "medium" | "low";
    quotes: string[];
    isQuantified: boolean;
    source: "rule" | "ai";
  }>;
  objections: Array<{
    tag: string;
    quotes: string[];
    source: "rule" | "ai";
  }>;
  competitors: Array<{
    name: string;
    sentiment: "positive" | "negative" | "neutral";
    quotes: string[];
    source: "rule" | "ai";
  }>;
  decisionFactors: Array<{
    tag: string;
    importance: "high" | "medium" | "low";
    quotes: string[];
    source: "rule" | "ai";
  }>;
  totalSentences: number;
  ruleMatched: number;
  aiProcessed: number;
  skipped: number;
  processingTime: number;
  aiCalls: number;
}

/**
 * AI 深度分析結果（Layer 2）
 * 基於規則標籤的深度解讀
 */
export interface AIAnalysis {
  // 針對每個規則標籤的深度解讀
  tag_insights: {
    [tag: string]: {
      context: string; // 具體情境描述
      quote: string; // 原文引述
      sub_category: string; // 子分類（可聚合）
      implicit_need?: string; // 隱含需求
      suggested_response?: string; // 建議話術
    };
  };

  // 競品識別（規則沒覆蓋的部分）
  competitors: Array<{
    name: string;
    sentiment: "positive" | "negative" | "neutral";
    context: string;
  }>;

  // 整體摘要
  summary: string;
}

/**
 * 建構 AI Prompt
 */
function buildAIPrompt(
  sentences: Array<{ sentence: string; reason: UncertainReason }>,
  productLine: "ichef" | "beauty"
): string {
  const contextHints: Record<UncertainReason, string> = {
    customer_need: "這些句子描述了客戶/顧客的行為或需求",
    external_platform: "這些句子提到了外部平台，可能暗示整合需求",
    problem_context: "這些句子描述了重複發生的問題",
    quantified: "這些句子包含數字，可能是量化的痛點",
    strong_emotion: "這些句子包含情緒詞，注意判斷正負面",
    general_important: "這些句子可能包含重要的客戶洞察",
  };

  // 按原因分組提示
  const reasonCounts = new Map<UncertainReason, number>();
  for (const s of sentences) {
    reasonCounts.set(s.reason, (reasonCounts.get(s.reason) || 0) + 1);
  }

  const hints = Array.from(reasonCounts.entries())
    .map(([reason, count]) => `- ${contextHints[reason]} (${count}句)`)
    .join("\n");

  // 根據產品線取得標籤列表
  const tagList =
    productLine === "ichef"
      ? [getFeatureTagList(), getPainTagList(), getObjectionTagList()].join(
          "\n\n"
        )
      : ""; // 美業待實作

  return `你是餐飲/美業 POS 系統的客戶需求分析專家。分析以下客戶語句，提取標籤。

## 分析提示
${hints}

## 可用標籤
${tagList}

## 客戶語句
${sentences.map((s, i) => `${i + 1}. 「${s.sentence}」`).join("\n")}

## 輸出規則
1. 只輸出有把握的標籤 (confidence >= 0.6)
2. 若句子暗示需求但沒明說，填寫 implicit_need
3. 若是痛點，評估 severity (critical/high/medium/low)
4. 若無法判斷，該句子回傳空 tags 陣列

## 輸出 JSON 格式
[
  {
    "index": 1,
    "tags": [
      { "category": "feature", "tag": "crm", "confidence": 0.8 }
    ],
    "implicit_need": "會員管理系統",
    "severity": null
  }
]`;
}

/**
 * 使用 AI 處理不確定的句子
 */
export async function processUncertainWithAI(
  sentences: Array<{ sentence: string; reason: UncertainReason }>,
  productLine: "ichef" | "beauty",
  geminiApiKey: string
): Promise<AITagResult[]> {
  if (sentences.length === 0) {
    return [];
  }

  const client = new GeminiClient(geminiApiKey);
  const prompt = buildAIPrompt(sentences, productLine);

  try {
    const result = await client.generateJSON<
      Array<{
        index: number;
        tags: Array<{
          category: "feature" | "pain" | "objection" | "competitor";
          tag: string;
          confidence: number;
        }>;
        implicit_need?: string;
        severity?: "critical" | "high" | "medium" | "low";
      }>
    >(prompt, {
      model: "gemini-2.5-flash-lite", // 使用最經濟的模型
      temperature: 0.2,
      maxTokens: 2048,
    });

    // 轉換 snake_case 到 camelCase
    return result.map((r) => ({
      index: r.index,
      tags: r.tags,
      implicitNeed: r.implicit_need,
      severity: r.severity,
    }));
  } catch (error) {
    console.error("[VoiceTagger] AI processing failed:", error);
    return [];
  }
}

/**
 * 合併規則匹配和 AI 結果
 */
function mergeResults(
  matched: ClassifiedSentence[],
  aiResults: AITagResult[],
  uncertainSentences: Array<{ sentence: string; reason: UncertainReason }>
): Omit<
  VoiceTaggingResult,
  | "totalSentences"
  | "ruleMatched"
  | "aiProcessed"
  | "skipped"
  | "processingTime"
  | "aiCalls"
> {
  const features = new Map<
    string,
    { category: string; quotes: string[]; count: number; source: "rule" | "ai" }
  >();
  const pains = new Map<
    string,
    {
      severity: "critical" | "high" | "medium" | "low";
      quotes: string[];
      isQuantified: boolean;
      source: "rule" | "ai";
    }
  >();
  const objections = new Map<
    string,
    { quotes: string[]; source: "rule" | "ai" }
  >();
  const competitors = new Map<
    string,
    {
      sentiment: "positive" | "negative" | "neutral";
      quotes: string[];
      source: "rule" | "ai";
    }
  >();
  const decisionFactors = new Map<
    string,
    {
      importance: "high" | "medium" | "low";
      quotes: string[];
      source: "rule" | "ai";
    }
  >();

  // 處理規則匹配結果
  for (const item of matched) {
    if (!item.matchedTags) {
      continue;
    }

    for (const tag of item.matchedTags) {
      switch (tag.category) {
        case "feature": {
          const existing = features.get(tag.tag) || {
            category: "核心功能",
            quotes: [],
            count: 0,
            source: "rule" as const,
          };
          existing.quotes.push(tag.quote);
          existing.count += 1;
          features.set(tag.tag, existing);
          break;
        }
        case "pain": {
          const existing = pains.get(tag.tag) || {
            severity: "medium" as const,
            quotes: [],
            isQuantified: false,
            source: "rule" as const,
          };
          existing.quotes.push(tag.quote);
          // 檢查是否量化
          if (/\d+[次小時分鐘天週月年萬元塊%筆個位]/.test(tag.quote)) {
            existing.isQuantified = true;
          }
          pains.set(tag.tag, existing);
          break;
        }
        case "objection": {
          const existing = objections.get(tag.tag) || {
            quotes: [],
            source: "rule" as const,
          };
          existing.quotes.push(tag.quote);
          objections.set(tag.tag, existing);
          break;
        }
        case "competitor": {
          const existing = competitors.get(tag.tag) || {
            sentiment: "neutral" as const,
            quotes: [],
            source: "rule" as const,
          };
          existing.quotes.push(tag.quote);
          competitors.set(tag.tag, existing);
          break;
        }
      }
    }
  }

  // 處理 AI 結果
  for (const aiResult of aiResults) {
    const sentenceData = uncertainSentences[aiResult.index - 1];
    if (!sentenceData) {
      continue;
    }

    for (const tag of aiResult.tags) {
      if (tag.confidence < 0.6) {
        continue;
      }

      switch (tag.category) {
        case "feature": {
          const existing = features.get(tag.tag) || {
            category: "核心功能",
            quotes: [],
            count: 0,
            source: "ai" as const,
          };
          existing.quotes.push(sentenceData.sentence);
          existing.count += 1;
          if (existing.source === "rule") {
            // 保持 rule 作為來源，表示有規則也有 AI 確認
          } else {
            existing.source = "ai";
          }
          features.set(tag.tag, existing);
          break;
        }
        case "pain": {
          const existing = pains.get(tag.tag) || {
            severity: aiResult.severity || "medium",
            quotes: [],
            isQuantified: false,
            source: "ai" as const,
          };
          existing.quotes.push(sentenceData.sentence);
          if (aiResult.severity) {
            existing.severity = aiResult.severity;
          }
          if (
            /\d+[次小時分鐘天週月年萬元塊%筆個位]/.test(sentenceData.sentence)
          ) {
            existing.isQuantified = true;
          }
          pains.set(tag.tag, existing);
          break;
        }
        case "objection": {
          const existing = objections.get(tag.tag) || {
            quotes: [],
            source: "ai" as const,
          };
          existing.quotes.push(sentenceData.sentence);
          objections.set(tag.tag, existing);
          break;
        }
        case "competitor": {
          const existing = competitors.get(tag.tag) || {
            sentiment: "neutral" as const,
            quotes: [],
            source: "ai" as const,
          };
          existing.quotes.push(sentenceData.sentence);
          competitors.set(tag.tag, existing);
          break;
        }
      }
    }
  }

  return {
    features: Array.from(features.entries()).map(([tag, data]) => ({
      tag,
      ...data,
    })),
    pains: Array.from(pains.entries()).map(([tag, data]) => ({ tag, ...data })),
    objections: Array.from(objections.entries()).map(([tag, data]) => ({
      tag,
      ...data,
    })),
    competitors: Array.from(competitors.entries()).map(([name, data]) => ({
      name,
      ...data,
    })),
    decisionFactors: Array.from(decisionFactors.entries()).map(
      ([tag, data]) => ({ tag, ...data })
    ),
  };
}

/**
 * 處理單個對話的客戶聲音標籤
 */
export async function processConversationVoiceTags(
  transcript: string | { fullText?: string },
  productLine: "ichef" | "beauty",
  geminiApiKey?: string
): Promise<VoiceTaggingResult> {
  const startTime = Date.now();

  // 解析逐字稿
  const transcriptText =
    typeof transcript === "string" ? transcript : transcript?.fullText || "";

  // 分離句子
  const sentences = extractSentences(transcriptText);

  // 規則匹配 + 分類
  const classified = sentences.map((s) => {
    const ruleMatches = matchRules(s, productLine);
    return classifySentence(s, ruleMatches);
  });

  // 分組
  const matched = classified.filter((c) => c.status === "matched");
  const uncertain = classified.filter((c) => c.status === "uncertain");
  const skipped = classified.filter((c) => c.status === "skip");

  // AI 處理不確定的句子
  let aiResults: AITagResult[] = [];
  const uncertainSentences = uncertain
    .slice(0, 15) // 限制最多 15 句
    .map((c) => ({
      sentence: c.sentence,
      reason: c.uncertainReason!,
    }));

  if (uncertainSentences.length > 0 && geminiApiKey) {
    aiResults = await processUncertainWithAI(
      uncertainSentences,
      productLine,
      geminiApiKey
    );
  }

  // 合併結果
  const result = mergeResults(matched, aiResults, uncertainSentences);

  return {
    ...result,
    totalSentences: sentences.length,
    ruleMatched: matched.length,
    aiProcessed: aiResults.length,
    skipped: skipped.length,
    aiCalls: aiResults.length > 0 ? 1 : 0,
    processingTime: Date.now() - startTime,
  };
}

// ============================================================
// Layer 2: AI 深度分析（基於規則標籤）
// ============================================================

/**
 * 建構 Layer 2 的 AI Prompt
 * 基於規則標籤產出深度解讀
 */
function buildLayer2Prompt(
  transcript: string,
  ruleTags: {
    features: string[];
    pains: string[];
    objections: string[];
  }
): string {
  return `你是 iCHEF POS 系統的銷售對話分析專家。

以下對話已經透過規則匹配識別出這些標籤：
- 功能需求：${ruleTags.features.join(", ") || "無"}
- 痛點：${ruleTags.pains.join(", ") || "無"}
- 異議：${ruleTags.objections.join(", ") || "無"}

請基於這些標籤，分析對話內容，提供深度解讀：

1. 針對每個標籤，說明：
   - context: 具體情境（客戶的實際狀況，20-50字）
   - quote: 原文引述（最能代表的一句話）
   - sub_category: 子分類（用於統計，如 price 可分為 hardware_cost/monthly_fee/platform_fee）
   - suggested_response: 建議話術（業務可以怎麼回應，30-50字）

2. 識別對話中提到的競品及客戶評價

3. 一句話總結這個對話的關鍵洞察（30-50字）

請用 JSON 格式回覆，不要有其他文字：
{
  "tag_insights": {
    "標籤名稱": {
      "context": "具體情境",
      "quote": "原文引述",
      "sub_category": "子分類",
      "suggested_response": "建議話術"
    }
  },
  "competitors": [
    { "name": "競品名稱", "sentiment": "positive/negative/neutral", "context": "評價內容" }
  ],
  "summary": "一句話洞察"
}

對話內容（前 3000 字）：
${transcript.substring(0, 3000)}`;
}

/**
 * Layer 2: AI 深度分析
 * 基於規則標籤產出深度解讀
 */
export async function analyzeWithAI(
  transcript: string,
  voiceTagResult: VoiceTaggingResult,
  geminiApiKey: string
): Promise<AIAnalysis | null> {
  try {
    const { createGeminiClient } = await import("../llm/gemini");
    const gemini = createGeminiClient(geminiApiKey);

    // 提取規則標籤
    const ruleTags = {
      features: voiceTagResult.features.map((f) => f.tag),
      pains: voiceTagResult.pains.map((p) => p.tag),
      objections: voiceTagResult.objections.map((o) => o.tag),
    };

    // 如果沒有任何標籤，跳過 AI 分析
    if (
      ruleTags.features.length === 0 &&
      ruleTags.pains.length === 0 &&
      ruleTags.objections.length === 0
    ) {
      return null;
    }

    const prompt = buildLayer2Prompt(transcript, ruleTags);
    const result = await gemini.generateJSON<AIAnalysis>(prompt);

    return result;
  } catch (error) {
    console.error("[Layer2] AI 分析失敗:", error);
    return null;
  }
}

/**
 * 判斷是否應該執行 Layer 2 AI 分析
 *
 * 觸發條件（符合任一即觸發）：
 * 1. MEDDIC 高分（>=70）：成交機會大，值得深度分析
 * 2. MEDDIC 低分（<=40）：可能有問題需要了解
 * 3. 規則匹配到競品：需要競爭情報
 * 4. 長對話（>200句）：內容豐富，值得分析
 * 5. 首次接觸：了解客戶初始需求
 */
export function shouldRunLayer2Analysis(
  voiceTagResult: VoiceTaggingResult,
  meddicScore?: number | null,
  conversationMeta?: {
    isFirstContact?: boolean;
    durationMinutes?: number;
  }
): boolean {
  // 1. MEDDIC 高分（>=70）- 成交機會大
  if (meddicScore && meddicScore >= 70) {
    return true;
  }

  // 2. MEDDIC 低分（<=40）- 可能有問題需要分析
  if (meddicScore && meddicScore <= 40) {
    return true;
  }

  // 3. 規則匹配到競品
  if (voiceTagResult.competitors.length > 0) {
    return true;
  }

  // 4. 長對話（>200 句，約 30 分鐘）
  if (voiceTagResult.totalSentences > 200) {
    return true;
  }

  // 5. 首次接觸
  if (conversationMeta?.isFirstContact) {
    return true;
  }

  // 6. 對話時長超過 30 分鐘
  if (
    conversationMeta?.durationMinutes &&
    conversationMeta.durationMinutes > 30
  ) {
    return true;
  }

  return false;
}
