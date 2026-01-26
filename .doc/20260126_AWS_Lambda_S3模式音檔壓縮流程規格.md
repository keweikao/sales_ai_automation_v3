# AWS Lambda S3 模式音檔壓縮流程規格

## 目的

解決 AWS Lambda Function URL 的 **6MB 回應限制**問題。

原本 Lambda 壓縮後將音檔以 Base64 編碼直接回傳給 Queue Worker，但當壓縮後檔案仍大於 6MB 時，Lambda 回應會被截斷導致處理失敗。

**S3 模式**透過將壓縮後音檔上傳到 S3，僅回傳 S3 Key，讓 Queue Worker 再從 S3 下載，完美繞過 6MB 限制。

---

## 架構圖

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        音檔處理完整流程                                      │
└─────────────────────────────────────────────────────────────────────────────┘

                                 ┌─────────────┐
                                 │   Slack     │
                                 │  使用者上傳  │
                                 └──────┬──────┘
                                        │
                                        ▼
                              ┌─────────────────┐
                              │   Slack Bot     │
                              │ (接收音檔)       │
                              └────────┬────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  Conversation   │
                              │    Router       │
                              │ (建立記錄)       │
                              └────────┬────────┘
                                       │ 上傳原始音檔
                                       ▼
                              ┌─────────────────┐
                              │  Cloudflare R2  │
                              │  (原始音檔儲存)  │
                              └────────┬────────┘
                                       │ 推送訊息到 Queue
                                       ▼
                              ┌─────────────────┐
                              │ Transcription   │
                              │     Queue       │
                              └────────┬────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          Queue Worker 處理流程                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. 從 R2 下載原始音檔                                                       │
│          │                                                                   │
│          ▼                                                                   │
│  2. 檢查檔案大小 (> 25MB Groq 限制?)                                         │
│          │                                                                   │
│          ├── 否 ──► 直接使用原始音檔                                         │
│          │                                                                   │
│          └── 是 ──► 呼叫 Lambda 壓縮 (S3 模式)                               │
│                            │                                                 │
│                            ▼                                                 │
│              ┌─────────────────────────────────────┐                         │
│              │        AWS Lambda 壓縮流程          │                         │
│              │                                     │                         │
│              │  1. 從 R2 Presigned URL 下載音檔    │                         │
│              │  2. FFmpeg 壓縮 (32kbps/16kHz/mono) │                         │
│              │  3. 上傳壓縮音檔到 AWS S3           │                         │
│              │  4. 回傳 S3 Key                     │                         │
│              └──────────────┬──────────────────────┘                         │
│                             │                                                │
│                             ▼                                                │
│              ┌─────────────────────────────────────┐                         │
│              │          AWS S3                     │                         │
│              │   (壓縮音檔暫存)                    │                         │
│              └──────────────┬──────────────────────┘                         │
│                             │ Queue Worker 下載                              │
│                             ▼                                                │
│  3. 取得壓縮後音檔                                                           │
│          │                                                                   │
│          ▼                                                                   │
│  4. 呼叫 Groq Whisper 轉錄                                                   │
│          │                                                                   │
│          ▼                                                                   │
│  5. 呼叫 Gemini MEDDIC 分析                                                  │
│          │                                                                   │
│          ▼                                                                   │
│  6. 更新資料庫、發送 Slack 通知                                              │
│          │                                                                   │
│          ▼                                                                   │
│  7. 刪除 S3 暫存檔案 (清理)                                                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## S3 模式流程詳解

### 1. Queue Worker 觸發壓縮

當音檔大小超過 Groq 的 25MB 限制時，Queue Worker 會：

```typescript
// 判斷是否使用 S3 輸出模式
const useS3Mode = !!(
  env.AWS_S3_ACCESS_KEY &&
  env.AWS_S3_SECRET_KEY &&
  env.AWS_S3_REGION &&
  env.AWS_S3_BUCKET
);

// 呼叫 Lambda 壓縮
const compressionResult = await compressor.compressFromUrl(presignedUrl, {
  outputMode: useS3Mode ? "s3" : "base64",
  fileName: metadata.fileName,
});
```

### 2. Lambda 處理流程 (S3 模式)

Lambda 接收到 `outputMode: "s3"` 時：

1. 從 Presigned URL 下載原始音檔
2. 使用 FFmpeg 壓縮 (32kbps/16kHz/mono)
3. 上傳壓縮音檔到 S3
4. 回傳 S3 Key 和 Bucket 名稱

```javascript
// Lambda 回傳格式 (S3 模式)
{
  success: true,
  outputMode: "s3",
  s3Key: "compressed-audio/1706284800000-abc123-audio.mp3",
  s3Bucket: "sales-ai-compressed-audio",
  originalSize: 52428800,    // 50 MB
  compressedSize: 2097152,   // 2 MB
  compressionRatio: 96.0,
  processingTime: 15000,
  compressionTime: 12000
}
```

### 3. Queue Worker 下載壓縮音檔

```typescript
if (compressionResult.outputMode === "s3" && compressionResult.s3Key) {
  // 從 S3 下載壓縮後音檔
  const s3Service = createS3Service({
    accessKeyId: env.AWS_S3_ACCESS_KEY!,
    secretAccessKey: env.AWS_S3_SECRET_KEY!,
    region: env.AWS_S3_REGION!,
    bucket: env.AWS_S3_BUCKET!,
  });

  compressedBuffer = await s3Service.download(compressionResult.s3Key);

  // 下載完成後刪除 S3 檔案
  await s3Service.delete(compressionResult.s3Key);
}
```

---

## 環境變數清單

### Queue Worker (`apps/queue-worker`)

| 變數名稱 | 必要性 | 說明 |
|---------|--------|------|
| `LAMBDA_COMPRESSOR_URL` | 必要 | Lambda Function URL |
| `AWS_S3_ACCESS_KEY` | S3 模式必要 | AWS IAM Access Key |
| `AWS_S3_SECRET_KEY` | S3 模式必要 | AWS IAM Secret Key |
| `AWS_S3_REGION` | S3 模式必要 | S3 Bucket Region (e.g., `ap-northeast-1`) |
| `AWS_S3_BUCKET` | S3 模式必要 | S3 Bucket 名稱 |

### Lambda Function (`apps/lambda-audio-compressor`)

| 變數名稱 | 必要性 | 說明 |
|---------|--------|------|
| `AWS_S3_REGION` | S3 模式必要 | S3 Bucket Region |
| `AWS_S3_BUCKET` | S3 模式必要 | S3 Bucket 名稱 |
| `AWS_S3_PREFIX` | 選填 | S3 Key 前綴 (預設: `compressed-audio/`) |

---

## 部署步驟

### 1. 設定 AWS S3 Bucket

```bash
# 建立 S3 Bucket (選擇適當的 Region)
aws s3 mb s3://sales-ai-compressed-audio --region ap-northeast-1

# 設定 Lifecycle Policy (自動刪除 1 天以上的檔案)
aws s3api put-bucket-lifecycle-configuration \
  --bucket sales-ai-compressed-audio \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "DeleteOldFiles",
      "Status": "Enabled",
      "Expiration": { "Days": 1 },
      "Filter": { "Prefix": "compressed-audio/" }
    }]
  }'
```

### 2. 設定 Lambda 環境變數

```bash
aws lambda update-function-configuration \
  --function-name audio-compressor \
  --environment "Variables={
    AWS_S3_REGION=ap-northeast-1,
    AWS_S3_BUCKET=sales-ai-compressed-audio,
    AWS_S3_PREFIX=compressed-audio/
  }"
```

### 3. 設定 Queue Worker Secrets

```bash
# 使用 Wrangler 設定 secrets
cd apps/queue-worker

wrangler secret put AWS_S3_ACCESS_KEY
wrangler secret put AWS_S3_SECRET_KEY
wrangler secret put AWS_S3_REGION
wrangler secret put AWS_S3_BUCKET
```

### 4. 部署 Queue Worker

```bash
cd apps/queue-worker
bunx wrangler deploy
```

---

## 今日變更摘要

### 2026-01-26

1. **Lambda Function 新增 S3 輸出模式**
   - 支援 `outputMode: "s3"` 參數
   - S3 模式使用較高位元率 (32kbps) 確保轉錄品質
   - 自動生成唯一的 S3 Key

2. **Queue Worker 整合 S3 模式**
   - 自動偵測 AWS S3 環境變數決定使用模式
   - 新增 S3 下載和刪除功能
   - 下載後自動清理 S3 暫存檔案

3. **移除 Conversation Router 的壓縮邏輯**
   - 簡化架構：所有壓縮處理集中在 Queue Worker
   - 移除 `ENABLE_AUDIO_COMPRESSION`、`COMPRESSION_THRESHOLD_MB`、`LAMBDA_COMPRESSOR_URL` 環境變數檢查
   - 移除 `createLambdaCompressor` import

---

## 相關檔案

| 檔案路徑 | 說明 |
|---------|------|
| `apps/lambda-audio-compressor/src/index.js` | Lambda 壓縮函數 |
| `apps/queue-worker/src/index.ts` | Queue Worker (壓縮整合邏輯) |
| `apps/queue-worker/wrangler.toml` | Queue Worker 配置 |
| `packages/services/src/compression/lambda-compressor.ts` | Lambda Client |
| `packages/services/src/storage/s3.ts` | AWS S3 Service |
| `packages/api/src/routers/conversation.ts` | Conversation Router (已移除壓縮邏輯) |

---

## 效能考量

| 指標 | Base64 模式 | S3 模式 |
|------|-------------|---------|
| 最大支援檔案 | ~6MB 壓縮後 | 無限制 |
| 額外延遲 | 無 | +2-5 秒 (S3 上傳/下載) |
| 音質 | 可能極低 (8kbps) | 穩定 (32kbps) |
| 成本 | 無額外 | S3 儲存 + 傳輸費用 |

**建議**：只要有設定 AWS S3 環境變數，系統會自動使用 S3 模式以獲得最佳轉錄品質。

---

## 部署紀錄

### 2026-01-26 部署完成

#### Lambda Function (`sales-ai-audio-compressor`)

| 項目 | 值 |
|------|-----|
| Function URL | `https://rtcbg5wvl6ui4bth5rehbai3nq0clmjj.lambda-url.us-east-1.on.aws/` |
| Region | `us-east-1` |
| Runtime | Node.js 24.x |
| Memory | 2048 MB |
| Timeout | 300 秒 |
| S3 Bucket | `lambda-deploy-sales-automaiont-v3` |
| S3 Prefix | `compressed-audio/` |
| IAM Role | `sales-ai-audio-compressor-role-3pawx61r` |
| S3 權限 | `AmazonS3FullAccess` ✅ |

#### Queue Worker (`sales-ai-queue-worker`)

已設定 Secrets：
- `LAMBDA_COMPRESSOR_URL` ✅
- `AWS_S3_ACCESS_KEY` ✅
- `AWS_S3_SECRET_KEY` ✅
- `AWS_S3_REGION` ✅
- `AWS_S3_BUCKET` ✅

#### 本機備份

環境變數已備份至 `.env.aws.local`（已被 `.gitignore` 排除）

---

## 測試方式

上傳一個 **> 25MB** 的音檔到 Slack，觀察 Queue Worker 日誌：

```bash
cd apps/queue-worker
npx wrangler tail
```

預期日誌：
```
[Queue] ⚠️  File size 30.00MB exceeds Groq limit (25MB)
[Queue] 🗜️  Starting fallback compression via Lambda... (outputMode: s3)
[Queue] 📤 Sending presigned URL to Lambda
[Queue] ✓ Compression successful: 31457280 -> 3145728 bytes
[Queue]   Reduction: 90%, outputMode: s3
[Queue] 📥 Downloading compressed audio from S3: compressed-audio/xxx.mp3
[Queue] 🗑️  Deleted S3 file: compressed-audio/xxx.mp3
[Queue] ✓ Using compressed audio: 3.00MB
```
