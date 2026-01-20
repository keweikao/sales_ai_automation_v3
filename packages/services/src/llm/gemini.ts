/**
 * Google Gemini 2.0 Flash LLM Service
 * Optimized for MEDDIC analysis and Chinese language processing
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMClient, LLMOptions, LLMResponse } from "./types.js";

export class GeminiClient implements LLMClient {
  private readonly genAI: GoogleGenerativeAI;
  private readonly defaultModel = "gemini-2.5-flash"; // Use Gemini 2.5 Flash for higher quota

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;

    if (!key) {
      throw new Error(
        "GEMINI_API_KEY is required. Set it in environment variables or pass to constructor."
      );
    }

    this.genAI = new GoogleGenerativeAI(key);
  }

  /**
   * Generate text from prompt
   * Supports exponential backoff retry logic (V2 P0 resilience)
   */
  async generate(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
    const modelName = options?.model || this.defaultModel;
    console.log(
      `[Gemini] Using model: ${modelName} (default: ${this.defaultModel}, options.model: ${options?.model})`
    );
    const model = this.genAI.getGenerativeModel({ model: modelName });

    const generationConfig = {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxTokens ?? 8192,
    };

    // Retry with exponential backoff (V2 resilience mechanism)
    return this.retryWithBackoff(async () => {
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: this.buildPrompt(prompt, options) }],
          },
        ],
        generationConfig,
      });

      const response = result.response;
      const text = response.text();

      return {
        text,
        raw: response,
      };
    });
  }

  /**
   * Generate structured JSON output
   * Useful for agent outputs that need to be parsed
   */
  async generateJSON<T = unknown>(
    prompt: string,
    options?: LLMOptions
  ): Promise<T> {
    const jsonPrompt = `${prompt}\n\nIMPORTANT: Respond with ONLY a valid JSON object. Do NOT include:
- Markdown formatting (**, *, ~~, etc.)
- Code blocks (\`\`\`)
- Explanatory text before or after the JSON
- Any text that is not part of the JSON structure

Start your response with { and end with }`;

    const response = await this.generate(jsonPrompt, {
      ...options,
      temperature: options?.temperature ?? 0.3, // Lower temperature for JSON
    });

    try {
      // Remove markdown code blocks if present
      let cleanText = response.text.trim();

      // Remove ```json and ``` blocks (handle both single and multi-line)
      // First, remove code fence markers
      cleanText = cleanText.replace(/^```json\s*/i, ""); // Remove opening ```json
      cleanText = cleanText.replace(/^```\s*/, ""); // Remove opening ```
      cleanText = cleanText.replace(/\s*```\s*$/g, ""); // Remove closing ```
      cleanText = cleanText.trim();

      // Try to find JSON object boundaries
      const jsonStart = cleanText.indexOf("{");
      const jsonEnd = cleanText.lastIndexOf("}");

      if (jsonStart === -1 || jsonEnd === -1 || jsonStart > jsonEnd) {
        throw new Error("No valid JSON object found in response");
      }

      // Extract only the JSON portion
      cleanText = cleanText.substring(jsonStart, jsonEnd + 1);

      return JSON.parse(cleanText) as T;
    } catch (error) {
      console.error("Failed to parse JSON from LLM response:", error);
      console.error("Raw response:", response.text.substring(0, 500)); // Only log first 500 chars
      throw new Error(`Invalid JSON response from LLM: ${error}`);
    }
  }

  /**
   * Build full prompt with optional system prompt
   */
  private buildPrompt(userPrompt: string, options?: LLMOptions): string {
    if (options?.systemPrompt) {
      return `${options.systemPrompt}\n\n${userPrompt}`;
    }
    return userPrompt;
  }

  /**
   * Retry logic with exponential backoff
   * V2 P0 resilience mechanism for LLM API failures
   *
   * @param fn Function to retry
   * @param maxRetries Maximum number of retries (default: 3)
   * @param baseDelay Initial delay in ms (default: 1000)
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if this is a non-retryable error
        const shouldNotRetry = this.isNonRetryableError(error);

        if (shouldNotRetry) {
          console.error(
            `❌ Non-retryable error detected: ${this.formatErrorMessage(error)}`
          );
          throw this.enhanceError(error);
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Calculate exponential backoff delay
        const delay = baseDelay * 2 ** attempt;

        console.warn(
          `LLM request failed (attempt ${attempt + 1}/${maxRetries + 1}). ` +
            `Retrying in ${delay}ms...`,
          error
        );

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    const enhancedError = this.enhanceError(lastError);
    throw new Error(
      `LLM request failed after ${maxRetries + 1} attempts: ${enhancedError.message}`
    );
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }

    const err = error as {
      status?: number;
      errorDetails?: Array<{ reason?: string }>;
    };

    // Don't retry on client errors (4xx)
    if (err.status && err.status >= 400 && err.status < 500) {
      // Except 429 (rate limit) which should be retried
      if (err.status === 429) {
        return false;
      }
      return true;
    }

    // Don't retry on specific error reasons
    if (err.errorDetails) {
      const nonRetryableReasons = [
        "API_KEY_INVALID",
        "PERMISSION_DENIED",
        "INVALID_ARGUMENT",
        "NOT_FOUND",
      ];

      const hasNonRetryable = err.errorDetails.some((detail) =>
        nonRetryableReasons.includes(detail.reason || "")
      );

      if (hasNonRetryable) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract detailed error message from Google API error
   */
  private formatErrorMessage(error: unknown): string {
    if (!error) {
      return "Unknown error";
    }

    if (typeof error === "string") {
      return error;
    }

    const err = error as {
      message?: string;
      status?: number;
      statusText?: string;
      errorDetails?: Array<{
        "@type"?: string;
        reason?: string;
        message?: string;
      }>;
    };

    // Extract error details from Google API response
    if (err.errorDetails && err.errorDetails.length > 0) {
      const details = err.errorDetails
        .map((detail) => {
          // Provide localized error messages for common issues
          switch (detail.reason) {
            case "API_KEY_INVALID":
              return "❌ API Key 無效 - 請檢查 GEMINI_API_KEY 環境變數是否正確設定";
            case "PERMISSION_DENIED":
              return "❌ 權限不足 - API Key 沒有存取此資源的權限";
            case "RESOURCE_EXHAUSTED":
              return "⚠️ 配額已用盡 - 請稍後再試或升級您的 API 方案";
            case "INVALID_ARGUMENT":
              return "❌ 請求參數錯誤 - 請檢查請求格式";
            case "NOT_FOUND":
              return "❌ 找不到資源 - 請檢查模型名稱是否正確";
            case "RATE_LIMIT_EXCEEDED":
              return "⚠️ 請求頻率過高 - 請降低請求速度";
            default:
              if (detail.message) {
                return detail.message;
              }
              return detail.reason || "";
          }
        })
        .filter(Boolean)
        .join("; ");

      if (details) {
        const statusCode = err.status ? `[${err.status}]` : "";
        const statusText = err.statusText || "";
        return `${statusCode} ${statusText}: ${details}`.trim();
      }
    }

    // Handle common HTTP status codes
    if (err.status) {
      const statusMessages: Record<number, string> = {
        400: "請求格式錯誤",
        401: "認證失敗 - API Key 無效或缺失",
        403: "存取被拒絕 - 沒有權限",
        404: "找不到資源",
        429: "請求過於頻繁 - 已達速率限制",
        500: "伺服器內部錯誤",
        502: "伺服器無回應",
        503: "服務暫時無法使用",
      };

      const statusMsg = statusMessages[err.status] || err.statusText || "";
      const baseMsg = err.message || "";

      return `[${err.status}] ${statusMsg}${baseMsg ? `: ${baseMsg}` : ""}`;
    }

    // Fallback to standard error message
    if (err.message) {
      return err.message;
    }

    return String(error);
  }

  /**
   * Enhance error with more context
   */
  private enhanceError(error: unknown): Error {
    const message = this.formatErrorMessage(error);

    // Create new error with enhanced message
    const enhancedError = new Error(message);

    // Preserve original error properties
    if (error && typeof error === "object") {
      Object.assign(enhancedError, error);
    }

    return enhancedError;
  }

  /**
   * Test connection to Gemini API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.generate('Hello, respond with "OK"', {
        maxTokens: 10,
        temperature: 0,
      });
      return true;
    } catch (error) {
      console.error("Gemini API connection test failed:", error);
      return false;
    }
  }
}

/**
 * Factory function for creating GeminiClient
 */
export function createGeminiClient(
  options?: string | { apiKey?: string; model?: string }
): GeminiClient {
  // Support both string (legacy) and object syntax
  if (typeof options === "string") {
    return new GeminiClient(options);
  }
  return new GeminiClient(options?.apiKey);
}

/**
 * Helper to extract JSON from code blocks
 */
export function extractJSON(text: string): string {
  let cleanText = text.trim();

  // Remove markdown code blocks
  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.replace(/^```json\n/, "").replace(/\n```$/, "");
  } else if (cleanText.startsWith("```")) {
    cleanText = cleanText.replace(/^```\n/, "").replace(/\n```$/, "");
  }

  return cleanText;
}
