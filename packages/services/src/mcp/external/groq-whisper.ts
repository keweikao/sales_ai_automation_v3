/**
 * Groq Whisper MCP Tools
 * 將 Groq Whisper 語音轉文字服務包裝為 MCP 工具
 */

import { z } from "zod";
import { GroqWhisperService } from "../../transcription/groq-whisper.js";
import type { ChunkedTranscriptResult } from "../../transcription/types.js";
import type { MCPTool } from "../types.js";

// ============================================================
// Transcribe Audio Tool
// ============================================================

const TranscribeAudioInputSchema = z.object({
  audioUrl: z.string().url("Invalid audio URL"),
  language: z.string().default("zh"),
  chunkIfNeeded: z.boolean().default(true),
  temperature: z.number().min(0).max(1).default(0.0),
  responseFormat: z
    .enum(["json", "text", "verbose_json"])
    .default("verbose_json"),
});

const TranscribeAudioOutputSchema = z.object({
  fullText: z.string(),
  segments: z
    .array(
      z.object({
        speaker: z.string(),
        start: z.number(),
        end: z.number(),
        text: z.string(),
      })
    )
    .optional(),
  duration: z.number().optional(),
  language: z.string(),
  isChunked: z.boolean(),
  totalChunks: z.number().optional(),
  processingTime: z.number().optional(),
});

type TranscribeAudioInput = z.infer<typeof TranscribeAudioInputSchema>;
type TranscribeAudioOutput = z.infer<typeof TranscribeAudioOutputSchema>;

export const groqTranscribeAudioTool: MCPTool<
  TranscribeAudioInput,
  TranscribeAudioOutput
> = {
  name: "groq_transcribe_audio",
  description:
    "使用 Groq Whisper Large V3 Turbo 轉錄音檔。支援自動分塊（>24MB），228x 即時速度，優化中文識別。成本：$0.04/小時。",
  inputSchema: TranscribeAudioInputSchema,
  handler: async (input, _context) => {
    try {
      // 建立 Groq Whisper 服務實例
      const whisperService = new GroqWhisperService();

      // 下載音檔
      const response = await fetch(input.audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to download audio: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      // 執行轉錄
      const result = await whisperService.transcribe(audioBuffer, {
        language: input.language,
        chunkIfNeeded: input.chunkIfNeeded,
        temperature: input.temperature,
        responseFormat: input.responseFormat,
      });

      // 判斷是否為分塊結果
      const isChunked = "chunks" in result && result.chunks !== undefined;

      return {
        fullText: result.fullText,
        segments: result.segments,
        duration: result.duration,
        language: result.language || input.language,
        isChunked,
        totalChunks: isChunked
          ? (result as ChunkedTranscriptResult).totalChunks
          : undefined,
        processingTime: isChunked
          ? (result as ChunkedTranscriptResult).processingTime
          : undefined,
      };
    } catch (error) {
      throw new Error(
        `Groq transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};

// ============================================================
// Check Audio Size Tool
// ============================================================

const CheckAudioSizeInputSchema = z.object({
  audioUrl: z.string().url("Invalid audio URL"),
});

const CheckAudioSizeOutputSchema = z.object({
  sizeBytes: z.number(),
  sizeMB: z.number(),
  willChunk: z.boolean(),
  estimatedChunks: z.number(),
  recommendation: z.string(),
});

type CheckAudioSizeInput = z.infer<typeof CheckAudioSizeInputSchema>;
type CheckAudioSizeOutput = z.infer<typeof CheckAudioSizeOutputSchema>;

const CHUNK_SIZE_BYTES = 24_000_000; // 24MB

export const groqCheckAudioSizeTool: MCPTool<
  CheckAudioSizeInput,
  CheckAudioSizeOutput
> = {
  name: "groq_check_audio_size",
  description:
    "檢查音檔大小並評估是否需要分塊處理。提供處理建議和預估分塊數量。",
  inputSchema: CheckAudioSizeInputSchema,
  handler: async (input) => {
    try {
      // 使用 HEAD 請求取得檔案大小（不下載整個檔案）
      const response = await fetch(input.audioUrl, { method: "HEAD" });
      if (!response.ok) {
        throw new Error(`Failed to check audio size: ${response.statusText}`);
      }

      const contentLength = response.headers.get("content-length");
      if (!contentLength) {
        throw new Error("Content-Length header not found");
      }

      const sizeBytes = Number.parseInt(contentLength, 10);
      const sizeMB = sizeBytes / 1_000_000;
      const willChunk = sizeBytes > CHUNK_SIZE_BYTES;
      const estimatedChunks = willChunk
        ? Math.ceil(sizeBytes / CHUNK_SIZE_BYTES)
        : 1;

      let recommendation: string;
      if (sizeBytes > 25_000_000) {
        recommendation =
          "檔案超過 25MB，必須啟用分塊處理（chunkIfNeeded: true）";
      } else if (willChunk) {
        recommendation = `檔案 ${sizeMB.toFixed(2)}MB，建議啟用分塊處理以提升穩定性`;
      } else {
        recommendation = `檔案 ${sizeMB.toFixed(2)}MB，可以單次處理`;
      }

      return {
        sizeBytes,
        sizeMB: Number(sizeMB.toFixed(2)),
        willChunk,
        estimatedChunks,
        recommendation,
      };
    } catch (error) {
      throw new Error(
        `Failed to check audio size: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};

// ============================================================
// Estimate Transcription Cost Tool
// ============================================================

const EstimateCostInputSchema = z.object({
  durationSeconds: z.number().positive(),
});

const EstimateCostOutputSchema = z.object({
  durationMinutes: z.number(),
  durationHours: z.number(),
  estimatedCostUSD: z.number(),
  pricePerHour: z.number(),
});

type EstimateCostInput = z.infer<typeof EstimateCostInputSchema>;
type EstimateCostOutput = z.infer<typeof EstimateCostOutputSchema>;

const GROQ_PRICE_PER_HOUR = 0.04; // $0.04/hour

export const groqEstimateCostTool: MCPTool<
  EstimateCostInput,
  EstimateCostOutput
> = {
  name: "groq_estimate_cost",
  description:
    "估算 Groq Whisper 轉錄成本。價格：$0.04/小時，遠低於 Deepgram 等競品。",
  inputSchema: EstimateCostInputSchema,
  handler: async (input) => {
    const durationMinutes = input.durationSeconds / 60;
    const durationHours = input.durationSeconds / 3600;
    const estimatedCostUSD = durationHours * GROQ_PRICE_PER_HOUR;

    return {
      durationMinutes: Number(durationMinutes.toFixed(2)),
      durationHours: Number(durationHours.toFixed(4)),
      estimatedCostUSD: Number(estimatedCostUSD.toFixed(4)),
      pricePerHour: GROQ_PRICE_PER_HOUR,
    };
  },
};
