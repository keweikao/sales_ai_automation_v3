/**
 * E2E 測試修復代理人 - Phase 3
 *
 * 使用 Claude Agent SDK + Playwright MCP 進行 E2E 測試診斷和修復
 *
 * 功能:
 * - 分析失敗的 E2E 測試
 * - 自動執行測試並捕獲錯誤
 * - 生成修復建議
 * - 自動修復常見問題
 *
 * @example
 * ```typescript
 * import { diagnoseE2ETests, fixE2ETest } from "@sales_ai_automation_v3/services/claude-agents/dev/e2e-fixer";
 *
 * const diagnosis = await diagnoseE2ETests();
 * if (diagnosis.failedTests.length > 0) {
 *   const fixes = await fixE2ETest(diagnosis.failedTests[0]);
 * }
 * ```
 */

import {
  executeAgent,
  getMcpServers,
} from "@sales_ai_automation_v3/claude-sdk";

// ============================================================
// Types
// ============================================================

export interface E2ETestResult {
  /** 測試檔案路徑 */
  file: string;
  /** 測試名稱 */
  name: string;
  /** 是否通過 */
  passed: boolean;
  /** 錯誤訊息（如果失敗） */
  error?: string;
  /** 執行時間（毫秒） */
  duration?: number;
  /** 截圖路徑（如果有） */
  screenshot?: string;
}

export interface E2EDiagnosis {
  /** 總測試數 */
  totalTests: number;
  /** 通過的測試 */
  passedTests: E2ETestResult[];
  /** 失敗的測試 */
  failedTests: E2ETestResult[];
  /** 跳過的測試 */
  skippedTests: E2ETestResult[];
  /** 環境問題 */
  environmentIssues: string[];
  /** 建議 */
  recommendations: string[];
}

export interface E2EFixResult {
  /** 測試名稱 */
  testName: string;
  /** 是否成功修復 */
  fixed: boolean;
  /** 修復的檔案 */
  modifiedFiles: string[];
  /** 修復說明 */
  description: string;
  /** 需要手動處理的項目 */
  manualSteps?: string[];
}

export interface E2EFixOptions {
  /** 是否自動應用修復 */
  autoApply?: boolean;
  /** 是否只診斷不修復 */
  diagnosisOnly?: boolean;
  /** 是否包含截圖分析 */
  includeScreenshots?: boolean;
}

// ============================================================
// Prompt Builders
// ============================================================

function buildDiagnosePrompt(): string {
  return `你是 E2E 測試專家。請診斷此專案的 E2E 測試問題。

## 專案背景
這是一個 Sales AI Automation 系統，使用：
- Playwright 進行 E2E 測試
- Bun 作為執行環境
- TypeScript
- 測試位於 tests/e2e/ 目錄

## 診斷步驟

### 1. 檢查測試檔案
讀取 tests/e2e/ 目錄中的測試檔案：
- 檢查測試結構
- 識別可能的問題

### 2. 檢查 Playwright 配置
讀取 playwright.config.ts：
- 檢查 webServer 配置
- 檢查 baseURL 設定
- 檢查 timeout 設定

### 3. 檢查 CI 配置
讀取 .github/workflows/test.yml：
- 了解 E2E 測試被禁用的原因
- 檢查環境變數需求

### 4. 嘗試執行測試
使用 Playwright 執行測試（dry-run 或實際執行）：
- 捕獲錯誤訊息
- 識別失敗模式

### 5. 分析問題
根據收集的資訊：
- 識別環境問題
- 識別配置問題
- 識別測試代碼問題

## 輸出格式
請以 JSON 格式輸出診斷結果：
\`\`\`json
{
  "totalTests": 10,
  "passedTests": [],
  "failedTests": [
    {
      "file": "tests/e2e/auth.spec.ts",
      "name": "should login successfully",
      "passed": false,
      "error": "錯誤描述"
    }
  ],
  "skippedTests": [],
  "environmentIssues": [
    "WebServer 配置指向錯誤的端口"
  ],
  "recommendations": [
    "更新 playwright.config.ts 的 webServer 配置",
    "添加缺少的環境變數"
  ]
}
\`\`\`
`;
}

function buildFixPrompt(
  testResult: E2ETestResult,
  options: E2EFixOptions
): string {
  return `你是 E2E 測試修復專家。請修復以下失敗的測試。

## 失敗的測試
- 檔案: ${testResult.file}
- 名稱: ${testResult.name}
- 錯誤: ${testResult.error ?? "未知錯誤"}

## 修復步驟

### 1. 分析錯誤
- 讀取測試檔案
- 理解測試意圖
- 分析錯誤原因

### 2. 檢查相關代碼
- 檢查被測試的頁面或組件
- 檢查 selector 是否正確
- 檢查 API 端點是否存在

### 3. ${options.autoApply ? "應用修復" : "生成修復建議"}
${
  options.autoApply
    ? `使用 Edit 工具修復問題：
- 修復 selector
- 更新等待邏輯
- 修正斷言`
    : `生成修復建議：
- 描述需要的修改
- 提供代碼範例`
}

${
  options.includeScreenshots
    ? `### 4. 截圖分析
如果有截圖，分析截圖以了解 UI 狀態`
    : ""
}

## 輸出格式
請以 JSON 格式輸出修復結果：
\`\`\`json
{
  "testName": "${testResult.name}",
  "fixed": true,
  "modifiedFiles": ["tests/e2e/auth.spec.ts"],
  "description": "修復了 selector 選擇器",
  "manualSteps": ["需要手動驗證登入流程"]
}
\`\`\`
`;
}

function buildRunTestsPrompt(testFile?: string): string {
  const fileFilter = testFile ? `只執行 ${testFile}` : "執行所有測試";

  return `你是 E2E 測試執行專家。請使用 Playwright 執行 E2E 測試。

## 任務
${fileFilter}

## 步驟

### 1. 準備環境
- 確認 Playwright 已安裝
- 檢查環境變數

### 2. 執行測試
使用 Playwright MCP 執行測試：
${testFile ? `- 執行: npx playwright test ${testFile}` : "- 執行: npx playwright test"}
- 捕獲輸出和錯誤

### 3. 收集結果
- 解析測試結果
- 收集失敗的測試資訊
- 收集截圖（如果有）

## 輸出格式
請以 JSON 格式輸出測試結果：
\`\`\`json
{
  "success": false,
  "totalTests": 10,
  "passed": 8,
  "failed": 2,
  "results": [
    {
      "file": "tests/e2e/auth.spec.ts",
      "name": "should login successfully",
      "passed": false,
      "error": "Timeout waiting for selector"
    }
  ]
}
\`\`\`
`;
}

// ============================================================
// Result Parsers
// ============================================================

function parseDiagnosis(content: string): E2EDiagnosis {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch?.[1] ?? content;

  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return {
      totalTests: 0,
      passedTests: [],
      failedTests: [],
      skippedTests: [],
      environmentIssues: ["無法解析診斷結果"],
      recommendations: ["請手動檢查測試"],
    };
  }

  try {
    return JSON.parse(objectMatch[0]) as E2EDiagnosis;
  } catch {
    return {
      totalTests: 0,
      passedTests: [],
      failedTests: [],
      skippedTests: [],
      environmentIssues: [content.slice(0, 500)],
      recommendations: [],
    };
  }
}

function parseFixResult(content: string): E2EFixResult {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch?.[1] ?? content;

  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return {
      testName: "unknown",
      fixed: false,
      modifiedFiles: [],
      description: "無法解析修復結果",
      manualSteps: ["請手動檢查"],
    };
  }

  try {
    return JSON.parse(objectMatch[0]) as E2EFixResult;
  } catch {
    return {
      testName: "unknown",
      fixed: false,
      modifiedFiles: [],
      description: content.slice(0, 500),
    };
  }
}

// ============================================================
// Main Functions
// ============================================================

/**
 * 診斷 E2E 測試問題
 *
 * 分析專案的 E2E 測試配置和問題
 *
 * @returns 診斷結果
 *
 * @example
 * ```typescript
 * const diagnosis = await diagnoseE2ETests();
 *
 * if (diagnosis.failedTests.length > 0) {
 *   console.log(`發現 ${diagnosis.failedTests.length} 個失敗的測試`);
 *   diagnosis.recommendations.forEach(rec => console.log(`- ${rec}`));
 * }
 * ```
 */
export async function diagnoseE2ETests(): Promise<E2EDiagnosis> {
  const prompt = buildDiagnosePrompt();

  const result = await executeAgent({
    prompt,
    tools: ["Read", "Glob", "Grep", "Bash"],
    mcpServers: getMcpServers(["playwright"]),
    permissionMode: "default",
    maxTurns: 30,
  });

  if (!result.success) {
    throw new Error(`E2E 診斷失敗: ${result.error}`);
  }

  return parseDiagnosis(result.content);
}

/**
 * 修復失敗的 E2E 測試
 *
 * @param testResult - 失敗的測試結果
 * @param options - 修復選項
 * @returns 修復結果
 *
 * @example
 * ```typescript
 * const fix = await fixE2ETest({
 *   file: "tests/e2e/auth.spec.ts",
 *   name: "should login successfully",
 *   passed: false,
 *   error: "Timeout waiting for selector"
 * }, { autoApply: false });
 *
 * if (fix.fixed) {
 *   console.log(`修復了: ${fix.description}`);
 * } else {
 *   console.log("需要手動修復:", fix.manualSteps);
 * }
 * ```
 */
export async function fixE2ETest(
  testResult: E2ETestResult,
  options: E2EFixOptions = {}
): Promise<E2EFixResult> {
  const prompt = buildFixPrompt(testResult, options);

  const result = await executeAgent({
    prompt,
    tools: ["Read", "Glob", "Grep", "Edit", "Bash"],
    mcpServers: getMcpServers(["playwright"]),
    permissionMode: options.autoApply ? "acceptEdits" : "default",
    maxTurns: 25,
  });

  if (!result.success) {
    throw new Error(`E2E 修復失敗: ${result.error}`);
  }

  return parseFixResult(result.content);
}

/**
 * 執行 E2E 測試
 *
 * @param testFile - 可選的測試檔案路徑
 * @returns 測試執行結果
 *
 * @example
 * ```typescript
 * // 執行所有測試
 * const results = await runE2ETests();
 *
 * // 執行特定測試
 * const authResults = await runE2ETests("tests/e2e/auth.spec.ts");
 * ```
 */
export async function runE2ETests(
  testFile?: string
): Promise<{ success: boolean; results: E2ETestResult[] }> {
  const prompt = buildRunTestsPrompt(testFile);

  const result = await executeAgent({
    prompt,
    tools: ["Bash"],
    mcpServers: getMcpServers(["playwright"]),
    permissionMode: "default",
    maxTurns: 15,
  });

  if (!result.success) {
    throw new Error(`E2E 測試執行失敗: ${result.error}`);
  }

  // 解析結果
  const jsonMatch = result.content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch?.[1] ?? result.content;

  try {
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      const parsed = JSON.parse(objectMatch[0]) as {
        success: boolean;
        results: E2ETestResult[];
      };
      return parsed;
    }
  } catch {
    // 解析失敗
  }

  return {
    success: false,
    results: [],
  };
}

/**
 * 格式化 E2E 診斷結果為 Markdown
 *
 * @param diagnosis - 診斷結果
 * @returns Markdown 格式的報告
 */
export function formatDiagnosisAsMarkdown(diagnosis: E2EDiagnosis): string {
  const passRate =
    diagnosis.totalTests > 0
      ? ((diagnosis.passedTests.length / diagnosis.totalTests) * 100).toFixed(1)
      : "0";

  let markdown = "## 🧪 E2E 測試診斷報告\n\n";

  markdown += "### 測試統計\n\n";
  markdown += "| 指標 | 數量 |\n";
  markdown += "|------|------|\n";
  markdown += `| 總測試數 | ${diagnosis.totalTests} |\n`;
  markdown += `| 通過 | ${diagnosis.passedTests.length} |\n`;
  markdown += `| 失敗 | ${diagnosis.failedTests.length} |\n`;
  markdown += `| 跳過 | ${diagnosis.skippedTests.length} |\n`;
  markdown += `| 通過率 | ${passRate}% |\n\n`;

  if (diagnosis.failedTests.length > 0) {
    markdown += "### ❌ 失敗的測試\n\n";
    for (const test of diagnosis.failedTests) {
      markdown += `#### ${test.name}\n`;
      markdown += `- **檔案**: \`${test.file}\`\n`;
      markdown += `- **錯誤**: ${test.error ?? "未知"}\n\n`;
    }
  }

  if (diagnosis.environmentIssues.length > 0) {
    markdown += "### ⚠️ 環境問題\n\n";
    for (const issue of diagnosis.environmentIssues) {
      markdown += `- ${issue}\n`;
    }
    markdown += "\n";
  }

  if (diagnosis.recommendations.length > 0) {
    markdown += "### 💡 建議\n\n";
    for (const rec of diagnosis.recommendations) {
      markdown += `- ${rec}\n`;
    }
  }

  return markdown;
}

/**
 * 格式化修復結果為 Markdown
 *
 * @param fix - 修復結果
 * @returns Markdown 格式的報告
 */
export function formatFixAsMarkdown(fix: E2EFixResult): string {
  const statusEmoji = fix.fixed ? "✅" : "❌";

  let markdown = `## ${statusEmoji} E2E 測試修復結果\n\n`;
  markdown += `**測試**: ${fix.testName}\n`;
  markdown += `**狀態**: ${fix.fixed ? "已修復" : "需要手動處理"}\n\n`;

  markdown += `### 修復說明\n${fix.description}\n\n`;

  if (fix.modifiedFiles.length > 0) {
    markdown += "### 修改的檔案\n";
    for (const file of fix.modifiedFiles) {
      markdown += `- \`${file}\`\n`;
    }
    markdown += "\n";
  }

  if (fix.manualSteps && fix.manualSteps.length > 0) {
    markdown += "### 📋 需要手動處理\n";
    for (const step of fix.manualSteps) {
      markdown += `- [ ] ${step}\n`;
    }
  }

  return markdown;
}
