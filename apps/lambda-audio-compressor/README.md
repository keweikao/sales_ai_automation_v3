# Lambda Audio Compressor

AWS Lambda 音檔壓縮服務

## 功能

將上傳的音檔壓縮為適合 Whisper 轉錄的格式:
- 位元率: 32kbps
- 採樣率: 16kHz
- 聲道: 單聲道
- 格式: MP3

## 部署步驟

### 前置需求

1. 安裝 AWS CLI
```bash
# macOS
brew install awscli

# 設定 AWS 憑證
aws configure
```

2. 安裝依賴
```bash
cd apps/lambda-audio-compressor
npm install
```

### 建立 Lambda Function

#### 方法 1: 使用 AWS Console (推薦新手)

1. 前往 [AWS Lambda Console](https://console.aws.amazon.com/lambda)
2. 點擊 "Create function"
3. 選擇 "Author from scratch"
4. 設定:
   - Function name: `sales-ai-audio-compressor`
   - Runtime: `Node.js 18.x`
   - Architecture: `x86_64`
   - Execution role: 建立新角色 (預設權限即可)
5. 點擊 "Create function"

#### 方法 2: 使用 AWS CLI

```bash
# 建立 IAM Role
aws iam create-role \
  --role-name lambda-audio-compressor-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# 附加基本執行權限
aws iam attach-role-policy \
  --role-name lambda-audio-compressor-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# 建立 Lambda Function
aws lambda create-function \
  --function-name sales-ai-audio-compressor \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-audio-compressor-role \
  --handler src/index.handler \
  --timeout 30 \
  --memory-size 512 \
  --zip-file fileb://function.zip
```

### 新增 FFmpeg Layer

Lambda 預設沒有 FFmpeg,需要新增 Layer:

1. 使用現成的 FFmpeg Layer (推薦)
   - 前往: https://github.com/serverlesspub/ffmpeg-aws-lambda-layer
   - 或使用: `arn:aws:lambda:us-east-1:145266761615:layer:ffmpeg:4`

2. 在 Lambda Console:
   - 選擇你的 function
   - 往下滾動到 "Layers"
   - 點擊 "Add a layer"
   - 選擇 "Specify an ARN"
   - 輸入: `arn:aws:lambda:YOUR_REGION:145266761615:layer:ffmpeg:4`
   - 點擊 "Add"

### 設定 Lambda

在 Lambda Console 的 "Configuration" 頁面:

1. **General configuration**:
   - Memory: `512 MB`
   - Timeout: `30 seconds`
   - Ephemeral storage: `512 MB`

2. **Environment variables** (可選):
   ```
   LOG_LEVEL=info
   ```

### 部署程式碼

#### 方法 1: 上傳 ZIP

```bash
# 打包程式碼
cd apps/lambda-audio-compressor
npm run build

# 上傳
aws lambda update-function-code \
  --function-name sales-ai-audio-compressor \
  --zip-file fileb://function.zip
```

#### 方法 2: 使用 Console

1. 在 Lambda Console,點擊 "Upload from" → ".zip file"
2. 選擇 `function.zip`
3. 點擊 "Save"

### 建立 Function URL (HTTP API)

讓 API Server 可以透過 HTTPS 呼叫:

```bash
aws lambda create-function-url-config \
  --function-name sales-ai-audio-compressor \
  --auth-type NONE \
  --cors '{
    "AllowOrigins": ["*"],
    "AllowMethods": ["POST"],
    "AllowHeaders": ["content-type"]
  }'
```

或在 Console:
1. 選擇 "Configuration" → "Function URL"
2. 點擊 "Create function URL"
3. Auth type: `NONE`
4. 啟用 CORS
5. 點擊 "Save"

取得 Function URL (類似):
```
https://abc123xyz.lambda-url.us-east-1.on.aws/
```

## 測試

### 本機測試

```bash
# 使用範例音檔測試
node test/test-lambda.js
```

### Lambda Console 測試

在 Lambda Console,點擊 "Test":

```json
{
  "audioBase64": "//uQx...base64編碼的音檔..."
}
```

或使用 URL:

```json
{
  "audioUrl": "https://example.com/audio.mp3"
}
```

### curl 測試

```bash
curl -X POST https://YOUR_FUNCTION_URL/ \
  -H "Content-Type: application/json" \
  -d '{
    "audioUrl": "https://example.com/test-audio.mp3"
  }'
```

## API 文件

### 請求格式

```typescript
{
  audioBase64?: string;  // Base64 編碼的音檔 (二選一)
  audioUrl?: string;     // 音檔 URL (二選一)
}
```

### 回應格式 (成功)

```typescript
{
  success: true,
  compressedAudioBase64: string,  // 壓縮後的音檔 (Base64)
  originalSize: number,           // 原始大小 (bytes)
  compressedSize: number,         // 壓縮後大小 (bytes)
  compressionRatio: number,       // 壓縮率 (%)
  processingTime: number,         // 總處理時間 (ms)
  compressionTime: number         // FFmpeg 壓縮時間 (ms)
}
```

### 回應格式 (錯誤)

```typescript
{
  success: false,
  error: string,
  stack?: string
}
```

## 監控

### CloudWatch Logs

查看執行日誌:
```bash
aws logs tail /aws/lambda/sales-ai-audio-compressor --follow
```

### Metrics

在 Lambda Console 查看:
- Invocations (呼叫次數)
- Duration (執行時間)
- Errors (錯誤率)
- Throttles (限流)

## 成本估算

### 免費額度 (每月)
- 1,000,000 次請求
- 400,000 GB-秒運算時間

### 範例計算 (512 MB, 3 秒/次)

| 每月音檔數 | 請求次數 | GB-秒 | 費用 |
|-----------|---------|-------|------|
| 100 | 100 | 150 | $0 |
| 1,000 | 1,000 | 1,500 | $0 |
| 10,000 | 10,000 | 15,000 | $0 |
| 100,000 | 100,000 | 150,000 | $0 |

**結論**: 在免費額度內,幾乎零成本!

## 故障排除

### FFmpeg not found

確認已新增 FFmpeg Layer:
```bash
aws lambda get-function --function-name sales-ai-audio-compressor \
  --query 'Configuration.Layers'
```

### Timeout

增加 timeout 設定:
```bash
aws lambda update-function-configuration \
  --function-name sales-ai-audio-compressor \
  --timeout 60
```

### 記憶體不足

增加記憶體:
```bash
aws lambda update-function-configuration \
  --function-name sales-ai-audio-compressor \
  --memory-size 1024
```

## 安全建議

### 生產環境

1. **啟用認證**:
   ```bash
   # 修改 Function URL 為需要認證
   aws lambda update-function-url-config \
     --function-name sales-ai-audio-compressor \
     --auth-type AWS_IAM
   ```

2. **新增 API Key**:
   在環境變數設定 API_KEY,並在程式碼中驗證

3. **限制檔案大小**:
   在程式碼中檢查 `audioData.length`,拒絕過大的檔案

4. **設定 VPC** (可選):
   如果需要存取私有資源

## 更新

部署新版本:
```bash
cd apps/lambda-audio-compressor
npm run build
npm run deploy
```

## 刪除

```bash
# 刪除 Function URL
aws lambda delete-function-url-config \
  --function-name sales-ai-audio-compressor

# 刪除 Function
aws lambda delete-function \
  --function-name sales-ai-audio-compressor

# 刪除 Role
aws iam delete-role \
  --role-name lambda-audio-compressor-role
```
