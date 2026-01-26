/**
 * Test Gemini API connectivity
 * Run with: cd apps/queue-worker && npx wrangler dev --test-scheduled
 * Then in another terminal: curl http://localhost:8787/__test-gemini
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface Env {
  GEMINI_API_KEY: string;
  GEMINI_API_KEY_ICHEF?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/__test-gemini") {
      const apiKey = env.GEMINI_API_KEY_ICHEF || env.GEMINI_API_KEY;

      if (!apiKey) {
        return new Response(JSON.stringify({
          status: "error",
          message: "GEMINI_API_KEY not found"
        }), { status: 500 });
      }

      console.log("Testing Gemini API...");
      console.log("API Key prefix:", apiKey.substring(0, 10) + "...");

      const genAI = new GoogleGenerativeAI(apiKey);

      // Test both models used in MEDDIC analysis
      const results: Record<string, unknown> = {};

      for (const modelName of ["gemini-2.5-flash", "gemini-2.5-pro"]) {
        const startTime = Date.now();
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent("Say 'OK' in one word.");
          const response = result.response;
          const text = response.text();

          results[modelName] = {
            status: "success",
            response: text.trim(),
            latency: Date.now() - startTime
          };
          console.log(`✅ ${modelName}: OK (${Date.now() - startTime}ms)`);
        } catch (error: unknown) {
          const err = error as Error & { status?: number; errorDetails?: unknown };
          results[modelName] = {
            status: "error",
            message: err.message,
            httpStatus: err.status,
            details: err.errorDetails,
            latency: Date.now() - startTime
          };
          console.error(`❌ ${modelName}: ${err.message}`);
        }
      }

      return new Response(JSON.stringify(results, null, 2), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("Use /__test-gemini to test Gemini API", { status: 404 });
  }
};
