/**
 * Type definitions for transcription services
 * Aligned with V2 Groq Whisper implementation
 */

// Import from local types.ts instead of shared package
import type { Transcript, TranscriptSegment } from "../llm/types.js";

// Re-export for compatibility
export type { Transcript, TranscriptSegment };

export interface TranscriptResult {
  fullText: string;
  segments?: TranscriptSegment[];
  duration?: number; // Total duration in seconds
  language?: string; // Detected or specified language
}

export interface TranscriptionOptions {
  language?: string; // Language code (e.g., 'zh', 'en')
  chunkIfNeeded?: boolean; // Auto-chunk files >24MB (V2 logic)
  temperature?: number; // Sampling temperature (0.0 for deterministic)
  responseFormat?: "json" | "text" | "srt" | "verbose_json" | "vtt";
}

export interface TranscriptionService {
  /**
   * Transcribe audio file
   * @param audioBuffer Audio file as Buffer
   * @param options Transcription options
   * @returns Transcript result
   */
  transcribe(
    audioBuffer: Buffer,
    options?: TranscriptionOptions
  ): Promise<TranscriptResult>;

  /**
   * Check if audio file should be chunked
   * V2 logic: >24MB or >10 minutes
   * @param buffer Audio buffer
   * @returns True if chunking is recommended
   */
  shouldChunk(buffer: Buffer): boolean;
}

// ============================================================
// Groq Whisper Specific Types (V2 Implementation)
// ============================================================

export interface GroqTranscriptionResponse {
  text: string;
  segments?: Array<{
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
  }>;
  language?: string;
  duration?: number;
}

// ============================================================
// Audio Processing Types
// ============================================================

export interface AudioChunk {
  buffer: Buffer;
  startTime: number; // seconds
  endTime: number; // seconds
  index: number;
}

export interface ChunkedTranscriptResult extends TranscriptResult {
  chunks: Array<{
    index: number;
    startTime: number;
    endTime: number;
    text: string;
    duration: number;
  }>;
  totalChunks: number;
  processingTime: number; // milliseconds
}
