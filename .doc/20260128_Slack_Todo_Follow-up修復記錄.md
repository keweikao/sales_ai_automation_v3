# Slack Bot Follow-up Todo 修復記錄

**日期**：2026-01-28
**問題**：Slack Bot 音檔上傳後無法建立 Follow-up Todo
**狀態**：已修復

---

## 問題描述

用戶回報：音檔上傳後點擊「建立 Follow-up」按鈕沒有反應，無法跳出填寫 Todo 的視窗。

### 預期流程

```
音檔上傳 → 客戶資訊表單 → 選擇 Modal（兩個按鈕）→ Follow-up 表單 → Todo 建立成功
```

### 實際問題

1. 點擊「建立 Follow-up」按鈕後，Modal 沒有切換到表單頁面
2. 即使表單出現，提交後 API 返回 500 錯誤
3. `customerNumber` 未正確傳遞到最終的 Todo 建立

---

## 錯誤分析與修復

### 錯誤 1：customerNumber 未傳遞到 Follow-up Modal

**位置**：`apps/slack-bot/src/index.ts` Lines 611-616

**原因**：在處理 `choose_follow_up` 按鈕時，呼叫 `buildFollowUpModal` 缺少 `customerNumber` 參數

**修復前**：
```typescript
const followUpModal = buildFollowUpModal({
  conversationId: modalData.conversationId,
  caseNumber: modalData.caseNumber,
  opportunityId: modalData.opportunityId,
  opportunityName: modalData.opportunityName,
  // 缺少 customerNumber！
});
```

**修復後**：
```typescript
const followUpModal = buildFollowUpModal({
  conversationId: modalData.conversationId,
  caseNumber: modalData.caseNumber,
  opportunityId: modalData.opportunityId,
  opportunityName: modalData.opportunityName,
  customerNumber: modalData.customerNumber,  // 新增
});
```

---

### 錯誤 2：API 認證失敗 (401 Unauthorized)

**日誌**：
```
[ApiClient] Response status: 401
```

**原因**：Slack Bot 的 `API_TOKEN` 環境變數與 Server 端的 token 不一致

**修復方式**：
```bash
cd apps/slack-bot
wrangler secret put API_TOKEN
# 輸入正確的 API Token
```

---

### 錯誤 3：Modal 按鈕點擊無反應（最關鍵的問題）

**用戶回報**：「送出音檔後，案建立 follow up 沒反應」、「沒跳出填寫視窗」

**根本原因**：`choose_follow_up` 按鈕處理邏輯放在 `waitUntil` 內，導致異步執行問題

**錯誤的處理流程**：
```typescript
// 在 waitUntil 內處理（錯誤）
ctx.executionCtx.waitUntil(
  (async () => {
    if (actionId === "choose_follow_up") {
      // 這裡的回應無法正確送達 Slack
    }
  })()
);
return c.json({ ok: true });  // 立即返回，waitUntil 內的邏輯還沒執行
```

**第一次嘗試修復（失敗）**：使用 `response_action: "update"`
```typescript
return c.json({
  response_action: "update",
  view: followUpModal,
});
```
這只適用於 `view_submission` 事件，不適用於 `block_actions`（按鈕點擊）事件。

**正確修復**：將 Modal 按鈕處理移出 `waitUntil`，同步呼叫 `views.update` API

```typescript
// Modal 按鈕需要同步處理，不能放在 waitUntil 內
if (actionId === "choose_follow_up") {
  try {
    const modalData = JSON.parse(value);
    console.log("[choose_follow_up] Building follow-up modal with data:", modalData);

    const followUpModal = buildFollowUpModal({
      conversationId: modalData.conversationId,
      caseNumber: modalData.caseNumber,
      opportunityId: modalData.opportunityId,
      opportunityName: modalData.opportunityName,
      customerNumber: modalData.customerNumber,
    });

    // 使用 Slack API 直接更新 Modal
    const slackClient = new SlackClient(env.SLACK_BOT_TOKEN);
    console.log("[choose_follow_up] Calling views.update API");
    const result = await slackClient.updateView(payload.view.id, followUpModal);
    console.log("[choose_follow_up] updateView result ok:", result.ok);
    if (!result.ok) {
      console.error("[choose_follow_up] updateView error:", result.error);
    }
  } catch (error) {
    console.error("[choose_follow_up] Error:", error);
  }
  return c.json({ ok: true });
}

// 同樣處理 choose_close_case
if (actionId === "choose_close_case") {
  try {
    const modalData = JSON.parse(value);
    console.log("[choose_close_case] Building close case modal with data:", modalData);

    const closeCaseModal = buildCloseCaseModal({
      conversationId: modalData.conversationId,
      caseNumber: modalData.caseNumber,
      opportunityId: modalData.opportunityId,
      opportunityName: modalData.opportunityName,
      customerNumber: modalData.customerNumber,
    });

    const slackClient = new SlackClient(env.SLACK_BOT_TOKEN);
    console.log("[choose_close_case] Calling views.update API");
    const result = await slackClient.updateView(payload.view.id, closeCaseModal);
    console.log("[choose_close_case] updateView result ok:", result.ok);
    if (!result.ok) {
      console.error("[choose_close_case] updateView error:", result.error);
    }
  } catch (error) {
    console.error("[choose_close_case] Error:", error);
  }
  return c.json({ ok: true });
}
```

**技術說明**：
- `view_submission` 事件：可以用 `response_action: "update"` 在回應中更新 Modal
- `block_actions` 事件：必須呼叫 `views.update` API 來更新 Modal
- `waitUntil` 是非阻塞的，適合用於不需要等待結果的背景任務

---

### 錯誤 4：API 500 Internal Server Error（外鍵約束）

**日誌**：
```
[ApiClient] Response status: 500
```

**原因**：`conversationId: "pending"` 違反資料庫外鍵約束

**資料庫 Schema**（`packages/db/src/schema/sales-todo.ts`）：
```typescript
conversationId: text("conversation_id").references(() => conversations.id, {
  onDelete: "set null",
}),
```

`"pending"` 不是有效的 conversation ID，所以插入時違反外鍵約束。

**修復**：檢查 `conversationId` 是否為 `"pending"`，若是則不傳遞

```typescript
const result = await apiClient.createTodo({
  title,
  description,
  dueDate: dueDate.toISOString(),
  customerNumber: modalData.customerNumber,  // 主要連接欄位
  opportunityId: modalData.opportunityId,    // 保留向後相容
  // 只有當 conversationId 不是 "pending" 時才傳遞
  conversationId: modalData.conversationId !== "pending"
    ? modalData.conversationId
    : undefined,
  source: "slack",
});
```

---

## 修改檔案清單

| 檔案 | 修改內容 |
|------|----------|
| `apps/slack-bot/src/index.ts` | 1. 將 Modal 按鈕處理移出 waitUntil |
|  | 2. 新增 customerNumber 傳遞 |
|  | 3. 修復 conversationId 外鍵問題 |
| `apps/slack-bot/src/blocks/follow-up-modal.ts` | 確保 customerNumber 在所有 Modal 中傳遞 |
| `apps/slack-bot/src/utils/slack-client.ts` | 新增 updateView 方法 |

---

## 關鍵程式碼變更

### slack-client.ts 新增方法

```typescript
async updateView(
  viewId: string,
  view: object
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch("https://slack.com/api/views.update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    },
    body: JSON.stringify({
      view_id: viewId,
      view,
    }),
  });
  return response.json();
}
```

---

## 測試驗證

### 測試步驟

1. 在 Slack 上傳音檔
2. 填寫客戶資訊表單（客戶編號：202612-000043）
3. 提交表單後確認彈出選擇 Modal
4. 點擊「建立 Follow-up」按鈕
5. 確認 Modal 切換到 Follow-up 表單
6. 填寫 Todo 資訊並提交
7. 檢查資料庫確認 Todo 建立成功

### 驗證結果

```
=== 最近 5 筆 Todos ===

Title: test
Customer Number: 202612-000043
Status: pending
Source: slack
Created: Wed Jan 28 2026 07:03:30
---
```

Todo 成功建立，`customer_number` 欄位正確儲存。

---

## 學到的經驗

### 1. Slack Modal 事件處理差異

| 事件類型 | 更新 Modal 方式 |
|----------|-----------------|
| `view_submission` | `response_action: "update"` 或 `views.update` API |
| `block_actions` | 只能用 `views.update` API |

### 2. Cloudflare Workers waitUntil

- `waitUntil` 適合用於不需要等待結果的背景任務（如發送通知、記錄日誌）
- 需要即時回應的操作（如 Modal 更新）不應該放在 `waitUntil` 內

### 3. 外鍵約束處理

- 使用 placeholder 值（如 `"pending"`）時，需確保不會違反外鍵約束
- 建議：placeholder 值應該是 `null` 或 `undefined`，而非假的字串值

---

## 相關文件

- [計劃文件](../.claude/plans/quizzical-roaming-bumblebee.md) - 原始設計計劃
- [Slack API 文件](https://api.slack.com/methods/views.update) - views.update API 說明
