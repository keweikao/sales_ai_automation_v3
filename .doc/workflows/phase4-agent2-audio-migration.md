# Workflow Instruction: Phase 4 Agent 2 - 音檔遷移執行

> **任務類型**: 音檔遷移執行
> **預估時間**: 1.5 工作日
> **依賴條件**: Phase 3 遷移腳本已完成

---

## 任務目標

執行 Google Cloud Storage (GCS) → Cloudflare R2 的音檔批次遷移，並更新 PostgreSQL 中的 `audio_url` 欄位。

---

## 🔑 需要人工完成的前置作業

> **重要**: 以下標記 `👤 人工` 的項目需要由你手動完成，無法由 AI Agent 自動執行。

### 1. Firebase / GCS 憑證取得 `👤 人工`

**所需憑證**: Firebase Admin SDK Service Account JSON

**取得方式**:
1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 選擇你的專案 → 專案設定（齒輪圖示）
3. 服務帳戶 → 產生新的私密金鑰
4. 下載 JSON 檔案，儲存至專案根目錄（**勿提交至 Git**）

**設定環境變數**:
```bash
# .env.migration
GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

**驗證權限**:
- 確認 Service Account 有 `Storage Object Viewer` 權限
- 如需下載，需要 `Storage Object Admin` 權限

---

### 2. Cloudflare R2 設定 `👤 人工`

**所需項目**:
- Cloudflare Account ID
- R2 API Token（Access Key + Secret Key）
- R2 Bucket 名稱

**取得方式**:

**Step 1: 取得 Account ID**
1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 右側欄位可看到 Account ID，或
3. 進入任一網域 → Overview → 右側 API 區塊

**Step 2: 建立 R2 Bucket**
1. Cloudflare Dashboard → R2 Object Storage
2. Create bucket → 名稱: `sales-ai-audio`
3. Location: 選擇 `Automatic` 或最近的區域

**Step 3: 建立 API Token**
1. R2 → Manage R2 API Tokens → Create API Token
2. 權限設定:
   - Permission: `Object Read & Write`
   - Specify bucket: `sales-ai-audio`
3. 建立後會顯示:
   - Access Key ID → `CLOUDFLARE_R2_ACCESS_KEY`
   - Secret Access Key → `CLOUDFLARE_R2_SECRET_KEY`（**只顯示一次，請立即複製**）

**Step 4: 設定 Public Access（選擇一種）**

| 方式 | 難度 | 安全性 | 說明 |
|------|------|--------|------|
| R2.dev subdomain | 簡單 | 低 | 啟用後自動產生 `pub-xxx.r2.dev` URL |
| Custom Domain | 中等 | 中 | 設定自己的子網域如 `audio.yourdomain.com` |
| Signed URLs | 複雜 | 高 | 每次存取需產生簽名 URL |

**設定環境變數**:
```bash
# .env.migration
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_R2_ACCESS_KEY=your-access-key
CLOUDFLARE_R2_SECRET_KEY=your-secret-key
CLOUDFLARE_R2_BUCKET=sales-ai-audio
CLOUDFLARE_R2_PUBLIC_URL=https://pub-xxx.r2.dev  # 或 custom domain
```

---

### 3. 環境變數檔案設定 `👤 人工`

**檔案位置**: 專案根目錄 `.env.migration`

建立範例檔案：
```bash
cp .env.migration.example .env.migration
```

**完整的 `.env.migration` 內容**:
```bash
# === GCS / Firebase 設定 ===
GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com

# === Cloudflare R2 設定 ===
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_R2_ACCESS_KEY=your-access-key
CLOUDFLARE_R2_SECRET_KEY=your-secret-key
CLOUDFLARE_R2_BUCKET=sales-ai-audio
CLOUDFLARE_R2_PUBLIC_URL=https://pub-xxx.r2.dev

# === PostgreSQL 設定 ===
DATABASE_URL=postgresql://user:password@host:5432/database

# === 遷移設定 ===
AUDIO_CONCURRENCY=5
DRY_RUN=false
```

---

### 4. 確認 Agent 1 狀態 `👤 人工`

在開始音檔遷移前，需確認 Agent 1（資料遷移）的狀態：

**檢查方式**:
```bash
# 查看 Agent 1 的進度檔案
cat scripts/migration/progress/data-progress.json
```

**可開始條件**:
- Agent 1 已完成 `conversations` 資料遷移（音檔需要對應的 conversation ID）
- 或 Agent 1 正在執行，但已完成至少 50% 的 conversation 遷移

**同步協調**:
- 如果 Agent 1 還在執行，請先遷移已完成的 conversations 對應的音檔
- 使用 `--conversation-ids` 參數指定要遷移的範圍

---

## 前置條件檢查清單

完成上述人工作業後，確認以下項目：

- [ ] `👤` Firebase Admin SDK JSON 已下載並設定路徑
- [ ] `👤` GCS Bucket 存取權限已確認
- [ ] `👤` Cloudflare R2 Bucket 已建立
- [ ] `👤` R2 API Token 已取得並設定
- [ ] `👤` `.env.migration` 檔案已建立
- [ ] `👤` R2 Public Access 或 Custom Domain 已設定
- [ ] `🤖` PostgreSQL 連線正常（`DATABASE_URL`）
- [ ] `🤖` Agent 1 資料遷移已完成或同步進行中

---

## 任務清單

### Task 0: 連線驗證（GCS + R2）

**目標**: 在開始遷移前，確認 GCS 和 R2 都能正常連線

**步驟**:

1. 執行 GCS 連線測試：

```bash
bun run scripts/migration/test-gcs-connection.ts
```

預期輸出：

```
✅ Google Cloud Storage connected
   - Bucket: your-project-id.appspot.com
   - Service Account: firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
   - Read permission: ✓
   - List permission: ✓
   - Sample files found: 450
```

2. 執行 R2 連線測試：

```bash
bun run scripts/migration/test-r2-connection.ts
```

預期輸出：

```
✅ Cloudflare R2 connected
   - Bucket: sales-ai-audio
   - Region: auto
   - Public URL: https://pub-xxx.r2.dev
   - Write permission: ✓
   - Read permission: ✓
```

3. 如果連線失敗，請參考「故障排除」章節

**產出**:

- GCS 連線驗證通過
- R2 連線驗證通過

---

### Task 1: R2 環境準備

**目標**: 設定 Cloudflare R2 存取權限與目錄結構

**步驟**:

1. 確認 R2 環境變數已設定（參考「需要人工完成的前置作業」章節）

2. 設定 R2 公開存取（選擇一種方式）：

**方式 A: 使用 R2 Public Access（簡單）**
```bash
# 在 Cloudflare Dashboard 啟用 R2 bucket 的 public access
# 或使用 wrangler CLI
wrangler r2 bucket update sales-ai-audio --public
```

**方式 B: 使用 Custom Domain（推薦）**
```bash
# 1. 在 Cloudflare DNS 添加 CNAME 記錄
# audio.your-domain.com -> your-bucket.r2.cloudflarestorage.com

# 2. 在 R2 bucket 設定 custom domain
# Cloudflare Dashboard -> R2 -> sales-ai-audio -> Settings -> Custom Domain
```

**方式 C: 使用 Signed URLs（最安全，需要額外程式碼）**
- 音檔 URL 需要透過 API 產生 signed URL
- 適合需要存取控制的場景

4. 建立目錄結構：

R2 會自動建立目錄，但我們規劃的結構是：
```
sales-ai-audio/
└── audio/
    ├── 2024/
    │   ├── 01/
    │   ├── 02/
    │   └── ...
    ├── 2023/
    └── ...
```

**產出**:
- R2 環境變數設定完成
- R2 連線測試通過
- Public access 或 custom domain 設定完成

---

### Task 2: GCS 音檔清單匯出

**目標**: 匯出所有需要遷移的音檔清單

**步驟**:

1. 執行音檔清單匯出：

```bash
bun run scripts/migration/list-gcs-audio.ts
```

2. 輸出範例：

```
📋 Scanning GCS bucket for audio files...

Found 450 audio files in gs://your-bucket/audio/

Summary:
  - Total files: 450
  - Total size: 12.5 GB
  - Oldest file: 2023-01-15
  - Newest file: 2024-01-10
  - Formats: mp3 (420), wav (30)

Exporting to: scripts/migration/data/gcs-audio-manifest.json
✅ Manifest exported successfully
```

3. 檢視清單內容：

```bash
head -50 scripts/migration/data/gcs-audio-manifest.json
```

```json
{
  "exportedAt": "2024-01-15T10:00:00Z",
  "totalFiles": 450,
  "totalSizeBytes": 13421772800,
  "files": [
    {
      "gcsUri": "gs://your-bucket/audio/2024/01/abc123.mp3",
      "conversationId": "abc123",
      "sizeBytes": 15728640,
      "contentType": "audio/mpeg",
      "createdAt": "2024-01-10T14:30:00Z"
    },
    ...
  ]
}
```

4. 驗證對應關係：

```bash
# 確認所有音檔都有對應的 conversation
bun run scripts/migration/verify-audio-mapping.ts
```

輸出：
```
Verifying audio file mapping...

✅ All 450 audio files have matching conversations
   - Matched: 450
   - Orphaned (no conversation): 0
   - Missing (conversation but no audio): 12
```

**產出**:
- `scripts/migration/data/gcs-audio-manifest.json`
- 音檔與 conversation 對應驗證報告

---

### Task 3: 批次遷移執行

**目標**: 將音檔從 GCS 遷移到 R2

**步驟**:

1. 執行音檔遷移：

```bash
# 設定並行數量（建議 5-10）
AUDIO_CONCURRENCY=5 bun run scripts/migration/migrate-audio.ts
```

2. 監控遷移進度：

```
🎵 Starting audio migration...

Configuration:
  - Source: gs://your-bucket
  - Target: sales-ai-audio (R2)
  - Concurrency: 5
  - Total files: 450

Progress: [████████████░░░░░░░░] 60% (270/450)
  ✓ abc123.mp3 (15 MB) → audio/2024/01/abc123.mp3
  ✓ def456.mp3 (22 MB) → audio/2024/01/def456.mp3
  ✓ ghi789.mp3 (18 MB) → audio/2024/01/ghi789.mp3
  ...

Current speed: 50 MB/s
Estimated time remaining: 8 minutes
```

3. 處理遷移中斷：

```bash
# 如果遷移中斷，從斷點繼續
bun run scripts/migration/migrate-audio.ts --resume

# 查看進度
cat scripts/migration/progress/audio-progress.json
```

```json
{
  "lastProcessedIndex": 270,
  "successCount": 268,
  "failedCount": 2,
  "failedFiles": [
    {
      "gcsUri": "gs://your-bucket/audio/2024/01/xyz.mp3",
      "error": "Download timeout",
      "retryCount": 3
    }
  ],
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

4. 重試失敗的檔案：

```bash
# 重試所有失敗的檔案
bun run scripts/migration/migrate-audio.ts --retry-failed

# 或手動處理特定檔案
bun run scripts/migration/migrate-single-audio.ts gs://your-bucket/audio/2024/01/xyz.mp3
```

**產出**:
- 所有音檔遷移到 R2
- 遷移進度檔案 `audio-progress.json`
- 失敗檔案清單（如有）

---

### Task 4: URL 更新

**目標**: 更新 PostgreSQL `conversations.audio_url` 為 R2 URL

**步驟**:

1. 執行 URL 更新：

```bash
bun run scripts/migration/update-audio-urls.ts
```

2. 輸出範例：

```
🔗 Updating audio URLs in PostgreSQL...

Processing 450 conversations...
  ✓ abc123: gs://... → https://audio.your-domain.com/audio/2024/01/abc123.mp3
  ✓ def456: gs://... → https://audio.your-domain.com/audio/2024/01/def456.mp3
  ...

✅ URL Update Complete
   Total: 450
   Updated: 448
   Skipped (no audio): 2
   Failed: 0
```

3. 驗證 URL 更新：

```sql
-- 檢查 URL 格式
SELECT id, audio_url
FROM conversations
WHERE audio_url IS NOT NULL
LIMIT 10;

-- 確認沒有舊的 GCS URL
SELECT COUNT(*)
FROM conversations
WHERE audio_url LIKE 'gs://%';
-- 應該返回 0
```

4. 測試音檔可存取性：

```bash
# 抽樣測試 10 個音檔 URL
bun run scripts/migration/verify-audio-urls.ts --sample 10
```

輸出：
```
🔍 Verifying audio URL accessibility...

Testing 10 random audio URLs...
  ✓ https://audio.your-domain.com/audio/2024/01/abc123.mp3 (200 OK, 15 MB)
  ✓ https://audio.your-domain.com/audio/2024/01/def456.mp3 (200 OK, 22 MB)
  ...

✅ All 10 URLs accessible
   Average response time: 120ms
```

**產出**:
- PostgreSQL `audio_url` 欄位已更新
- URL 存取驗證報告

---

### Task 5: 清理與報告

**目標**: 產生遷移報告並規劃 GCS 清理

**步驟**:

1. 產生音檔遷移報告：

```bash
bun run scripts/migration/generate-audio-report.ts
```

報告內容：

```json
{
  "migrationId": "audio-migration-20240115",
  "startedAt": "2024-01-15T10:00:00Z",
  "completedAt": "2024-01-15T11:30:00Z",
  "duration": 5400,
  "summary": {
    "totalFiles": 450,
    "successfulMigrations": 448,
    "failedMigrations": 2,
    "totalSizeMigrated": "12.3 GB",
    "averageSpeed": "38 MB/s"
  },
  "sourceStats": {
    "bucket": "your-v2-bucket",
    "totalOriginalFiles": 450,
    "retainedForBackup": true
  },
  "targetStats": {
    "bucket": "sales-ai-audio",
    "region": "auto",
    "publicUrl": "https://audio.your-domain.com"
  },
  "failedFiles": [
    {
      "gcsUri": "gs://your-bucket/audio/corrupted.mp3",
      "error": "File corrupted",
      "conversationId": "xyz789"
    }
  ],
  "urlUpdateStats": {
    "totalUpdated": 448,
    "allAccessible": true
  }
}
```

2. 規劃 GCS 清理（**不要立即執行**）：

```markdown
## GCS 清理計畫

**建議保留期間**: 30 天

**清理前確認清單**:
- [ ] V3 系統已穩定運行 2 週以上
- [ ] 所有音檔播放功能正常
- [ ] 無使用者回報音檔問題
- [ ] 已確認沒有其他系統依賴 GCS 音檔

**清理指令（30 天後執行）**:
```bash
# 列出要刪除的檔案（乾跑）
gsutil ls gs://your-v2-bucket/audio/**

# 刪除音檔（請謹慎）
# gsutil -m rm -r gs://your-v2-bucket/audio/
```

**備份建議**:
- 下載完整備份到本地或其他雲端儲存
- 至少保留 1 份完整備份
```

3. 記錄失敗的檔案處理方式：

```markdown
## 失敗檔案處理

### 檔案 1: corrupted.mp3
- 原因: 檔案損壞
- 影響: conversation xyz789 無音檔
- 處理: 通知用戶重新上傳

### 檔案 2: timeout.mp3
- 原因: 下載超時
- 影響: conversation abc999 無音檔
- 處理: 手動重試成功 / 標記為不可恢復
```

**產出**:
- `scripts/migration/reports/audio-migration-report-YYYYMMDD.json`
- GCS 清理計畫文件
- 失敗檔案處理記錄

---

## 驗收標準

完成此任務後，應達成以下標準：

- [ ] 所有音檔（≥99%）已遷移至 R2
- [ ] 所有 `conversations.audio_url` 已更新為 R2 URL
- [ ] 音檔可透過 R2 URL 正常播放
- [ ] 無 GCS URL 殘留在資料庫
- [ ] 遷移報告已產生
- [ ] GCS 備份計畫已制定（保留 30 天）

---

## 產出檔案

遷移完成後應產出：

```
scripts/migration/
├── data/
│   ├── gcs-audio-manifest.json          # GCS 音檔清單
│   └── audio-url-mapping.json           # GCS → R2 URL 對應
├── logs/
│   ├── audio-migration-YYYYMMDD.log     # 遷移日誌
│   └── audio-verification-YYYYMMDD.log  # URL 驗證日誌
├── reports/
│   └── audio-migration-report-YYYYMMDD.json
└── progress/
    └── audio-progress.json (遷移完成後可刪除)
```

---

## 故障排除

### 問題 1: GCS 下載緩慢

**症狀**: 遷移速度 < 10 MB/s

**解決方案**:
1. 檢查網路頻寬
2. 減少並行數量（`AUDIO_CONCURRENCY=3`）
3. 使用 GCS Transfer Service（適合大量資料）

### 問題 2: R2 上傳失敗

**症狀**: `Error: Upload failed: 403 Forbidden`

**解決方案**:
1. 檢查 R2 API Token 權限
2. 確認 bucket 名稱正確
3. 檢查 bucket 是否達到儲存限制

### 問題 3: 音檔無法播放

**症狀**: 瀏覽器顯示 `CORS error`

**解決方案**:
1. 設定 R2 bucket CORS 規則：

```json
// R2 CORS 設定
[
  {
    "AllowedOrigins": ["https://your-app-domain.com"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

2. 或使用 signed URLs 繞過 CORS

### 問題 4: 部分檔案遺失

**症狀**: 有些 conversation 沒有對應的音檔

**解決方案**:
1. 檢查 V2 是否本來就沒有音檔
2. 查看失敗清單是否有這些檔案
3. 標記為「音檔不可用」並通知相關用戶

---

## 效能最佳化

### 大規模遷移（>1000 檔案）

```bash
# 使用更高的並行度
AUDIO_CONCURRENCY=10 bun run scripts/migration/migrate-audio.ts

# 或分批執行
bun run scripts/migration/migrate-audio.ts --batch-start 0 --batch-end 500
bun run scripts/migration/migrate-audio.ts --batch-start 500 --batch-end 1000
```

### 超大檔案處理（>100MB）

```bash
# 對超大檔案使用 multipart upload
bun run scripts/migration/migrate-audio.ts --multipart-threshold 100MB
```

---

## 緊急回滾計畫

> **重要**: 如果遷移後發現重大問題，請按照以下步驟回滾。

### 回滾觸發條件

- 超過 5% 的音檔無法播放
- 音檔播放延遲顯著增加（> 2 秒）
- R2 服務不穩定或中斷
- 使用者大量回報音檔問題

### 回滾步驟

**Step 1: 停止遷移（如果還在進行）**

```bash
# 終止遷移腳本
pkill -f migrate-audio.ts

# 或使用 Ctrl+C
```

**Step 2: 回滾資料庫 URL**

```bash
# 執行 URL 回滾腳本
bun run scripts/migration/rollback-audio-urls.ts
```

這個腳本會：

- 讀取 `audio-url-mapping.json` 中的對應關係
- 將 `conversations.audio_url` 從 R2 URL 還原為 GCS URL
- 產生回滾報告

**Step 3: 驗證回滾**

```sql
-- 確認 URL 已還原為 GCS 格式
SELECT COUNT(*) FROM conversations
WHERE audio_url LIKE 'gs://%';

-- 應該等於原始音檔數量
```

**Step 4: 測試音檔播放**

```bash
# 抽樣測試 GCS URL
bun run scripts/migration/verify-audio-urls.ts --source gcs --sample 10
```

### 回滾後處理

1. 分析問題原因
2. 修復後重新執行遷移
3. R2 上已上傳的檔案可以保留（不影響計費太多）或手動清除

---

## 監控與告警

### 遷移過程監控

**方式 1: 即時日誌監控**

```bash
# 在另一個終端機視窗執行
tail -f scripts/migration/logs/audio-migration-*.log
```

**方式 2: 進度檔案監控**

```bash
# 每 30 秒檢查一次進度
watch -n 30 'cat scripts/migration/progress/audio-progress.json | jq .'
```

**方式 3: 簡易告警腳本**

建立 `scripts/migration/monitor-audio.sh`：

```bash
#!/bin/bash
# 監控遷移失敗率，超過閾值時發出警告

THRESHOLD=5  # 失敗率閾值 (%)
PROGRESS_FILE="scripts/migration/progress/audio-progress.json"

while true; do
  if [ -f "$PROGRESS_FILE" ]; then
    SUCCESS=$(jq '.successCount' "$PROGRESS_FILE")
    FAILED=$(jq '.failedCount' "$PROGRESS_FILE")
    TOTAL=$((SUCCESS + FAILED))

    if [ $TOTAL -gt 0 ]; then
      FAIL_RATE=$((FAILED * 100 / TOTAL))

      if [ $FAIL_RATE -ge $THRESHOLD ]; then
        echo "⚠️  警告: 失敗率 ${FAIL_RATE}% 超過閾值 ${THRESHOLD}%"
        # 可以在這裡加入通知（如 Slack webhook）
      fi
    fi
  fi
  sleep 60
done
```

### 遷移後監控

遷移完成後，建議監控以下指標：

| 指標 | 監控方式 | 告警閾值 |
| ---- | -------- | -------- |
| 音檔載入時間 | 前端 Performance API | > 2 秒 |
| 404 錯誤率 | Cloudflare Analytics | > 1% |
| R2 頻寬使用 | Cloudflare Dashboard | 接近限額 80% |
| 使用者回報 | 客服系統 | 任何音檔問題 |

---

## 遷移腳本來源

本文件中提到的遷移腳本來自 **Phase 3** 的產出：

| 腳本 | 來源 | 說明 |
| ---- | ---- | ---- |
| `test-gcs-connection.ts` | Phase 3 Task 2 | GCS 連線測試 |
| `test-r2-connection.ts` | Phase 3 Task 2 | R2 連線測試 |
| `list-gcs-audio.ts` | Phase 3 Task 3 | GCS 音檔清單匯出 |
| `verify-audio-mapping.ts` | Phase 3 Task 3 | 音檔與 conversation 對應驗證 |
| `migrate-audio.ts` | Phase 3 Task 4 | 主要遷移腳本 |
| `migrate-single-audio.ts` | Phase 3 Task 4 | 單檔遷移（除錯用） |
| `update-audio-urls.ts` | Phase 3 Task 5 | 資料庫 URL 更新 |
| `verify-audio-urls.ts` | Phase 3 Task 5 | URL 可存取性驗證 |
| `generate-audio-report.ts` | Phase 3 Task 6 | 遷移報告產生 |
| `rollback-audio-urls.ts` | Phase 3 Task 6 | URL 回滾腳本 |

如果這些腳本不存在，請先完成 Phase 3 或聯繫負責 Phase 3 的開發人員。

---

## 下一步

完成音檔遷移後：

1. 通知 Agent 1 音檔 URL 已更新（如果 Agent 1 還在執行）
2. 通知 Agent 3 音檔遷移完成，可以進行完整的端對端測試
3. 設定提醒：30 天後評估是否刪除 GCS 音檔
4. 持續監控 R2 音檔的存取狀況（至少 1 週）
