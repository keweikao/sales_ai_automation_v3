#!/bin/bash

# ============================================================
# Agent A-D 快速部署腳本
# ============================================================

set -e  # 遇到錯誤立即停止

echo "🚀 開始部署 Agent A-D..."
echo ""

# ============================================================
# 檢查前置條件
# ============================================================

echo "📋 Step 0: 檢查前置條件"
echo "────────────────────────────────────────"

# 檢查是否已安裝 wrangler
if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler 未安裝"
    echo "   請執行: npm install -g wrangler"
    exit 1
fi
echo "✅ wrangler 已安裝"

# 檢查是否已登入 Cloudflare
if ! wrangler whoami &> /dev/null; then
    echo "❌ 尚未登入 Cloudflare"
    echo "   請執行: wrangler login"
    exit 1
fi
echo "✅ 已登入 Cloudflare"

# 檢查 Migration 狀態
echo ""
echo "🔍 檢查 Database Migration 狀態..."
cd /Users/stephen/Desktop/sales_ai_automation_v3
if bun run scripts/check-migration-status.ts | grep -q "Migration 0003 已完成"; then
    echo "✅ Migration 已完成"
else
    echo "❌ Migration 尚未完成"
    echo "   請先執行: bun run scripts/apply-migration-0003.ts"
    exit 1
fi

echo ""
echo "════════════════════════════════════════"
echo ""

# ============================================================
# Step 1: 部署 Queue Worker
# ============================================================

echo "📦 Step 1: 部署 Queue Worker"
echo "────────────────────────────────────────"

cd /Users/stephen/Desktop/sales_ai_automation_v3/apps/queue-worker

echo "⚠️  需要設定以下環境變數 (如果尚未設定):"
echo ""
echo "   wrangler secret put GEMINI_API_KEY"
echo "   wrangler secret put GROQ_API_KEY"
echo "   wrangler secret put CLOUDFLARE_R2_ACCESS_KEY"
echo "   wrangler secret put CLOUDFLARE_R2_SECRET_KEY"
echo "   wrangler secret put CLOUDFLARE_R2_BUCKET"
echo "   wrangler secret put CLOUDFLARE_R2_ENDPOINT"
echo ""

read -p "是否已設定所有環境變數? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "⏸️  請先設定環境變數,然後重新執行此腳本"
    exit 1
fi

echo "🚀 部署 Queue Worker..."
if wrangler deploy; then
    echo "✅ Queue Worker 部署成功"
else
    echo "❌ Queue Worker 部署失敗"
    exit 1
fi

echo ""
echo "════════════════════════════════════════"
echo ""

# ============================================================
# Step 2: 部署 Slack Bot
# ============================================================

echo "📦 Step 2: 部署 Slack Bot"
echo "────────────────────────────────────────"

cd /Users/stephen/Desktop/sales_ai_automation_v3/apps/slack-bot

echo "⚠️  需要設定以下環境變數 (如果尚未設定):"
echo ""
echo "   wrangler secret put SLACK_BOT_TOKEN"
echo "   wrangler secret put SLACK_SIGNING_SECRET"
echo "   wrangler secret put API_BASE_URL"
echo "   wrangler secret put API_TOKEN"
echo ""

read -p "是否已設定所有環境變數? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "⏸️  請先設定環境變數,然後重新執行此腳本"
    exit 1
fi

echo "🚀 部署 Slack Bot..."
if wrangler deploy; then
    echo "✅ Slack Bot 部署成功"
else
    echo "❌ Slack Bot 部署失敗"
    exit 1
fi

echo ""
echo "════════════════════════════════════════"
echo ""

# ============================================================
# Step 3: (可選) 設定美業 Channel
# ============================================================

echo "📦 Step 3: 設定美業 Channel (可選)"
echo "────────────────────────────────────────"

read -p "是否要設定美業 Channel? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "請輸入美業 Channel ID (例如: C123456789):"
    read BEAUTY_CHANNEL_ID

    if [ -z "$BEAUTY_CHANNEL_ID" ]; then
        echo "⏭️  跳過美業 Channel 設定"
    else
        CHANNEL_JSON="{\"$BEAUTY_CHANNEL_ID\":\"beauty\"}"
        echo "📝 設定 PRODUCT_LINE_CHANNELS = $CHANNEL_JSON"
        echo "$CHANNEL_JSON" | wrangler secret put PRODUCT_LINE_CHANNELS
        echo "✅ 美業 Channel 設定完成"
    fi
else
    echo "⏭️  跳過美業 Channel 設定"
    echo "   (可稍後執行: wrangler secret put PRODUCT_LINE_CHANNELS)"
fi

echo ""
echo "════════════════════════════════════════"
echo ""

# ============================================================
# 部署完成
# ============================================================

echo "🎉 部署完成!"
echo ""
echo "✅ Queue Worker: 已部署"
echo "✅ Slack Bot: 已部署"
echo ""
echo "📋 下一步:"
echo "   1. 在 Slack Channel 上傳音檔測試"
echo "   2. 檢查 Cloudflare Dashboard 的 logs"
echo "   3. 執行驗證測試: bun run scripts/verify-deployment.ts"
echo ""
echo "📚 詳細文件:"
echo "   .doc/20260119_Agent_A-D_部署完成指南.md"
echo ""
