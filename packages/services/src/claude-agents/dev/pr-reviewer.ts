/**
 * PR 審查代理人
 *
 * 使用 Claude Agent SDK 自動審查 Pull Request
 * - 檢查型別安全性
 * - 掃描安全漏洞
 * - 驗證測試覆蓋
 * - 檢查 MEDDIC 相關邏輯
 *
 * @example
 * ```typescript
 * const result = await reviewPullRequest(123, {
 *   focusAreas: ["security", "types", "meddic"],
 * });
 *
 * if (result.approved) {
 *   console.log("PR 審查通過");
 * } else {
 *   console.log("需要修改:", result.issues);
 * }
 * ```
 */

import {
  executeAgent,
  getMcpServers,
  type PRReviewFocusArea,
  type PRReviewOptions,
  type PRReviewResult,
  PRReviewResultSchema,
} from "@sales_ai_automation_v3/claude-sdk";

/**
 * 建立 PR 審查 prompt
 */
function buildReviewPrompt(
  prNumber: number,
  focusAreas: PRReviewFocusArea[]
): string {
  const focusAreasText = focusAreas
    .map((area) => {
      switch (area) {
        case "security":
          return "- 安全性：檢查 OWASP Top 10 漏洞、API 金鑰洩漏、SQL 注入等";
        case "types":
          return "- 型別安全：檢查 TypeScript 型別正確性、any 使用、型別斷言";
        case "tests":
          return "- 測試覆蓋：確認是否有對應的測試變更、邊界情況處理";
        case "meddic":
          return "- MEDDIC 邏輯：驗證代理人邏輯、DAG 依賴、prompt 品質";
        case "performance":
          return "- 效能：檢查 N+1 查詢、大量迴圈、記憶體洩漏";
        default:
          return `- ${area}`;
      }
    })
    .join("\n");

  return `
你是 Sales AI Automation V3 專案的程式碼審查專家。請審查 PR #${prNumber}。

## 專案背景
這是一個 B2B 銷售 AI 自動化系統，使用：
- TypeScript + Bun
- Cloudflare Workers (Hono 框架)
- Neon PostgreSQL + Drizzle ORM
- 7 個 MEDDIC 代理人 (packages/services/src/llm/agents.ts)
- DAG 編排器 (packages/services/src/llm/orchestrator.ts)
- 60+ MCP 工具 (packages/services/src/mcp/)

## 審查重點
${focusAreasText}

## 請執行以下步驟

### 1. 讀取 PR 變更
首先，使用 Bash 取得 PR 的變更檔案列表：
\`\`\`bash
gh pr diff ${prNumber} --name-only
\`\`\`

然後讀取每個變更的檔案內容。

### 2. 分析程式碼
對每個變更的檔案：
- 使用 Read 工具讀取完整檔案了解上下文
- 使用 Grep 搜尋相關的型別定義和依賴
- 檢查是否符合專案規範

### 3. 特別注意
如果變更涉及 \`packages/services/src/llm/\`：
- 驗證代理人是否正確註冊到 DAG (orchestrator.ts)
- 檢查 prompt 格式是否符合模板
- 確認輸出型別符合 types.ts 定義

如果變更涉及資料庫相關：
- 檢查是否有 SQL 注入風險
- 驗證 Drizzle schema 變更是否需要 migration

### 4. 安全掃描
掃描是否有：
- API 金鑰或密碼硬編碼
- 敏感資訊洩漏 (.env 內容)
- 不安全的 eval() 或 Function() 使用
- 未驗證的使用者輸入

### 5. 輸出審查結果
請以 JSON 格式輸出審查結果，格式如下：

\`\`\`json
{
  "summary": "簡短摘要這個 PR 的變更內容和品質",
  "issues": [
    {
      "severity": "error",
      "file": "packages/services/src/llm/agents.ts",
      "line": 123,
      "message": "問題描述",
      "suggestion": "建議的修復方式"
    }
  ],
  "suggestions": ["改善建議1", "改善建議2"],
  "securityConcerns": ["安全疑慮（如有）"],
  "testCoverage": "adequate",
  "overallScore": 85,
  "approved": true
}
\`\`\`

severity 可以是: "error" (必須修復), "warning" (建議修復), "info" (資訊)
testCoverage 可以是: "adequate" (足夠), "needs_improvement" (需改善), "missing" (缺少)
overallScore 範圍 0-100
approved 為 true 表示可以合併，false 表示需要修改
`;
}

/**
 * 解析審查結果
 */
function parseReviewResult(content: string): PRReviewResult {
  // 嘗試從內容中提取 JSON
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch?.[1] ?? content;

  // 嘗試找到 JSON 物件
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    // 返回預設結果
    return {
      summary: content.slice(0, 500),
      issues: [],
      suggestions: ["無法解析審查結果，請手動檢查"],
      securityConcerns: [],
      testCoverage: "needs_improvement",
      overallScore: 50,
      approved: false,
    };
  }

  try {
    const parsed = JSON.parse(objectMatch[0]);
    // 使用 Zod 驗證
    return PRReviewResultSchema.parse(parsed);
  } catch {
    return {
      summary: content.slice(0, 500),
      issues: [],
      suggestions: ["JSON 解析失敗，請手動檢查"],
      securityConcerns: [],
      testCoverage: "needs_improvement",
      overallScore: 50,
      approved: false,
    };
  }
}

/**
 * 執行 PR 審查
 *
 * @param prNumber - PR 編號
 * @param options - 審查選項
 * @returns 審查結果
 *
 * @throws Error 如果審查過程失敗
 */
export async function reviewPullRequest(
  prNumber: number,
  options?: PRReviewOptions
): Promise<PRReviewResult> {
  const focusAreas = options?.focusAreas ?? [
    "security",
    "types",
    "tests",
    "meddic",
  ];

  const prompt = buildReviewPrompt(prNumber, focusAreas);

  const result = await executeAgent({
    prompt,
    tools: ["Read", "Glob", "Grep", "Bash"],
    mcpServers: getMcpServers(["github"]),
    permissionMode: "default",
    maxTurns: 30,
  });

  if (!result.success) {
    throw new Error(`PR 審查失敗: ${result.error}`);
  }

  return parseReviewResult(result.content);
}

/**
 * 快速安全掃描
 *
 * 只執行安全相關的檢查，速度較快
 *
 * @param prNumber - PR 編號
 * @returns 安全掃描結果
 */
export async function securityScan(
  prNumber: number
): Promise<Pick<PRReviewResult, "securityConcerns" | "issues">> {
  const result = await reviewPullRequest(prNumber, {
    focusAreas: ["security"],
  });

  return {
    securityConcerns: result.securityConcerns,
    issues: result.issues.filter((issue) => issue.severity === "error"),
  };
}

/**
 * 格式化審查結果為 Markdown
 *
 * @param result - 審查結果
 * @returns Markdown 格式的審查報告
 */
export function formatReviewAsMarkdown(result: PRReviewResult): string {
  const statusEmoji = result.approved ? "✅" : "❌";
  const scoreEmoji =
    result.overallScore >= 80 ? "🟢" : result.overallScore >= 60 ? "🟡" : "🔴";

  let markdown = `## ${statusEmoji} PR 審查結果\n\n`;
  markdown += `**評分**: ${scoreEmoji} ${result.overallScore}/100\n`;
  markdown += `**測試覆蓋**: ${result.testCoverage}\n`;
  markdown += `**可合併**: ${result.approved ? "是" : "否"}\n\n`;

  markdown += `### 摘要\n${result.summary}\n\n`;

  if (result.issues.length > 0) {
    markdown += `### 問題 (${result.issues.length})\n\n`;
    for (const issue of result.issues) {
      const icon =
        issue.severity === "error"
          ? "🔴"
          : issue.severity === "warning"
            ? "🟡"
            : "🔵";
      markdown += `${icon} **${issue.file}${issue.line ? `:${issue.line}` : ""}**\n`;
      markdown += `> ${issue.message}\n`;
      if (issue.suggestion) {
        markdown += `> 💡 ${issue.suggestion}\n`;
      }
      markdown += "\n";
    }
  }

  if (result.securityConcerns.length > 0) {
    markdown += "### 🔒 安全疑慮\n\n";
    for (const concern of result.securityConcerns) {
      markdown += `- ${concern}\n`;
    }
    markdown += "\n";
  }

  if (result.suggestions.length > 0) {
    markdown += "### 💡 建議\n\n";
    for (const suggestion of result.suggestions) {
      markdown += `- ${suggestion}\n`;
    }
  }

  return markdown;
}
