# Firestore → Neon 資料遷移報告

**日期**: 2026-01-28
**狀態**: 待執行

---

## 遷移概要

| 項目 | 數量 |
|------|------|
| Firestore 總案件 | 305 筆 |
| 過濾測試資料 | -12 筆 |
| 過濾排除客戶 | -3 筆 |
| 移除重複案件 | -56 筆 |
| **最終遷移** | **234 筆** |

---

## 遷移規則

### 1. 資料範圍
- **遷移**: 客戶資料、音檔路徑、文字稿 (transcript)
- **不遷移**: MEDDIC 分析結果（由 V3 重新分析）

### 2. 案件編號處理
- **V2 caseId**: `202511-IC001`
- **V3 caseNumber**: `M202511-IC001`（加上 M 前綴）
- **legacyCaseId**: 保留原始 V2 編號供追溯

### 3. 客戶編號處理
- **直接搬遷**，不加前綴
- V2/V3 客戶編號不重複

### 4. 每客戶保留最新案件
- 同一客戶有多筆案件時，只保留 `createdAt` 最新的一筆

---

## 過濾規則

### 測試資料過濾 (customerName)
關鍵字: 測試、test、demo、sample、testing 等

### 排除客戶編號
```
102511-111888
123456-789012
201500-000001
201700-000001
202512-122807
202512-000001
202512-111111
202512-111222
```

---

## 業務歸屬情況

### 已在 V3 註冊的業務
| 業務 | 案件數 | 歸屬 |
|------|--------|------|
| Stephen 高克瑋 | 40 筆 | ✅ 正確歸屬 |
| Belle 陳可諠 | 35 筆 | ✅ 正確歸屬 |
| **小計** | **75 筆** | |

### 未在 V3 註冊的業務
| 業務 | Email | 案件數 | 歸屬 |
|------|-------|--------|------|
| Solo 鍾志杰 | solo.chung@ichef.com.tw | 38 筆 | → service-account |
| Kim 梁明凱 | kim.liang@ichef.com.tw | 32 筆 | → service-account |
| Eileen 李艾凌 | eileen.lee@ichef.com.tw | 27 筆 | → service-account |
| Wade 林子翔 | wade.lin@ichef.com.tw | 23 筆 | → service-account |
| Ariel 劉貞妘 | ariel.liu@ichef.com.tw | 22 筆 | → service-account |
| Anna 楊雅雯 | anna.yang@ichef.com.tw | 21 筆 | → service-account |
| Kevinchen 陳晉廷 | kevin.chen@ichef.com.tw | 19 筆 | → service-account |
| Joy 巫喬婷 | joy.wu@ichef.com.tw | 19 筆 | → service-account |
| Eddie 詹承峰 | eddie.chan@ichef.com.tw | 12 筆 | → service-account |
| Mai 張苡芃 | mai.chang@ichef.com.tw | 3 筆 | → service-account |
| **小計** | | **216 筆** | |

### 歸屬統計
- **正確歸屬率**: 25.8% (75/291)
- **待歸屬**: 74.2% (216/291)

---

## 未註冊業務處理方式

### 遷移時處理
1. 案件的 `opportunity.userId` 設為 `service-account`
2. `conversation` 保留原始業務資訊：
   - `slackUserId`: 原始 Slack ID
   - `slackUsername`: 業務姓名
   - `slackUserEmail`: 業務 Email

### 業務註冊後
可執行歸屬腳本，將 `service-account` 的案件重新歸屬給正確業務：
```sql
-- 範例：將 Solo 的案件歸屬回去
UPDATE opportunities o
SET user_id = (SELECT user_id FROM user_profiles WHERE slack_user_id = 'U08xxxxxx')
FROM conversations c
WHERE c.opportunity_id = o.id
  AND c.slack_user_id = 'U08xxxxxx'  -- Solo 的 Slack ID
  AND o.user_id = 'service-account';
```

---

## 遷移指令

### Dry Run（測試）
```bash
DRY_RUN=true bun run scripts/migration/migrate-v3-cases.ts
```

### 正式遷移
```bash
DRY_RUN=false bun run scripts/migration/migrate-v3-cases.ts
```

---

## 預期結果

| 表格 | 新增數量 |
|------|----------|
| opportunities | 234 筆 |
| conversations | 234 筆 |
| meddic_analyses | 0 筆（跳過） |

---

## 後續事項

1. [ ] 邀請未註冊業務加入 V3 系統
2. [ ] 執行業務歸屬腳本
3. [ ] 觸發 MEDDIC 重新分析

---

## 相關檔案

- 遷移腳本: `scripts/migration/migrate-v3-cases.ts`
- Mapper: `scripts/migration/mappers/v3-cases-mapper.ts`
- 設定: `scripts/migration/config.ts`
- 用戶映射: `scripts/migration/user-mapping.ts`
