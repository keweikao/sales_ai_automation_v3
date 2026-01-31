/**
 * Claude Agent SDK 客戶端封裝
 *
 * 提供統一的 API 調用介面，封裝 @anthropic-ai/claude-code SDK
 *
 * @example
 * ```typescript
 * import { executeAgent, streamAgent } from "@sales_ai_automation_v3/claude-sdk/client";
 *
 * // 執行任務
 * const result = await executeAgent({
 *   prompt: "分析這個 PR 的變更",
 *   tools: ["Read", "Glob", "Grep"],
 *   mcpServers: getMcpServers(["github"]),
 * });
 *
 * // 串流執行
 * for await (const chunk of streamAgent({ prompt: "..." })) {
 *   console.log(chunk.content);
 * }
 * ```
 */

import type { AgentResult, ClaudeAgentOptions } from "./types.js";

// ============================================================
// 內部工具函式
// ============================================================

/**
 * 動態載入 Claude Code SDK
 * 避免在 SDK 未安裝時產生 import 錯誤
 */
async function loadClaudeCodeSDK() {
  try {
    const sdk = await import("@anthropic-ai/claude-code");
    return sdk;
  } catch {
    throw new Error(
      "Claude Code SDK not installed. Please run: bun add @anthropic-ai/claude-code"
    );
  }
}

/**
 * 驗證必要的環境變數
 */
function validateEnvironment(): void {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required");
  }
}

// ============================================================
// 主要 API
// ============================================================

/**
 * 執行 Claude Agent 任務
 *
 * 這是主要的執行函式，會等待任務完成並返回結果
 *
 * @param options - 執行選項
 * @returns 執行結果
 *
 * @example
 * ```typescript
 * const result = await executeAgent({
 *   prompt: "列出所有 TypeScript 檔案",
 *   tools: ["Glob"],
 * });
 *
 * if (result.success) {
 *   console.log(result.content);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export async function executeAgent(
  options: ClaudeAgentOptions
): Promise<AgentResult> {
  validateEnvironment();

  const startTime = Date.now();
  const results: string[] = [];
  const toolsUsed: string[] = [];
  let tokensUsed = 0;

  try {
    const { query } = await loadClaudeCodeSDK();

    for await (const message of query({
      prompt: options.prompt,
      options: {
        allowedTools: options.tools,
        mcpServers: options.mcpServers,
        permissionMode: options.permissionMode ?? "default",
        maxTurns: options.maxTurns ?? 50,
      },
    })) {
      // 處理助理訊息
      if (message.type === "assistant" && message.message?.content) {
        for (const block of message.message.content) {
          if (block.type === "text") {
            results.push(block.text);
          }
        }
      }

      // 追蹤工具使用
      if (message.type === "tool_use") {
        toolsUsed.push(message.name);
      }

      // 追蹤 token 使用量
      if (message.type === "result" && message.usage) {
        tokensUsed +=
          (message.usage.input_tokens ?? 0) +
          (message.usage.output_tokens ?? 0);
      }
    }

    return {
      success: true,
      content: results.join("\n"),
      toolsUsed: [...new Set(toolsUsed)],
      tokensUsed,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      content: "",
      toolsUsed,
      tokensUsed,
      executionTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 串流執行 Claude Agent 任務
 *
 * 使用 AsyncGenerator 即時返回執行過程中的訊息
 *
 * @param options - 執行選項
 * @yields 執行過程中的訊息
 *
 * @example
 * ```typescript
 * for await (const chunk of streamAgent({ prompt: "分析程式碼" })) {
 *   if (chunk.type === "text") {
 *     process.stdout.write(chunk.content);
 *   } else if (chunk.type === "tool") {
 *     console.log(`使用工具: ${chunk.content}`);
 *   }
 * }
 * ```
 */
export async function* streamAgent(
  options: ClaudeAgentOptions
): AsyncGenerator<{ type: "text" | "tool" | "error"; content: string }> {
  validateEnvironment();

  try {
    const { query } = await loadClaudeCodeSDK();

    for await (const message of query({
      prompt: options.prompt,
      options: {
        allowedTools: options.tools,
        mcpServers: options.mcpServers,
        permissionMode: options.permissionMode ?? "default",
        maxTurns: options.maxTurns ?? 50,
      },
    })) {
      if (message.type === "assistant" && message.message?.content) {
        for (const block of message.message.content) {
          if (block.type === "text") {
            yield { type: "text", content: block.text };
          }
        }
      }

      if (message.type === "tool_use") {
        yield { type: "tool", content: message.name };
      }
    }
  } catch (error) {
    yield {
      type: "error",
      content: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 執行簡單的 Claude 查詢（無工具）
 *
 * 適用於只需要文字回覆的簡單任務
 *
 * @param prompt - 查詢 prompt
 * @returns 回覆內容
 *
 * @example
 * ```typescript
 * const answer = await simpleQuery("解釋 MEDDIC 銷售方法論");
 * console.log(answer);
 * ```
 */
export async function simpleQuery(prompt: string): Promise<string> {
  const result = await executeAgent({
    prompt,
    tools: [],
    maxTurns: 1,
  });

  if (!result.success) {
    throw new Error(result.error ?? "Query failed");
  }

  return result.content;
}

/**
 * 執行程式碼分析任務
 *
 * 預設啟用 Read, Glob, Grep 工具
 *
 * @param prompt - 分析 prompt
 * @param options - 額外選項
 * @returns 分析結果
 *
 * @example
 * ```typescript
 * const result = await analyzeCode("找出所有使用 console.log 的地方");
 * console.log(result.content);
 * ```
 */
export async function analyzeCode(
  prompt: string,
  options?: Partial<ClaudeAgentOptions>
): Promise<AgentResult> {
  return executeAgent({
    prompt,
    tools: ["Read", "Glob", "Grep", ...(options?.tools ?? [])],
    ...options,
  });
}

/**
 * 執行程式碼修改任務
 *
 * 預設啟用 Read, Edit, Write 工具
 *
 * @param prompt - 修改 prompt
 * @param options - 額外選項
 * @returns 修改結果
 *
 * @example
 * ```typescript
 * const result = await modifyCode("將所有 console.log 改為 logger.info");
 * console.log(`修改了 ${result.toolsUsed.length} 個檔案`);
 * ```
 */
export async function modifyCode(
  prompt: string,
  options?: Partial<ClaudeAgentOptions>
): Promise<AgentResult> {
  return executeAgent({
    prompt,
    tools: ["Read", "Edit", "Write", "Glob", "Grep", ...(options?.tools ?? [])],
    permissionMode: "acceptEdits",
    ...options,
  });
}

/**
 * 執行 Shell 指令任務
 *
 * 預設啟用 Bash 工具
 *
 * @param prompt - 指令 prompt
 * @param options - 額外選項
 * @returns 執行結果
 *
 * @example
 * ```typescript
 * const result = await executeShell("執行測試並顯示失敗的測試");
 * console.log(result.content);
 * ```
 */
export async function executeShell(
  prompt: string,
  options?: Partial<ClaudeAgentOptions>
): Promise<AgentResult> {
  return executeAgent({
    prompt,
    tools: ["Bash", ...(options?.tools ?? [])],
    ...options,
  });
}
