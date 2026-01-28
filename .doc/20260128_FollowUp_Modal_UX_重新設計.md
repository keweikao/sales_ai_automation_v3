# Follow-up Modal UX 重新設計

**日期**: 2026-01-28
**相關檔案**:
- `apps/slack-bot/src/blocks/follow-up-modal.ts`
- `apps/slack-bot/src/index.ts`
- `apps/slack-bot/src/utils/slack-client.ts`

---

## 問題背景

原本的「後續處理」Modal 設計讓使用者困惑：
1. 所有欄位都是選填（`optional: true`），使用者可以不填任何東西就送出
2. Follow-up 設定和拒絕設定混在同一個頁面，UI 複雜
3. Slack Modal 不支援動態隱藏/顯示欄位，導致使用者看到不相關的欄位

## 解決方案

採用**分步驟表單**設計：

### 流程

```
音檔資訊表單 → 後續處理選擇 → Follow-up 表單 或 結案表單
     │              │                  │
     │              │                  ├─ 返回選擇
     │              │                  └─ 取消（關閉全部）
     │              │
     │              ├─ 📅 建立 Follow-up → Follow-up 表單
     │              └─ 👋 客戶已拒絕 → 結案表單
     │
     └─ 音檔處理（只執行一次）
```

### 第一步：選擇處理方式 (`buildFollowUpChoiceModal`)

顯示兩個按鈕讓使用者選擇：
- 「📅 建立 Follow-up」(primary style)
- 「👋 客戶已拒絕」(danger style)

**重點**: 這個頁面沒有 submit 按鈕，只有 close（取消）

### 第二步 A：Follow-up 表單 (`buildFollowUpModal`)

欄位：
- 幾天後提醒（必填，預設 3 天）
- Follow 事項（必填）
- 詳細描述（選填）

按鈕：
- 「確認建立」(submit)
- 「← 返回選擇」(action button，回到第一步)
- 「取消」(close，關閉整個流程)

### 第二步 B：結案表單 (`buildCloseCaseModal`)

欄位：
- 拒絕原因（必填）
- 競品資訊（選填）

按鈕：
- 「確認結案」(submit)
- 「← 返回選擇」(action button，回到第一步)
- 「取消」(close，關閉整個流程)

---

## 技術實作

### 新增函數

```typescript
// follow-up-modal.ts
export function buildFollowUpChoiceModal(data: FollowUpModalData): object
```

### 新增 SlackClient 方法

```typescript
// slack-client.ts
async updateView(viewId: string, view: object): Promise<{ ok: boolean; error?: string }>
```

用於在同一個 Modal 中更新內容（而非 push 新的 Modal）

### 新增 Action Handlers

在 `index.ts` 的 `block_actions` 處理中新增：

| Action ID | 說明 |
|-----------|------|
| `choose_follow_up` | 點擊「建立 Follow-up」→ 更新為 Follow-up 表單 |
| `choose_close_case` | 點擊「客戶已拒絕」→ 更新為結案表單 |
| `back_to_choice` | 點擊「返回選擇」→ 更新回選擇頁面 |

### View 更新流程

使用 `views.update` API 而非 `views.push`，這樣：
1. Modal 不會堆疊（保持單一層級）
2. 使用者可以在同一個 Modal 中切換頁面
3. 「返回」功能可以正常運作

---

## 重要注意事項

### 音檔處理時機

音檔處理（`processAudioWithMetadata`）在 `audio_upload_form` 提交時就已經觸發，**不會**因為後續的 Follow-up 選擇或返回而重複執行。

```typescript
// audio_upload_form 提交時
c.executionCtx.waitUntil(
  processAudioWithMetadata(pendingFile, legacyMetadata, env)
);

// 然後 push Follow-up 選擇 Modal
return c.json({
  response_action: "push",
  view: followUpChoiceModal,
});
```

### Modal Callback IDs

| Callback ID | 用途 |
|-------------|------|
| `follow_up_choice` | 選擇頁面（無 submit） |
| `follow_up_form` | Follow-up 表單 |
| `close_case_form` | 結案表單 |

---

## 移除的功能

- `close_case_button` action handler（原本用於從舊版 Modal 開啟結案表單）
- 舊版單一頁面的 radio button 設計
- `validateFollowUpForm` 函數（現在改用 Slack 原生的必填驗證）
