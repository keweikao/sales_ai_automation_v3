/**
 * Google Gemini LLM MCP Tools
 * 提供 Gemini 2.0 Flash LLM 推理能力
 */

import { z } from "zod";
import { GeminiClient } from "../../llm/gemini.js";
import type { MCPTool } from "../types.js";

// ============================================================
// Generate Text Tool
// ============================================================

const GeminiGenerateInputSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  systemPrompt: z.string().optional(),
  model: z.string().default("gemini-2.0-flash-exp"),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(32_768).default(8192),
});

const GeminiGenerateOutputSchema = z.object({
  text: z.string(),
  model: z.string(),
  tokensUsed: z.number().optional(),
});

type GeminiGenerateInput = z.infer<typeof GeminiGenerateInputSchema>;
type GeminiGenerateOutput = z.infer<typeof GeminiGenerateOutputSchema>;

export const geminiGenerateTextTool: MCPTool<
  GeminiGenerateInput,
  GeminiGenerateOutput
> = {
  name: "gemini_generate_text",
  description:
    "使用 Google Gemini 2.0 Flash 生成文字。優化用於中文處理和 MEDDIC 分析。支援自動重試和錯誤處理。",
  inputSchema: GeminiGenerateInputSchema,
  handler: async (input) => {
    try {
      const geminiClient = new GeminiClient();

      const response = await geminiClient.generate(input.prompt, {
        systemPrompt: input.systemPrompt,
        model: input.model,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
      });

      return {
        text: response.text,
        model: input.model,
        tokensUsed: (
          response.raw as
            | { usageMetadata?: { totalTokenCount?: number } }
            | undefined
        )?.usageMetadata?.totalTokenCount,
      };
    } catch (error) {
      throw new Error(
        `Gemini generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};

// ============================================================
// Generate JSON Tool
// ============================================================

const GeminiGenerateJSONInputSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  systemPrompt: z.string().optional(),
  model: z.string().default("gemini-2.0-flash-exp"),
  temperature: z.number().min(0).max(1).default(0.3), // Lower for JSON
  maxTokens: z.number().min(1).max(32_768).default(8192),
  schema: z.record(z.string(), z.unknown()).optional(),
});

const GeminiGenerateJSONOutputSchema = z.object({
  data: z.record(z.string(), z.unknown()),
  model: z.string(),
  tokensUsed: z.number().optional(),
});

type GeminiGenerateJSONInput = z.infer<typeof GeminiGenerateJSONInputSchema>;
type GeminiGenerateJSONOutput = z.infer<typeof GeminiGenerateJSONOutputSchema>;

export const geminiGenerateJSONTool: MCPTool<
  GeminiGenerateJSONInput,
  GeminiGenerateJSONOutput
> = {
  name: "gemini_generate_json",
  description:
    "使用 Gemini 2.0 Flash 生成結構化 JSON 輸出。自動解析 JSON 並移除 markdown 格式。適用於結構化資料提取。",
  inputSchema: GeminiGenerateJSONInputSchema,
  handler: async (input) => {
    try {
      const geminiClient = new GeminiClient();

      // 建構 JSON 提示
      let enhancedPrompt = input.prompt;
      if (input.schema) {
        enhancedPrompt += `\n\nRequired JSON Schema:\n${JSON.stringify(input.schema, null, 2)}`;
      }

      const data = await geminiClient.generateJSON(enhancedPrompt, {
        systemPrompt: input.systemPrompt,
        model: input.model,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
      });

      return {
        data: data as Record<string, unknown>,
        model: input.model,
        tokensUsed: undefined, // JSON mode doesn't return usage metadata easily
      };
    } catch (error) {
      throw new Error(
        `Gemini JSON generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};

// ============================================================
// MEDDIC Analysis Tool
// ============================================================

const MEDDICAnalysisInputSchema = z.object({
  transcript: z.string().min(1, "Transcript is required"),
  conversationContext: z
    .object({
      opportunityName: z.string().optional(),
      companyName: z.string().optional(),
      previousScore: z.number().optional(),
    })
    .optional(),
});

const MEDDICAnalysisOutputSchema = z.object({
  overallScore: z.number(),
  qualificationStatus: z.string(),
  metrics: z.object({
    score: z.number(),
    findings: z.string(),
  }),
  economicBuyer: z.object({
    score: z.number(),
    findings: z.string(),
  }),
  decisionCriteria: z.object({
    score: z.number(),
    findings: z.string(),
  }),
  decisionProcess: z.object({
    score: z.number(),
    findings: z.string(),
  }),
  identifyPain: z.object({
    score: z.number(),
    findings: z.string(),
  }),
  champion: z.object({
    score: z.number(),
    findings: z.string(),
  }),
  recommendations: z.array(z.string()),
  keyInsights: z.array(z.string()),
});

type MEDDICAnalysisInput = z.infer<typeof MEDDICAnalysisInputSchema>;
type MEDDICAnalysisOutput = z.infer<typeof MEDDICAnalysisOutputSchema>;

export const geminiMeddicAnalysisTool: MCPTool<
  MEDDICAnalysisInput,
  MEDDICAnalysisOutput
> = {
  name: "gemini_meddic_analysis",
  description:
    "使用 Gemini 2.0 Flash 執行完整的 MEDDIC 銷售分析。分析六個維度（Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion）並提供評分和建議。",
  inputSchema: MEDDICAnalysisInputSchema,
  handler: async (input) => {
    try {
      const geminiClient = new GeminiClient();

      // 建構 MEDDIC 分析提示
      const systemPrompt = `你是一位專業的 B2B 銷售分析師，專精於 MEDDIC 銷售方法論。
你的任務是分析銷售對話轉錄稿，並針對 MEDDIC 六個維度進行評分和分析。

MEDDIC 六維度：
1. Metrics (指標) - 客戶可量化的業務目標和成功指標
2. Economic Buyer (經濟決策者) - 有預算權限的最終決策者
3. Decision Criteria (決策標準) - 客戶評估解決方案的標準
4. Decision Process (決策流程) - 採購決策的步驟和時間表
5. Identify Pain (識別痛點) - 客戶的核心痛點和急迫性
6. Champion (內部支持者) - 內部支持和推動者

評分標準（0-100）：
- 90-100: 優秀，資訊完整且明確
- 70-89: 良好，大部分資訊清晰
- 50-69: 中等，資訊不夠完整
- 30-49: 不足，缺乏關鍵資訊
- 0-29: 極差，幾乎無相關資訊

請用繁體中文回答，並提供可執行的建議。`;

      const userPrompt = `請分析以下銷售對話轉錄稿：

${
  input.conversationContext
    ? `背景資訊：
- 商機名稱: ${input.conversationContext.opportunityName || "未提供"}
- 公司名稱: ${input.conversationContext.companyName || "未提供"}
${input.conversationContext.previousScore ? `- 上次評分: ${input.conversationContext.previousScore}` : ""}
`
    : ""
}

轉錄稿：
${input.transcript}

請提供完整的 MEDDIC 分析，包含：
1. 每個維度的評分（0-100）和詳細發現
2. 整體評分（六個維度的平均）
3. 資格狀態（qualified/needs_improvement/not_qualified）
4. 至少 3 條可執行的建議
5. 關鍵洞察（重要發現或警示）`;

      const result = await geminiClient.generateJSON<MEDDICAnalysisOutput>(
        userPrompt,
        {
          systemPrompt,
          model: "gemini-2.0-flash-exp",
          temperature: 0.3, // Lower for structured analysis
          maxTokens: 8192,
        }
      );

      return result;
    } catch (error) {
      throw new Error(
        `MEDDIC analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};
