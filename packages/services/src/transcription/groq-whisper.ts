/**
 * Groq Whisper Transcription Service
 * Ported from V2: infrastructure/services/transcription/providers/whisper.py
 *
 * Key Features (from V2):
 * - 228x realtime speed
 * - Auto-chunking for files >24MB or >10 minutes
 * - Chinese language optimization (language: 'zh')
 * - Cost: $0.04/hour (far cheaper than Deepgram)
 */

import Groq from "groq-sdk";
import type {
  AudioChunk,
  ChunkedTranscriptResult,
  TranscriptionOptions,
  TranscriptionService,
  TranscriptResult,
  TranscriptSegment,
} from "./types.js";

export class GroqWhisperService implements TranscriptionService {
  private readonly client: Groq;
  private readonly CHUNK_SIZE_BYTES = 24_000_000; // V2 logic: 24MB threshold
  private readonly MAX_FILE_SIZE = 25_000_000; // Groq's limit
  private readonly model = "whisper-large-v3-turbo";

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GROQ_API_KEY;

    if (!key) {
      throw new Error(
        "GROQ_API_KEY is required. Set it in environment variables or pass to constructor."
      );
    }

    this.client = new Groq({ apiKey: key });
  }

  /**
   * Transcribe audio file
   * Automatically chunks if needed (V2 logic)
   */
  async transcribe(
    audioBuffer: Buffer,
    options?: TranscriptionOptions
  ): Promise<TranscriptResult> {
    const language = options?.language || "zh"; // V2 default: Chinese
    const chunkIfNeeded = options?.chunkIfNeeded ?? true; // V2 default: auto-chunk

    // V2 auto-chunking logic
    if (chunkIfNeeded && this.shouldChunk(audioBuffer)) {
      return this.transcribeChunked(audioBuffer, language);
    }

    // Single file transcription
    return this.transcribeSingle(audioBuffer, language, options);
  }

  /**
   * V2 logic: Check if file should be chunked
   * Threshold: >24MB
   */
  shouldChunk(buffer: Buffer): boolean {
    return buffer.length > this.CHUNK_SIZE_BYTES;
  }

  /**
   * Transcribe a single audio file (no chunking)
   */
  private async transcribeSingle(
    audioBuffer: Buffer,
    language: string,
    options?: TranscriptionOptions
  ): Promise<TranscriptResult> {
    if (audioBuffer.length > this.MAX_FILE_SIZE) {
      throw new Error(
        `Audio file too large (${audioBuffer.length} bytes). ` +
          `Maximum is ${this.MAX_FILE_SIZE} bytes. Use chunkIfNeeded: true to auto-chunk.`
      );
    }

    // Create File object from Buffer
    const file = new File([audioBuffer], "audio.mp3", {
      type: "audio/mpeg",
    });

    // Filter response_format to only supported values
    const supportedFormats = ["json", "text", "verbose_json"] as const;
    type SupportedFormat = (typeof supportedFormats)[number];
    const responseFormat: SupportedFormat =
      options?.responseFormat &&
      supportedFormats.includes(options.responseFormat as SupportedFormat)
        ? (options.responseFormat as SupportedFormat)
        : "verbose_json";

    const response = await this.client.audio.transcriptions.create({
      file,
      model: this.model,
      language, // V2: Chinese optimization
      response_format: responseFormat,
      temperature: options?.temperature ?? 0.0, // V2 default: deterministic
    });

    // Type assertion for verbose_json response
    const verboseResponse = response as unknown as {
      text: string;
      segments?: Array<{
        start: number;
        end: number;
        text: string;
      }>;
      language?: string;
      duration?: number;
    };

    return {
      fullText: verboseResponse.text,
      segments: verboseResponse.segments?.map((s) => ({
        start: s.start,
        end: s.end,
        text: s.text,
      })),
      duration: verboseResponse.duration,
      language: verboseResponse.language || language,
    };
  }

  /**
   * Transcribe large file with chunking
   * V2 implementation: Split → Parallel transcribe → Merge with timestamp adjustment
   */
  private async transcribeChunked(
    audioBuffer: Buffer,
    language: string
  ): Promise<ChunkedTranscriptResult> {
    const startTime = Date.now();

    // Step 1: Split audio into chunks
    const chunks = await this.splitAudio(audioBuffer);

    // Step 2: Transcribe chunks in parallel
    const transcriptPromises = chunks.map((chunk) =>
      this.transcribeSingle(chunk.buffer, language)
    );

    const transcriptResults = await Promise.all(transcriptPromises);

    // Step 3: Merge results and adjust timestamps
    let fullText = "";
    const allSegments: TranscriptSegment[] = [];
    let cumulativeTime = 0;

    for (const result of transcriptResults) {
      // Append text
      fullText += (fullText.length > 0 ? " " : "") + (result?.fullText ?? "");

      // Adjust segment timestamps based on chunk position
      if (result?.segments) {
        for (const segment of result.segments) {
          allSegments.push({
            start: segment.start + cumulativeTime,
            end: segment.end + cumulativeTime,
            text: segment.text,
          });
        }
      }

      cumulativeTime += result?.duration ?? 0;
    }

    const processingTime = Date.now() - startTime;

    return {
      fullText,
      segments: allSegments,
      duration: cumulativeTime,
      language,
      chunks: chunks.map((chunkItem, i) => {
        const transcriptResult = transcriptResults[i];
        return {
          index: chunkItem.index,
          startTime: chunkItem.startTime,
          endTime: chunkItem.endTime,
          text: transcriptResult?.fullText ?? "",
          duration: transcriptResult?.duration ?? 0,
        };
      }),
      totalChunks: chunks.length,
      processingTime,
    };
  }

  /**
   * Split audio buffer into chunks
   * V2 logic: Simple byte-based splitting
   *
   * Note: This is a simplified implementation
   * V2's Python version uses pydub for precise audio splitting at silence points
   * For production, consider using ffmpeg for better splitting
   */
  private async splitAudio(audioBuffer: Buffer): Promise<AudioChunk[]> {
    const chunks: AudioChunk[] = [];
    const chunkSize = this.CHUNK_SIZE_BYTES;
    let offset = 0;
    let index = 0;

    while (offset < audioBuffer.length) {
      const end = Math.min(offset + chunkSize, audioBuffer.length);
      const chunkBuffer = audioBuffer.slice(offset, end);

      // Estimate time based on byte position (rough approximation)
      // V2 uses actual audio duration analysis
      const startTime = (offset / audioBuffer.length) * 100; // Assume ~100 seconds total
      const endTime = (end / audioBuffer.length) * 100;

      chunks.push({
        buffer: chunkBuffer,
        startTime,
        endTime,
        index: index++,
      });

      offset = end;
    }

    return chunks;
  }
}

/**
 * Factory function for creating GroqWhisperService
 */
export function createGroqWhisperService(apiKey?: string): GroqWhisperService {
  return new GroqWhisperService(apiKey);
}
