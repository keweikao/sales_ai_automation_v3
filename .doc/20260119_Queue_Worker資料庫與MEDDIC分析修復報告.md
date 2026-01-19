# Queue Worker 資料庫連線與 MEDDIC 分析修復報告

**日期**: 2026-01-19
**狀態**: 部分完成 - 資料庫問題已解決，MEDDIC 分析仍需優化
**負責人**: Claude + Stephen

---

## 📋 執行摘要

今日主要解決 Queue Worker 在 Cloudflare Workers 環境中的兩大核心問題:

1. ✅ **Neon PostgreSQL 資料庫連線失敗** - 已完全解決
2. ⚠️ **MEDDIC 分析 JSON 解析錯誤** - 已實作修復但仍需進一步測試

### 關鍵成果

- 成功將 Neon 連線從 WebSocket 模式切換至 HTTP 模式
- 修復 `duration` 欄位型別不匹配問題 (float → integer)
- 升級 Gemini 模型至 2.5 Flash 以提高 API 配額
- 強化 JSON 解析邏輯以處理 LLM 返回的 markdown 格式

---

## 🔍 問題分析

### 問題 1: Neon PostgreSQL 連線失敗

#### 現象
```
Error: Failed query: update "conversations" set "status" = $1, "transcript" = $2, "duration" = $3, "updated_at" = $4 where "conversations"."id" = $5
```

#### 根本原因
Neon PostgreSQL 的 WebSocket-based 連線在 Cloudflare Workers 的 Queue Consumer 環境中不相容:

1. **環境差異**:
   - ✅ Server (Hono) 端: 正常運作 (建立 conversation 記錄成功)
   - ❌ Queue Worker 端: 更新失敗

2. **技術原因**:
   - Queue Worker 使用舊的 `ws` package 配置 WebSocket
   - Cloudflare Workers 執行環境不支援 Node.js WebSocket 實作
   - Neon 預設使用 WebSocket 進行連線池管理

#### 解決方案

**方案選擇**: 使用 Neon HTTP API (最小改動方案)

**修改檔案 1**: `/packages/db/src/index.ts`

```typescript
// 修改前 (WebSocket 模式)
import { neon, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;  // ❌ Workers 不支援
neonConfig.poolQueryViaFetch = true;

const sql = neon(env.DATABASE_URL || "");
export const db = drizzle(sql, { schema });

// 修改後 (HTTP 模式)
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

// Cloudflare Workers 專用 HTTP 配置 (預設使用連線池)
const sql = neon(env.DATABASE_URL || "");

export const db = drizzle(sql, { schema });
```

**修改檔案 2**: `/packages/db/package.json`

```diff
  "dependencies": {
    "@Sales_ai_automation_v3/env": "workspace:*",
    "@neondatabase/serverless": "^1.0.2",
    "dotenv": "catalog:",
    "drizzle-orm": "^0.45.1",
-   "ws": "^8.18.3",
    "zod": "catalog:"
  }
```

---

### 問題 2: Duration 欄位型別不匹配

#### 現象
```
NeonDbError: invalid input syntax for type integer: "1944.74"
```

#### 根本原因
- Whisper API 返回音檔時間長度為浮點數 (如 `1944.74` 秒)
- PostgreSQL `conversations.duration` 欄位定義為 `INTEGER`
- 直接插入浮點數導致型別錯誤

#### 解決方案

**修改檔案**: `/apps/queue-worker/src/index.ts`

```typescript
// 計算 duration 時使用 Math.round() 轉換為整數
const duration = Math.round(
  transcriptResult.segments?.reduce(
    (max, seg) => Math.max(max, seg.end),
    0
  ) || 0
);

console.log("[Queue] DEBUG: duration =", duration, "type =", typeof duration);

const result = await sql`
  UPDATE conversations
  SET
    status = 'transcribed',
    transcript = ${JSON.stringify(transcriptData)}::jsonb,
    duration = ${duration},  // ✅ 現在是整數
    updated_at = NOW()
  WHERE id = ${conversationId}
  RETURNING *
`;
```

**測試結果**:
```
(log) [Queue] DEBUG: duration = 1945 type = number
(log) [Queue] DEBUG: Update result rows = 1
(log) [Queue] ✓ Database updated (transcribed)
```

---

### 問題 3: MEDDIC 分析 JSON 解析失敗

#### 現象
```
Failed to parse JSON from LLM response: SyntaxError: Unexpected token '*', "**Agent 1："... is not valid JSON
Failed to parse JSON from LLM response: SyntaxError: Unexpected non-whitespace character after JSON at position 450 (line 17 column 1)
### ❌ 未成交原因
```

#### 根本原因
1. **Gemini LLM 返回格式不一致**:
   - 有時返回 `**Agent 1：**` 等 markdown 粗體標記
   - 有時在 JSON 後面附加額外的 markdown 表格

2. **API 配額限制**:
   - `gemini-2.0-flash-exp` 每分鐘只能請求 10 次
   - DAG Executor 並行執行 4 個 agents 快速耗盡配額

#### 解決方案 (已實作但需驗證)

**方案 1: 強化 JSON 解析邏輯**

**修改檔案**: `/packages/services/src/llm/gemini.ts`

```typescript
async generateJSON<T = unknown>(
  prompt: string,
  options?: LLMOptions
): Promise<T> {
  // 更明確的 prompt 指示
  const jsonPrompt = `${prompt}\n\nIMPORTANT: Respond with ONLY a valid JSON object. Do NOT include:
- Markdown formatting (**, *, ~~, etc.)
- Code blocks (\`\`\`)
- Explanatory text before or after the JSON
- Any text that is not part of the JSON structure

Start your response with { and end with }`;

  const response = await this.generate(jsonPrompt, {
    ...options,
    temperature: options?.temperature ?? 0.3,
  });

  try {
    let cleanText = response.text.trim();

    // Remove markdown code blocks
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```\n/, "").replace(/\n```$/, "");
    }

    // ✅ 新增: 提取 JSON 邊界
    const jsonStart = cleanText.indexOf("{");
    const jsonEnd = cleanText.lastIndexOf("}");

    if (jsonStart === -1 || jsonEnd === -1 || jsonStart > jsonEnd) {
      throw new Error("No valid JSON object found in response");
    }

    // 只提取 {...} 之間的內容
    cleanText = cleanText.substring(jsonStart, jsonEnd + 1);

    return JSON.parse(cleanText) as T;
  } catch (error) {
    console.error("Failed to parse JSON from LLM response:", error);
    console.error("Raw response:", response.text.substring(0, 500));
    throw new Error(`Invalid JSON response from LLM: ${error}`);
  }
}
```

**方案 2: 升級 Gemini 模型**

```typescript
export class GeminiClient implements LLMClient {
  private readonly genAI: GoogleGenerativeAI;
  // 從 gemini-2.0-flash-exp 升級至 gemini-2.5-flash
  private readonly defaultModel = "gemini-2.5-flash"; // ✅ 更高配額

  // ...
}
```

**好處**:
- `gemini-2.5-flash` 有更高的 API 配額限制
- 根據 Google 建議從實驗版本遷移至正式版本

---

## 🛠️ 完整修改清單

### 已修改檔案

1. **`/packages/db/src/index.ts`**
   - 移除 WebSocket 配置
   - 切換至 HTTP 模式

2. **`/packages/db/package.json`**
   - 移除 `ws` 依賴

3. **`/apps/queue-worker/src/index.ts`**
   - 添加 `Math.round()` 處理 duration
   - 使用 raw SQL 進行資料庫更新 (更清晰的錯誤訊息)
   - 添加 DEBUG 日誌

4. **`/packages/services/src/llm/gemini.ts`**
   - 升級模型至 `gemini-2.5-flash`
   - 強化 JSON 解析邏輯 (提取邊界)
   - 更明確的 prompt 指示

### 部署記錄

```bash
# Version 1: 修復資料庫連線
Current Version ID: 3f2da52f-2133-44fd-8882-090f9a2d3c28
Deployed: 2026-01-19 04:15 UTC

# Version 2: 修復 JSON 解析 + 升級模型
Current Version ID: 6375d289-9883-4f97-8b59-ce36a5685767
Deployed: 2026-01-19 04:16 UTC

# Version 3: 最終部署 (確保所有修復生效)
Current Version ID: b2d480e3-af89-4766-bca2-3b71518c0c08
Deployed: 2026-01-19 04:23 UTC
```

---

## 📊 測試結果

### ✅ 成功的部分

1. **Whisper 轉錄**: 成功完成 (9,200+ 字元)
   ```
   (log) [Queue] ✓ Transcription completed: 9246 chars
   ```

2. **資料庫更新 (transcribed 狀態)**: 成功
   ```
   (log) [Queue] DEBUG: duration = 1945 type = number
   (log) [Queue] DEBUG: Update result rows = 1
   (log) [Queue] ✓ Database updated (transcribed)
   ```

### ⚠️ 仍需解決的問題

**MEDDIC 分析失敗** (Conversation ID: `66c9be33-982a-4e33-94d4-19a0e30f5b71`)

最新測試結果 (Line 337-420):
- ✅ 音檔下載: 成功
- ✅ Whisper 轉錄: 成功
- ✅ 資料庫更新 (transcribed): 成功
- ❌ MEDDIC 分析: 失敗 (80 秒後超時)
  ```
  (error) [Queue] ❌ Failed 66c9be33-982a-4e33-94d4-19a0e30f5b71 after 79.9s:
  (error) Error: Incomplete analysis state. All agents must complete.
  ```

**觀察**:
- 新版本 (b2d480e3) 部署後,JSON 解析錯誤訊息消失
- 但分析仍然失敗,可能原因:
  1. API 配額仍然不足 (需要更長的等待時間)
  2. Gemini 2.5 Flash 的行為仍有 JSON 格式問題
  3. 某些 agents 執行超時

---

## 🎯 後續行動計畫

### 短期 (緊急)

1. **等待 API 配額重置** (建議等待 2-5 分鐘)
2. **重新測試完整流程**:
   - 上傳新的音檔
   - 監控完整的 MEDDIC 分析流程
   - 確認所有 6 個 agents 都能成功執行

### 中期 (優化)

3. **調整 DAG Executor 並行策略**:
   - 考慮減少並行數量以避免 API 配額問題
   - 實作更智能的重試機制

4. **增強錯誤處理**:
   - 當 JSON 解析失敗時,記錄完整的 LLM 回應用於除錯
   - 實作降級機制 (如果 agent 失敗多次,標記為部分完成)

5. **監控與告警**:
   - 設置 Gemini API 配額監控
   - 當連續失敗時發送告警

### 長期 (架構)

6. **評估其他 LLM 選項**:
   - Claude 3.5 Sonnet (可能有更好的 JSON 輸出)
   - OpenAI GPT-4 (已知對結構化輸出支援良好)

7. **考慮資料庫遷移** (如果 Neon 成為瓶頸):
   - Cloudflare D1 (零延遲,但需大量改動)
   - Cloudflare Hyperdrive (加速現有 PostgreSQL)

---

## 📝 技術債務

1. **移除 DEBUG 日誌**:
   - `/apps/queue-worker/src/index.ts` 中有多處 DEBUG 日誌
   - 驗證成功後應該移除或改為 INFO 等級

2. **Drizzle ORM vs Raw SQL**:
   - 目前 Queue Worker 使用 raw SQL
   - Server 端仍使用 Drizzle ORM
   - 需要統一或文件化這個差異

3. **錯誤處理一致性**:
   - 資料庫錯誤有時被 Drizzle 包裝
   - 有時直接拋出 NeonDbError
   - 需要標準化錯誤處理策略

---

## 🔗 相關文件

- [Queue Worker 源碼](../apps/queue-worker/src/index.ts)
- [Database 配置](../packages/db/src/index.ts)
- [Gemini Client](../packages/services/src/llm/gemini.ts)
- [MEDDIC Orchestrator](../packages/services/src/llm/orchestrator.ts)

---

## 📞 聯絡資訊

如有問題,請聯絡:
- **開發者**: Stephen Kao (stephen.kao@ichef.com.tw)
- **AI 助手**: Claude Sonnet 4.5

---

## 🎯 最終修復總結 (16:10 更新)

### 新發現的問題與修復

**問題 4: DAG Executor State 合併錯誤**

在測試過程中發現,當 DAG Executor 並行執行多個 agents 時,只保留了最後一個 agent 的 state,其他 agents 的輸出被覆蓋。

**修復**: [dag-executor.ts:83-94](../packages/services/src/llm/dag-executor.ts#L83-L94)

```typescript
// 修改前 (會覆蓋 state)
for (const result of groupResults) {
  if (result.success && result.state) {
    currentState = result.state;  // ❌ 覆蓋
  }
}

// 修改後 (正確合併)
for (const result of groupResults) {
  if (result.success && result.state) {
    currentState = {
      ...currentState,
      ...result.state,  // ✅ 合併
    };
  }
}
```

**問題 5: Slack 通知 Null 處理**

當部分 agents 失敗時,`analysisResult.dimensions` 可能為 `undefined`,導致 Slack 通知失敗。

**修復**: [queue-worker/src/index.ts:326-362](../apps/queue-worker/src/index.ts#L326-L362)

```typescript
// 安全處理 dimensions
if (analysisResult.dimensions) {
  for (const [key, value] of Object.entries(analysisResult.dimensions)) {
    convertedDimensions[key] = { ... };
  }
}

// 使用 nullish coalescing 提供預設值
analysisResult: {
  overallScore: analysisResult.overallScore ?? 0,
  qualificationStatus: analysisResult.qualificationStatus ?? "unknown",
  dimensions: convertedDimensions,
  keyFindings: analysisResult.keyFindings ?? [],
  nextSteps: (analysisResult.nextSteps ?? []).map(...),
  risks: (analysisResult.risks ?? []).map(...),
}
```

### 部署記錄 (完整)

```bash
# Version 1: 修復資料庫連線
Version ID: 3f2da52f-2133-44fd-8882-090f9a2d3c28
Deployed: 2026-01-19 04:15 UTC

# Version 2: 修復 JSON 解析 + 升級模型
Version ID: 6375d289-9883-4f97-8b59-ce36a5685767
Deployed: 2026-01-19 04:16 UTC

# Version 3: 確保所有修復生效
Version ID: b2d480e3-af89-4766-bca2-3b71518c0c08
Deployed: 2026-01-19 04:23 UTC

# Version 4: 第一次嘗試部署 gemini-2.5-flash (但 services 未正確建置)
Version ID: f84722ff-5853-4740-a997-a21195bffee3
Deployed: 2026-01-19 08:05 UTC

# Version 5: 正確建置後部署 gemini-2.5-flash + DAG state 合併修復
Version ID: 275d11f2-4923-45b0-a5a5-4c101ba2fdec
Deployed: 2026-01-19 08:09 UTC

# Version 6: 最終版本 - Slack 通知 null 處理修復
Version ID: 05c3c7b4-6188-4d6d-a14a-196737ca78f2
Deployed: 2026-01-19 08:12 UTC
```

### 測試結果 (Version 5)

**Conversation ID**: `214536e3-2eab-4de0-9aaf-a29acea78028`

✅ **成功的部分**:
- 音檔下載: 成功 (16.7MB, 502ms)
- Whisper 轉錄: 成功 (9,237 字元)
- 資料庫更新: 成功 (duration = 1945)
- DAG Executor 並行執行: 成功
- **6 out of 7 agents 成功執行**:
  - Context Agent: 15.1秒 ✅
  - Buyer Agent: 30.5秒 ✅
  - Quality Loop Agent: 33.4秒 ✅
  - Seller Agent: **失敗** ❌ (JSON 解析錯誤)
  - CRM Agent: 16.9秒 ✅
  - Summary Agent: 31.4秒 ✅
  - Coach Agent: 30.2秒 ✅
- MEDDIC 分析已儲存到資料庫: 成功 ✅
- Conversation 狀態更新為 completed: 成功 ✅
- 總執行時間: 98.6 秒
- 並行化比率: 1.97x

⚠️ **仍存在的問題**:
- Seller Agent 返回完整的 markdown 表格而不是 JSON
- Slack 通知失敗 (Version 6 已修復)

---

**最後更新**: 2026-01-19 16:10 UTC+8 (新增最終修復和部署記錄)
