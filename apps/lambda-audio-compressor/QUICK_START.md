# Lambda 快速部署指南

**遇到錯誤**: `Function not found: arn:aws:lambda:ap-east-2:...`

**原因**: Region 設定錯誤,`ap-east-2` 不是有效的 AWS region

---

## 方案 A: 使用 AWS Console (最簡單) ⭐

**不需要安裝 AWS CLI,直接用網頁操作**

### 1. 前往 Lambda Console

訪問: https://console.aws.amazon.com/lambda

**⚠️ 重要**: 選擇正確的 Region

在右上角選擇:
- 🇺🇸 **US East (N. Virginia)** - `us-east-1` (推薦)
- 🇸🇬 Singapore - `ap-southeast-1`
- 🇯🇵 Tokyo - `ap-northeast-1`

### 2. 建立 Lambda Function

點擊 **"Create function"**

設定:
```
Function name:  sales-ai-audio-compressor
Runtime:        Node.js 18.x
Architecture:   x86_64
Execution role: Create a new role with basic Lambda permissions
```

點擊 **"Create function"**

### 3. 上傳程式碼

在 "Code source" 區域:
1. 點擊 **"Upload from"** → **".zip file"**
2. 選擇檔案: `/Users/stephen/Desktop/sales_ai_automation_v3/apps/lambda-audio-compressor/function.zip`
3. 點擊 **"Save"**

### 4. 新增 FFmpeg Layer

在 "Layers" 區域:
1. 點擊 **"Add a layer"**
2. 選擇 **"Specify an ARN"**
3. 根據您選的 Region,輸入對應的 ARN:

**US East (N. Virginia) - us-east-1** (推薦):
```
arn:aws:lambda:us-east-1:145266761615:layer:ffmpeg:4
```

**Singapore - ap-southeast-1**:
```
arn:aws:lambda:ap-southeast-1:145266761615:layer:ffmpeg:4
```

**Tokyo - ap-northeast-1**:
```
arn:aws:lambda:ap-northeast-1:145266761615:layer:ffmpeg:4
```

4. 點擊 **"Add"**

### 5. 調整設定

前往 **"Configuration"** → **"General configuration"** → **"Edit"**

設定:
```
Memory:    512 MB
Timeout:   30 seconds
```

點擊 **"Save"**

### 6. 建立 Function URL

前往 **"Configuration"** → **"Function URL"** → **"Create function URL"**

設定:
```
Auth type: NONE

☑ Configure CORS
Allow origin:  *
Allow methods: POST
Allow headers: content-type
```

點擊 **"Save"**

### 7. 複製 Function URL

會顯示類似:
```
https://abc123xyz456.lambda-url.us-east-1.on.aws/
```

**⚠️ 請複製並保存這個 URL!**

---

## 方案 B: 安裝 AWS CLI 並重新部署

### 1. 安裝 AWS CLI

```bash
# macOS
brew install awscli

# 或下載安裝包
# https://aws.amazon.com/cli/
```

### 2. 設定 AWS CLI

```bash
aws configure

# 輸入:
AWS Access Key ID: YOUR_ACCESS_KEY_ID
AWS Secret Access Key: YOUR_SECRET_ACCESS_KEY
Default region name: us-east-1  ⬅️ 重要!使用正確的 region
Default output format: json
```

### 3. 確認設定

```bash
# 檢查 region
aws configure get region
# 應該顯示: us-east-1

# 檢查帳號
aws sts get-caller-identity
# 應該顯示您的 Account ID
```

### 4. 執行部署腳本

```bash
cd /Users/stephen/Desktop/sales_ai_automation_v3/apps/lambda-audio-compressor

# 一鍵部署腳本
bash << 'EOF'
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

echo "等待 IAM Role 生效..."
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
  --memory-size 512 \
  --region us-east-1

# 4. 新增 FFmpeg Layer
aws lambda update-function-configuration \
  --function-name sales-ai-audio-compressor \
  --layers arn:aws:lambda:us-east-1:145266761615:layer:ffmpeg:4 \
  --region us-east-1

# 5. 建立 Function URL
aws lambda create-function-url-config \
  --function-name sales-ai-audio-compressor \
  --auth-type NONE \
  --cors '{
    "AllowOrigins": ["*"],
    "AllowMethods": ["POST"],
    "AllowHeaders": ["content-type"]
  }' \
  --region us-east-1

# 6. 新增公開存取權限
aws lambda add-permission \
  --function-name sales-ai-audio-compressor \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region us-east-1

# 7. 取得 Function URL
echo ""
echo "========================================="
echo "✅ 部署完成!"
echo "========================================="
echo ""
echo "您的 Function URL:"
aws lambda get-function-url-config \
  --function-name sales-ai-audio-compressor \
  --region us-east-1 \
  --query FunctionUrl \
  --output text
echo ""
echo "請複製並保存上面的 URL!"
echo "========================================="
EOF
```

---

## 常見的 AWS Regions

| Region Name | Region Code | 位置 |
|-------------|-------------|------|
| US East (N. Virginia) | `us-east-1` | 🇺🇸 美國東部 |
| US West (Oregon) | `us-west-2` | 🇺🇸 美國西部 |
| Asia Pacific (Singapore) | `ap-southeast-1` | 🇸🇬 新加坡 |
| Asia Pacific (Tokyo) | `ap-northeast-1` | 🇯🇵 東京 |
| Asia Pacific (Sydney) | `ap-southeast-2` | 🇦🇺 雪梨 |
| Europe (Ireland) | `eu-west-1` | 🇮🇪 愛爾蘭 |

**❌ 不存在的 Region**:
- `ap-east-2` (錯誤!)

---

## 測試 Lambda

部署完成後,測試是否正常:

```bash
# 替換成您的 Function URL
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

## 下一步

取得 Function URL 後,繼續設定 Server:

```bash
cd /Users/stephen/Desktop/sales_ai_automation_v3/apps/server

# 設定 Lambda URL
npx wrangler secret put LAMBDA_COMPRESSOR_URL
# 貼上您的 Function URL

# 啟用壓縮
npx wrangler secret put ENABLE_AUDIO_COMPRESSION
# 輸入: true

# 部署 Server
npx wrangler deploy
```

---

## 需要幫助?

如果還有問題,請提供:
1. 您使用哪個方案 (A 或 B)
2. 在哪個步驟遇到問題
3. 完整的錯誤訊息

我會立即協助! 🚀
