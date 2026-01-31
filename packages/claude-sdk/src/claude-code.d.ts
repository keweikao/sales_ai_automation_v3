/**
 * @anthropic-ai/claude-code SDK 型別宣告
 *
 * 這是外部 SDK 的型別宣告，用於 TypeScript 編譯
 * 實際執行時會動態載入真正的套件
 */

declare module "@anthropic-ai/claude-code" {
  export interface QueryOptions {
    /** 允許使用的工具列表 */
    allowedTools?: string[];
    /** MCP Server 配置 */
    mcpServers?: Record<
      string,
      {
        command: string;
        args: string[];
        env?: Record<string, string>;
      }
    >;
    /** 權限模式 */
    permissionMode?: "default" | "acceptEdits" | "bypassPermissions";
    /** 最大執行回合數 */
    maxTurns?: number;
    /** 工作目錄 */
    cwd?: string;
  }

  export interface QueryInput {
    prompt: string;
    options?: QueryOptions;
  }

  export interface TextBlock {
    type: "text";
    text: string;
  }

  export interface ToolUseBlock {
    type: "tool_use";
    id: string;
    name: string;
    input: unknown;
  }

  export type ContentBlock = TextBlock | ToolUseBlock;

  export interface AssistantMessage {
    type: "assistant";
    message?: {
      content: ContentBlock[];
    };
  }

  export interface ToolUseMessage {
    type: "tool_use";
    name: string;
  }

  export interface ResultMessage {
    type: "result";
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  }

  export type StreamMessage = AssistantMessage | ToolUseMessage | ResultMessage;

  /**
   * 執行 Claude Agent 查詢
   */
  export function query(input: QueryInput): AsyncIterable<StreamMessage>;
}
