# 多產品線開發指南 - 使用說明

> **版本**: v1.0
> **最後更新**: 2026-01-19
> **狀態**: ✅ 所有指南已完成

---

## 📂 目錄結構

```
.doc/multi-product-line-guides/
├── README.md                    # 本檔案 (使用說明)
├── 00_總覽與索引.md              # 架構總覽與快速開始
├── 01_Agent_A_基礎設施.md        # Config + DB (8-10h)
├── 02_Agent_B_SlackBot.md        # Slack Bot (8-10h)
├── 03_Agent_C_MEDDIC提示詞.md    # Prompts (10-12h)
├── 04_Agent_D_API與Queue.md      # API + Queue (8-10h)
├── 05_Agent_E_Dashboard.md       # Dashboard + 話術 (6-8h)
└── 06_整合測試與部署.md          # 整合測試 (8-10h)
```

---

## 🎯 如何使用這些指南

### 第一次閱讀

1. **所有人必讀**: [00_總覽與索引.md](00_總覽與索引.md)
   - 了解專案架構
   - 了解並行開發流程
   - 了解依賴關係

2. **選擇你的 Agent**: 根據分工閱讀對應的指南
   - Agent A → 基礎設施開發者
   - Agent B → Slack Bot 開發者
   - Agent C → MEDDIC 提示詞開發者
   - Agent D → API/Queue 開發者
   - Agent E → Dashboard 開發者

3. **測試/部署人員**: [06_整合測試與部署.md](06_整合測試與部署.md)

---

## 📋 每個指南包含什麼

### 標準章節結構

每個 Agent 指南都包含以下章節:

1. **依賴關係與環境準備**
   - 需要哪些前置 Agent 完成
   - 如何使用 Mock 獨立開發
   - 環境檢查清單

2. **開發任務拆解**
   - 階段性任務 (每個 2-4 小時)
   - 完整程式碼範例
   - 檔案路徑與命名

3. **驗收檢查點**
   - 功能驗收測試
   - 自動化測試腳本
   - 通過標準

4. **向後相容性驗證**
   - 確保不破壞現有功能
   - 測試腳本與步驟

5. **故障排除**
   - 常見問題與解決方法
   - 除錯技巧

---

## 🚀 快速開始範例

### 範例 1: 我是 Agent A 開發者

```bash
# 1. 閱讀總覽
cat .doc/multi-product-line-guides/00_總覽與索引.md

# 2. 閱讀 Agent A 指南
cat .doc/multi-product-line-guides/01_Agent_A_基礎設施.md

# 3. 按照指南開始開發
# 階段 1: 建立 Config 模組...
# 階段 2: 建立 Migration...
# ...

# 4. 完成後執行驗收檢查
# 檢查點 1-1, 1-2, 1-3...

# 5. 通知其他 Agent
echo "Agent A 已完成,ProductLineConfig 可用!"
```

---

### 範例 2: 我是 Agent C 開發者 (Agent A 尚未完成)

```bash
# 1. 閱讀總覽與 Agent C 指南
cat .doc/multi-product-line-guides/00_總覽與索引.md
cat .doc/multi-product-line-guides/03_Agent_C_MEDDIC提示詞.md

# 2. 使用 Mock 資料開發
# (指南中有提供 Mock 範例)

# 3. Agent A 完成後替換 Mock
# import { getProductConfig } from '@Sales_ai_automation_v3/config';

# 4. 執行驗收檢查
```

---

## 📊 進度追蹤

### 開發時程參考

| 週次 | Agent A | Agent B | Agent C | Agent D | Agent E | 測試 |
|------|---------|---------|---------|---------|---------|------|
| W1   | 🔴 開發 | 🔴 開發 | 🟡 開發 | ⏸️ 等待 | ⏸️ 等待 | ⏸️ 等待 |
| W2   | ✅ 完成 | ✅ 完成 | 🟡 開發 | 🟡 開發 | ⏸️ 等待 | ⏸️ 等待 |
| W3   | -      | -      | ✅ 完成 | 🟡 開發 | 🟢 開發 | ⏸️ 等待 |
| W4   | -      | -      | -      | ✅ 完成 | ✅ 完成 | 🟢 測試 |

---

## ✅ 驗收標準總覽

### Agent A

- [ ] Config 模組編譯成功
- [ ] Migration 執行成功
- [ ] TypeScript 類型正確
- [ ] 向後相容性測試通過
- [ ] 性能測試通過 (< 100ms)

### Agent B

- [ ] Channel 解析正確
- [ ] 動態表單生成正確
- [ ] Slack 整合測試通過
- [ ] 向後相容性測試通過

### Agent C

- [ ] 目錄結構正確
- [ ] Prompts 編譯成功
- [ ] PromptLoader 測試通過
- [ ] Orchestrator 整合成功
- [ ] iCHEF 分析品質不下降

### Agent D

- [ ] API Schema 更新正確
- [ ] Queue Worker 整合成功
- [ ] 端到端測試通過
- [ ] 向後相容性測試通過
- [ ] 性能測試通過 (< 10% 增幅)

### Agent E

- [ ] UI 元件正常運作
- [ ] 話術系統過濾正確
- [ ] 美業話術資料完整 (20 筆)
- [ ] Dashboard 性能達標

### 整合測試

- [ ] 美業端到端測試通過
- [ ] iCHEF 端到端測試通過
- [ ] 回歸測試通過
- [ ] 性能測試通過
- [ ] 部署成功

---

## 🔧 工具與腳本

### 檢查 Agent 完成狀態

```bash
# 執行檢查腳本 (在 06_整合測試與部署.md 中)
bash scripts/check-agents-completion.sh
```

### 執行端到端測試

```bash
# iCHEF 測試
bun run scripts/e2e-test-ichef.ts

# 美業測試
bun run scripts/e2e-test-beauty.ts
```

### 執行性能測試

```bash
bun run scripts/performance-test.ts
```

---

## 📚 相關文件

### 專案文件

- [主要 README](../../README.md)
- [Setup 指南](../../README_SETUP.md)

### 多產品線相關

- [影響評估報告](../20260119_多產品線開發影響評估報告.md)
- [修正版規劃](../20260119_修正版_多產品線支援實作計畫.md)
- [執行指南](../20260119_多產品線開發執行指南_含驗收條件.md)

---

## 💡 最佳實踐

### 開發時

1. **先閱讀,再動手**: 完整閱讀你的 Agent 指南再開始開發
2. **使用 Mock**: 如果依賴的 Agent 尚未完成,使用 Mock 資料
3. **頻繁驗收**: 完成每個階段後立即執行驗收檢查
4. **保持溝通**: 完成後通知其他 Agent

### 測試時

1. **向後相容第一**: 優先測試現有功能不受影響
2. **端到端驗證**: 確保整個流程可正常運作
3. **性能監控**: 確保性能增幅在可接受範圍

### 部署時

1. **分階段部署**: 按照 06 文件的階段計畫執行
2. **持續監控**: 部署後 24 小時密切監控
3. **準備回滾**: 隨時準備回滾到前一版本

---

## 🆘 需要協助?

### 常見問題

1. **Q: Agent A 還沒完成,我可以開始嗎?**
   - A: 可以!使用指南中的 Mock 資料先開發

2. **Q: 測試失敗怎麼辦?**
   - A: 參考對應指南的「故障排除」章節

3. **Q: 如何確保向後相容?**
   - A: 執行每個指南中的「向後相容性驗證」測試

4. **Q: 性能測試不通過怎麼辦?**
   - A: 檢查索引是否正確建立,參考 Agent A 指南

### 取得協助

- 技術問題: 參考對應 Agent 指南的「故障排除」章節
- 架構問題: 參考 [00_總覽與索引.md](00_總覽與索引.md)
- 部署問題: 參考 [06_整合測試與部署.md](06_整合測試與部署.md)

---

**準備好了嗎?** 選擇你的 Agent 指南,開始開發! 🚀
