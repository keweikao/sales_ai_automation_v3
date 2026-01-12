/**
 * MCP (Model Context Protocol) Module
 * 提供 Tool 管理與執行的統一介面
 */

// ============================================================
// Types
// ============================================================

export type {
  CategorizedTool,
  ExecutionContext,
  MCPTool,
  ToolCall,
  ToolCategory,
  ToolDefinition,
  ToolResult,
} from "./types.js";

export {
  ToolExecutionError,
  ToolNotFoundError,
  ToolValidationError,
} from "./types.js";

// ============================================================
// Server
// ============================================================

export { createMCPServer, MCPServer } from "./server.js";

// ============================================================
// Tools
// ============================================================

export * from "./tools/index.js";
