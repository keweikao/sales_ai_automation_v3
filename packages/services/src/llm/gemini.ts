/**
 * Google Gemini 2.0 Flash LLM Service
 * Optimized for MEDDIC analysis and Chinese language processing
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMClient, LLMOptions, LLMResponse } from "./types.js";

export class GeminiClient implements LLMClient {
  private readonly genAI: GoogleGenerativeAI;
  private readonly defaultModel = "gemini-2.0-flash-exp"; // V2 uses Gemini 2.0 Flash

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
    const jsonPrompt = `${prompt}\n\nIMPORTANT: Respond with valid JSON only. No markdown formatting, no explanations.`;

    const response = await this.generate(jsonPrompt, {
      ...options,
      temperature: options?.temperature ?? 0.3, // Lower temperature for JSON
    });

    try {
      // Remove markdown code blocks if present
      let cleanText = response.text.trim();
      if (cleanText.startsWith("```json")) {
        cleanText = cleanText.replace(/^```json\n/, "").replace(/\n```$/, "");
      } else if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```\n/, "").replace(/\n```$/, "");
      }

      return JSON.parse(cleanText) as T;
    } catch (error) {
      console.error("Failed to parse JSON from LLM response:", error);
      console.error("Raw response:", response.text);
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

    throw new Error(
      `LLM request failed after ${maxRetries + 1} attempts: ${lastError?.message}`
    );
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
export function createGeminiClient(apiKey?: string): GeminiClient {
  return new GeminiClient(apiKey);
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
