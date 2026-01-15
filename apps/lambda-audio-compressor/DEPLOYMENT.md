# Lambda 音檔壓縮服務部署指南

**目的**: 逐步部署 AWS Lambda 音檔壓縮服務

---

## 前置需求檢查

✅ **已完成**:
- [x] Lambda 程式碼已準備 (`src/index.js`)
- [x] ZIP 檔案已打包 (`function.zip` - 2KB)

⚠️ **需要**:
- [ ] AWS 帳號
- [ ] AWS CLI 已安裝 (可選,使用 Console 也可以)

---

## 部署方式選擇

### 方式 A: AWS Console (推薦新手) ⭐

**優點**: 視覺化介面,容易理解
**時間**: 約 10 分鐘

### 方式 B: AWS CLI (推薦進階用戶)

**優點**: 自動化,可重複執行
**時間**: 約 5 分鐘
**前提**: 需先安裝並設定 AWS CLI

---

## 方式 A: 使用 AWS Console 部署

### 步驟 1: 建立 Lambda Function (3 分鐘)

1. **前往 Lambda Console**
   - 訪問: https://console.aws.amazon.com/lambda
   - 登入您的 AWS 帳號

2. **建立新 Function**
   - 點擊右上角 **"Create function"**

3. **選擇建立方式**
   - 選擇 **"Author from scratch"** (從頭建立)

4. **基本資訊設定**
   ```
   Function name:  sales-ai-audio-compressor
   Runtime:        Node.js 18.x (或 20.x)
   Architecture:   x86_64
   ```

5. **執行角色設定**
   - Execution role: 選擇 **"Create a new role with basic Lambda permissions"**
   - 角色名稱會自動產生 (例如: `sales-ai-audio-compressor-role-xxxxx`)

6. **建立 Function**
   - 點擊右下角 **"Create function"**
   - 等待約 10 秒,Function 建立完成

### 步驟 2: 上傳程式碼 (2 分鐘)

1. **上傳 ZIP**
   - 在 Function 頁面,往下滾動到 **"Code source"** 區域
   - 點擊右上角 **"Upload from"** → **".zip file"**
   - 點擊 **"Upload"** 按鈕
   - 選擇檔案: `/Users/stephen/Desktop/sales_ai_automation_v3/apps/lambda-audio-compressor/function.zip`
   - 點擊 **"Save"**
   - 等待上傳完成 (約 3 秒)

2. **確認程式碼**
   - 在程式碼編輯器中應該看到 `src/index.js`
   - 展開 `src` 資料夾,可以看到完整的程式碼

### 步驟 3: 新增 FFmpeg Layer (3 分鐘)

Lambda 需要 FFmpeg 來壓縮音檔,我們使用現成的 Layer:

1. **開啟 Layers 設定**
   - 往下滾動到 **"Layers"** 區域
   - 點擊 **"Add a layer"**

2. **選擇 Layer**
   - Layer source: 選擇 **"Specify an ARN"**
   - 輸入 ARN (根據您的 AWS Region):

   **美國東部 (us-east-1)**:
   ```
   arn:aws:lambda:us-east-1:145266761615:layer:ffmpeg:4
   ```

   **其他 Region**:
   - us-west-1: `arn:aws:lambda:us-west-1:145266761615:layer:ffmpeg:4`
   - eu-west-1: `arn:aws:lambda:eu-west-1:145266761615:layer:ffmpeg:4`
   - ap-northeast-1: `arn:aws:lambda:ap-northeast-1:145266761615:layer:ffmpeg:4`

   > 💡 如果您在其他 Region,請訪問: https://github.com/serverlesspub/ffmpeg-aws-lambda-layer

3. **新增 Layer**
   - 點擊 **"Add"**
   - 確認 Layers 區域顯示 `ffmpeg:4`

### 步驟 4: 調整 Lambda 設定 (2 分鐘)

1. **前往 Configuration**
   - 點擊頂部 **"Configuration"** 頁籤

2. **General configuration**
   - 點擊 **"Edit"**
   - 設定:
     ```
     Memory:              512 MB
     Timeout:             30 sec
     Ephemeral storage:   512 MB
     ```
   - 點擊 **"Save"**

3. **確認設定**
   - Memory: 512 MB ✓
   - Timeout: 30 seconds ✓

### 步驟 5: 建立 Function URL (2 分鐘)

讓 API Server 可以透過 HTTPS 呼叫 Lambda:

1. **開啟 Function URL 設定**
   - 在 **"Configuration"** 頁籤
   - 左側選單選擇 **"Function URL"**
   - 點擊 **"Create function URL"**

2. **設定 Function URL**
   ```
   Auth type:  NONE (公開存取)

   CORS configuration:
   ☑ Configure cross-origin resource sharing (CORS)

   Allow origin:     *
   Allow methods:    POST
   Allow headers:    content-type
   ```

3. **建立 URL**
   - 點擊 **"Save"**
   - 複製顯示的 **Function URL**
   - 格式類似: `https://abc123xyz456.lambda-url.us-east-1.on.aws/`

4. **⚠️ 重要: 儲存這個 URL**
   ```
   您的 Lambda Function URL:
   https://_____________________________________.lambda-url.______.on.aws/

   請複製並儲存,稍後會用到!
   ```

### 步驟 6: 測試 Lambda Function (可選,2 分鐘)

在部署到 Server 之前,先測試 Lambda 是否正常運作:

1. **前往 Test 頁籤**
   - 點擊頂部 **"Test"** 頁籤
   - 點擊 **"Create new test event"**

2. **建立測試事件**
   ```json
   {
     "audioBase64": "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v///////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAQKAAAAAAAAA4SjRjqpAAAAAAD/+xDEAAPAAAGkAAAAIAAANIAAAARMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"
   }
   ```
   - Event name: `test-small-audio`
   - 點擊 **"Save"**

3. **執行測試**
   - 點擊 **"Test"** 按鈕
   - 等待執行完成 (約 1-2 秒)

4. **檢查結果**
   - 應該看到綠色的 **"Execution result: succeeded"**
   - Response 中包含:
     ```json
     {
       "statusCode": 200,
       "body": "{\"success\":true,\"compressedAudioBase64\":\"...\",..."
     }
     ```

如果測試成功,代表 Lambda 已正確設定! ✅

---

## 方式 B: 使用 AWS CLI 部署 (進階)

### 前置需求

1. **安裝 AWS CLI**
   ```bash
   # macOS
   brew install awscli

   # 或下載: https://aws.amazon.com/cli/
   ```

2. **設定 AWS 憑證**
   ```bash
   aws configure

   # 輸入:
   # AWS Access Key ID: YOUR_ACCESS_KEY
   # AWS Secret Access Key: YOUR_SECRET_KEY
   # Default region name: us-east-1 (或您的 region)
   # Default output format: json
   ```

### 一鍵部署腳本

執行以下指令:

```bash
cd /Users/stephen/Desktop/sales_ai_automation_v3/apps/lambda-audio-compressor

# 1. 建立 IAM Role
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

# 2. 附加執行權限
aws iam attach-role-policy \
  --role-name lambda-audio-compressor-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# 等待 10 秒讓 IAM Role 生效
sleep 10

# 3. 建立 Lambda Function
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws lambda create-function \
  --function-name sales-ai-audio-compressor \
  --runtime nodejs18.x \
  --role arn:aws:iam::${ACCOUNT_ID}:role/lambda-audio-compressor-role \
  --handler src/index.handler \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --memory-size 512

# 4. 新增 FFmpeg Layer
REGION=$(aws configure get region)
aws lambda update-function-configuration \
  --function-name sales-ai-audio-compressor \
  --layers arn:aws:lambda:${REGION}:145266761615:layer:ffmpeg:4

# 5. 建立 Function URL
aws lambda create-function-url-config \
  --function-name sales-ai-audio-compressor \
  --auth-type NONE \
  --cors '{
    "AllowOrigins": ["*"],
    "AllowMethods": ["POST"],
    "AllowHeaders": ["content-type"]
  }'

# 6. 新增公開存取權限
aws lambda add-permission \
  --function-name sales-ai-audio-compressor \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE

# 7. 取得 Function URL
aws lambda get-function-url-config \
  --function-name sales-ai-audio-compressor \
  --query FunctionUrl \
  --output text

# ⚠️ 記下最後顯示的 Function URL!
```

---

## 下一步: 設定 Server 環境變數

完成 Lambda 部署後,請繼續以下步驟:

### 1. 設定 Lambda URL

使用您剛才取得的 Function URL:

```bash
cd /Users/stephen/Desktop/sales_ai_automation_v3/apps/server

npx wrangler secret put LAMBDA_COMPRESSOR_URL
# 貼上您的 Function URL: https://xxxxx.lambda-url.us-east-1.on.aws/
```

### 2. 啟用壓縮功能

```bash
npx wrangler secret put ENABLE_AUDIO_COMPRESSION
# 輸入: true
```

### 3. 設定壓縮閾值 (可選)

```bash
npx wrangler secret put COMPRESSION_THRESHOLD_MB
# 輸入: 10
# (超過 10MB 才壓縮)
```

### 4. 部署更新後的 Server

```bash
cd apps/server
npx wrangler deploy
```

---

## 驗證部署

### 測試 Lambda 是否可呼叫

```bash
curl -X POST https://YOUR_FUNCTION_URL/ \
  -H "Content-Type: application/json" \
  -d '{"audioBase64":"SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA"}'
```

應該回傳:
```json
{
  "statusCode": 200,
  "body": "{\"success\":true,...}"
}
```

---

## 監控

### 查看 Lambda 日誌

```bash
# 即時查看日誌
aws logs tail /aws/lambda/sales-ai-audio-compressor --follow
```

### 查看 Metrics

前往 AWS CloudWatch Console:
https://console.aws.amazon.com/cloudwatch/

選擇 Lambda → sales-ai-audio-compressor

---

## 疑難排解

### 問題 1: "Invalid signature" 錯誤

**原因**: 可能沒有設定公開存取權限

**解決**:
```bash
aws lambda add-permission \
  --function-name sales-ai-audio-compressor \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE
```

### 問題 2: FFmpeg not found

**原因**: Layer 沒有正確新增

**解決**: 重新新增 Layer (參考步驟 3)

### 問題 3: Timeout

**原因**: 處理時間過長

**解決**:
```bash
aws lambda update-function-configuration \
  --function-name sales-ai-audio-compressor \
  --timeout 60
```

---

## 完成!

✅ Lambda Function 已部署
✅ FFmpeg Layer 已新增
✅ Function URL 已建立
✅ 準備整合到 Server

**您的 Function URL**:
```
https://_____________________________________.lambda-url.______.on.aws/
```

請保存這個 URL 並繼續設定 Server 環境變數!
