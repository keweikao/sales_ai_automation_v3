# GitHub Branch Protection Rules 設定指南

> 建立日期：2026-01-28
> 適用於：Sales AI Automation V3 專案

---

## 目錄

1. [為什麼需要 Branch Protection](#為什麼需要-branch-protection)
2. [建議的設定](#建議的設定)
3. [設定步驟](#設定步驟)
4. [CI Status Checks 說明](#ci-status-checks-說明)
5. [例外情況處理](#例外情況處理)

---

## 為什麼需要 Branch Protection

### 1. 防止直接 Push 到 Main

- **問題**：開發者可能不小心將未經測試的程式碼直接 push 到 main branch
- **後果**：可能導致 production 環境出現 bug、服務中斷
- **解決方案**：啟用 branch protection 後，所有變更必須透過 Pull Request 進行

### 2. 強制 PR 流程

- **程式碼審查**：所有程式碼必須經過至少一位團隊成員審查
- **知識分享**：透過 PR review，團隊成員可以了解其他人的程式碼
- **品質把關**：避免低品質程式碼進入主分支
- **歷史追蹤**：每個變更都有完整的討論記錄

### 3. 確保 CI 通過才能合併

- **自動化測試**：lint、type check、unit tests 必須全部通過
- **防止回歸**：新程式碼不會破壞現有功能
- **統一標準**：所有程式碼都必須符合專案規範

---

## 建議的設定

針對 `main` branch，我們建議以下設定：

| 設定項目 | 建議值 | 說明 |
|---------|-------|------|
| Require a pull request before merging | ✅ 啟用 | 強制使用 PR 流程 |
| Require approvals | 1 | 至少需要 1 位審查者批准 |
| Dismiss stale pull request approvals | ✅ 啟用 | 有新 commit 時，舊的 approval 會失效 |
| Require status checks to pass | ✅ 啟用 | CI 必須通過 |
| Required checks: `lint-and-typecheck` | ✅ 必要 | 確保程式碼格式與型別正確 |
| Required checks: `unit-tests` | ✅ 必要（啟用後） | 確保測試通過 |
| Require branches to be up to date | ✅ 啟用 | 合併前必須更新至最新 main |
| Do not allow bypassing | ✅ 啟用 | 管理員也必須遵守規則 |

---

## 設定步驟

### 步驟 1：進入 Repository Settings

1. 前往 GitHub repository 頁面
2. 點擊上方的 **Settings** 標籤
3. 在左側選單中找到 **Branches**（位於 Code and automation 區段下）

```
Repository 首頁
    └── Settings（齒輪圖示）
            └── Branches
```

### 步驟 2：新增 Branch Protection Rule

1. 在 Branch protection rules 區段，點擊 **Add rule** 或 **Add branch protection rule** 按鈕
2. 在 **Branch name pattern** 欄位輸入：`main`

```
Branch name pattern: main
```

### 步驟 3：設定 Pull Request 規則

勾選以下選項：

#### Protect matching branches

```
☑️ Require a pull request before merging
    ├── ☑️ Require approvals
    │       └── Required number of approvals: 1
    ├── ☑️ Dismiss stale pull request approvals when new commits are pushed
    └── ☐ Require review from Code Owners（選用，如有設定 CODEOWNERS）
```

**說明**：
- **Require approvals**：設定為 1，表示至少需要一位團隊成員批准
- **Dismiss stale approvals**：當 PR 有新的 commit 時，先前的批准會失效，需要重新審查

### 步驟 4：設定 Status Checks

勾選以下選項：

```
☑️ Require status checks to pass before merging
    ├── ☑️ Require branches to be up to date before merging
    └── Status checks that are required:
            ├── lint-and-typecheck
            └── unit-tests（當測試 CI 啟用後加入）
```

**說明**：
- **Require branches to be up to date**：PR 必須包含最新的 main branch 變更，避免合併衝突
- 在搜尋框輸入 check 名稱，從下拉選單選擇要求的 checks

### 步驟 5：設定其他保護

```
☑️ Do not allow bypassing the above settings
```

**說明**：
- 啟用此選項後，即使是 repository 管理員也必須遵守這些規則
- 這確保所有人都遵循相同的流程

### 步驟 6：儲存設定

1. 捲動到頁面底部
2. 點擊 **Create** 或 **Save changes** 按鈕

---

## CI Status Checks 說明

### 必要的 Checks

| Check 名稱 | 用途 | 失敗原因 |
|-----------|------|---------|
| `lint-and-typecheck` | 程式碼格式與型別檢查 | ESLint 錯誤、TypeScript 型別錯誤 |
| `unit-tests` | 單元測試（啟用後） | 測試案例失敗 |

### 如何處理 Check 失敗

#### Lint 或 TypeCheck 失敗

```bash
# 1. 在本地執行檢查，找出問題
bun x ultracite check

# 2. 自動修復可修復的問題
bun x ultracite fix

# 3. 手動修復剩餘問題

# 4. 提交修正後的程式碼
git add .
git commit -m "fix: 修正 lint/type 錯誤"
git push
```

#### 單元測試失敗

```bash
# 1. 在本地執行測試
bun test

# 2. 查看失敗的測試，修正程式碼或測試

# 3. 確認本地測試通過後再推送
git add .
git commit -m "fix: 修正測試失敗"
git push
```

### Check 仍在執行中

- 如果 check 顯示為 pending（黃色圓圈），請等待 CI 完成
- 通常需要 1-5 分鐘
- 如果超過 10 分鐘仍未完成，可能需要檢查 GitHub Actions 是否有問題

---

## 例外情況處理

### 緊急修復（Hotfix）

當 production 出現嚴重問題需要立即修復時：

#### 標準流程（建議）

即使是緊急情況，仍建議走 PR 流程，但可以加速：

1. 建立 hotfix branch：`hotfix/issue-description`
2. 快速修復問題
3. 建立 PR，在標題加上 `[HOTFIX]` 標記
4. 請團隊成員優先審查
5. 合併後立即部署

```bash
# 建立 hotfix 分支
git checkout -b hotfix/critical-api-error

# 修復問題
# ...編輯程式碼...

# 推送並建立 PR
git push -u origin hotfix/critical-api-error
gh pr create --title "[HOTFIX] 修復 API 500 錯誤" --body "緊急修復，請優先審查"
```

#### 緊急 Bypass（僅在極端情況）

**⚠️ 警告**：此方法應該極少使用，僅限於：
- 服務完全中斷
- 資安事件
- 無法等待審查的極端情況

若必須 bypass：

1. 暫時在 Settings > Branches 中停用 "Do not allow bypassing"
2. 以管理員身份合併 PR（無需等待 approval）
3. **立即重新啟用** bypass 保護
4. 事後補充文件說明為何需要 bypass

### 誰有權限 Bypass

| 角色 | 權限 |
|-----|------|
| Repository Admin | 可以暫時修改 branch protection rules |
| Organization Owner | 可以暫時修改 branch protection rules |
| 一般開發者 | 無法 bypass，必須遵守所有規則 |

### Bypass 記錄

每次 bypass 都應該記錄：

1. **時間**：何時發生
2. **原因**：為什麼需要 bypass
3. **執行者**：誰執行了 bypass
4. **影響**：合併了什麼變更
5. **後續**：是否需要補充測試或審查

---

## 附錄：常見問題

### Q: 為什麼我的 PR 無法合併？

可能原因：
1. 尚未獲得足夠的 approval（需要 1 個）
2. Status checks 尚未通過或仍在執行
3. Branch 不是最新的（需要 rebase 或 merge main）
4. 有合併衝突需要解決

### Q: 如何重新觸發 CI？

1. 推送一個新的 commit（即使是空 commit）
2. 在 PR 頁面點擊 "Re-run jobs"
3. 關閉再重新開啟 PR

```bash
# 空 commit 重新觸發 CI
git commit --allow-empty -m "chore: 重新觸發 CI"
git push
```

### Q: Reviewer 離開了，我該怎麼辦？

1. 在 PR 中移除原 reviewer
2. 指派新的 reviewer
3. 若無其他可用 reviewer，聯繫 repository admin

---

## 參考資源

- [GitHub Docs: Managing a branch protection rule](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
- [GitHub Docs: About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
