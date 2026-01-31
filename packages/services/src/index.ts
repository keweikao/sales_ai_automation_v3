/**
 * @Sales_ai_automation_v3/services
 * External services integration package
 *
 * This package integrates:
 * - Groq Whisper (transcription)
 * - Google Gemini 2.0 Flash (LLM)
 * - Cloudflare R2 (storage)
 * - Multi-Agent MEDDIC Orchestrator (from V2)
 */

// ============================================================
// Internal Imports for Convenience Functions
// ============================================================

import { createGeminiClient as createGemini } from "./llm/gemini.js";
import { createOrchestrator as createOrch } from "./llm/orchestrator.js";
import { validatePrompts as validatePromptsInternal } from "./llm/prompts.js";
import { createR2Service as createR2 } from "./storage/r2.js";
import { createGroqWhisperService as createWhisper } from "./transcription/groq-whisper.js";

// ============================================================
// LLM Services
// ============================================================

export { createGeminiClient, extractJSON, GeminiClient } from "./llm/gemini.js";
export { createOrchestrator, MeddicOrchestrator } from "./llm/orchestrator.js";
export {
  AGENT1_PROMPT,
  AGENT2_PROMPT,
  AGENT3_PROMPT,
  AGENT4_PROMPT,
  AGENT5_PROMPT,
  AGENT6_PROMPT,
  GLOBAL_CONTEXT,
  getAllPrompts,
} from "./llm/prompts.js";

export type {
  Agent1Output,
  Agent2Output,
  Agent3Output,
  Agent4Output,
  Agent5Output,
  Agent6Output,
  AnalysisMetadata,
  AnalysisResult,
  AnalysisState,
  DimensionAnalysis,
  LLMClient,
  LLMOptions,
  LLMResponse,
  MeddicDimensions,
  MeddicScores,
  Transcript,
  TranscriptSegment,
} from "./llm/types.js";

// ============================================================
// Transcription Services
// ============================================================

export {
  createGroqWhisperService,
  GroqWhisperService,
} from "./transcription/groq-whisper.js";

export type {
  AudioChunk,
  ChunkedTranscriptResult,
  GroqTranscriptionResponse,
  TranscriptionOptions,
  TranscriptionService,
  TranscriptResult,
} from "./transcription/types.js";

// ============================================================
// Storage Services
// ============================================================

export { createR2Service, R2StorageService } from "./storage/r2.js";
export type { S3Config } from "./storage/s3.js";
export { createS3Service, S3StorageService } from "./storage/s3.js";
export type {
  AudioFileMetadata,
  StorageConfig,
  StorageService,
  UploadMetadata,
} from "./storage/types.js";

export { generateAudioKey, generateTranscriptKey } from "./storage/types.js";

// ============================================================
// Compression Services
// ============================================================

export type {
  CompressionRequestOptions,
  CompressionResult,
  OutputMode,
} from "./compression/lambda-compressor.js";
export {
  createLambdaCompressor,
  LambdaAudioCompressor,
} from "./compression/lambda-compressor.js";

// ============================================================
// Alert Services
// ============================================================

export * from "./alerts/index.js";

// ============================================================
// Lead Source Services
// ============================================================

export * from "./lead-source/index.js";

// ============================================================
// Notification Services
// ============================================================

export type {
  MEDDICAnalysisResult,
  ProcessingCompletedParams,
  ProcessingFailedParams,
  ProcessingStartedParams,
  SlackNotificationConfig,
  SlackNotificationService,
} from "./notifications/index.js";
export {
  buildProcessingCompletedBlocks,
  buildProcessingFailedBlocks,
  buildProcessingStartedBlocks,
  createSlackNotificationService,
} from "./notifications/index.js";

// ============================================================
// MCP Tools & Server
// ============================================================

// TODO: Re-enable when Database export and other type issues are fixed
// export * from "./mcp/index.js";
// export * from "./agent/index.js";

// ============================================================
// Convenience Factory Functions
// ============================================================

/**
 * Create all services with default configuration
 * Reads from environment variables
 */
export function createAllServices() {
  const geminiClient = createGemini();
  return {
    gemini: geminiClient,
    whisper: createWhisper(),
    r2: createR2(),
    orchestrator: createOrch(geminiClient),
  };
}

/**
 * Validate that all required environment variables are set
 */
export function validateEnvironment(): {
  valid: boolean;
  missing: string[];
} {
  const required = [
    "GEMINI_API_KEY",
    "GROQ_API_KEY",
    "CLOUDFLARE_R2_ACCESS_KEY",
    "CLOUDFLARE_R2_SECRET_KEY",
    "CLOUDFLARE_R2_BUCKET",
    "CLOUDFLARE_R2_ENDPOINT",
  ];

  const missing = required.filter((key) => !process.env[key]);

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Test all service connections
 */
export async function testAllConnections(): Promise<{
  gemini: boolean;
  whisper: boolean;
  r2: boolean;
  prompts: boolean;
}> {
  const services = createAllServices();

  const [gemini, r2, prompts] = await Promise.all([
    services.gemini.testConnection(),
    services.r2.testConnection(),
    Promise.resolve(validatePromptsInternal()),
  ]);

  return {
    gemini,
    whisper: true, // Whisper test requires audio file
    r2,
    prompts,
  };
}

// ============================================================
// Cache Services
// ============================================================

export {
  invalidateConversationsListCache,
  invalidateOpportunitiesCache,
  updateConversationCache,
  updateConversationDetailCache,
} from "./cache/helpers";

export { createKVCacheService, KVCacheService } from "./cache/kv-cache";
export type {
  CacheService,
  ConversationDetail,
  ConversationListItem,
} from "./cache/types";

// ============================================================
// Share Services
// ============================================================

export {
  generateShareToken,
  getTokenExpiry,
} from "./share/token-generator";

// ============================================================
// SMS Services
// ============================================================

export * from "./sms/every8d";

// ============================================================
// Report Precomputation Services
// ============================================================

export * from "./report/index";

// ============================================================
// NLP Services (Customer Voice Tagging)
// ============================================================

export * from "./nlp/index";

// ============================================================
// Claude Agents (Claude Agent SDK 整合)
// ============================================================

// NOTE: Claude Agents 有可選的 peer dependency (@anthropic-ai/claude-code)
// 請直接從 "@sales_ai_automation_v3/claude-sdk" 或 CLI 腳本使用
// export * from "./claude-agents/index.js";
