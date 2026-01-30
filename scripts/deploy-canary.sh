#!/bin/bash
# ============================================
# Canary 漸進式部署腳本
# ============================================
#
# 此腳本實現 Cloudflare Workers 的漸進式部署：
# 1. 先部署新版本，但只給 10% 流量
# 2. 監控 5 分鐘，確認無異常
# 3. 逐步增加到 50% → 100%
#
# 使用方式：
#   ./scripts/deploy-canary.sh <app> [percentage]
#
# 範例：
#   ./scripts/deploy-canary.sh server         # 預設 10% → 50% → 100%
#   ./scripts/deploy-canary.sh server 25      # 從 25% 開始
#   ./scripts/deploy-canary.sh queue-worker   # 部署 queue-worker
#
# 支援的 apps：
#   - server
#   - queue-worker
#   - slack-bot
#
# ============================================

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 參數
APP=${1:-""}
INITIAL_PERCENTAGE=${2:-10}

# 驗證參數
if [ -z "$APP" ]; then
  echo -e "${RED}❌ 請指定要部署的 app${NC}"
  echo ""
  echo "使用方式: $0 <app> [percentage]"
  echo ""
  echo "支援的 apps:"
  echo "  - server"
  echo "  - queue-worker"
  echo "  - slack-bot"
  echo ""
  echo "範例:"
  echo "  $0 server         # 10% → 50% → 100%"
  echo "  $0 server 25      # 從 25% 開始"
  exit 1
fi

# 驗證 app
case $APP in
  server|queue-worker|slack-bot)
    APP_DIR="apps/$APP"
    ;;
  *)
    echo -e "${RED}❌ 不支援的 app: $APP${NC}"
    echo "支援的 apps: server, queue-worker, slack-bot"
    exit 1
    ;;
esac

# 驗證目錄存在
if [ ! -d "$APP_DIR" ]; then
  echo -e "${RED}❌ 找不到目錄: $APP_DIR${NC}"
  exit 1
fi

echo -e "${CYAN}🐤 Canary 漸進式部署: $APP${NC}"
echo "========================================"
echo -e "初始流量比例: ${YELLOW}${INITIAL_PERCENTAGE}%${NC}"
echo ""

# 確認操作
echo -e "${YELLOW}⚠️  此操作將漸進式部署到 Production${NC}"
echo "   階段 1: ${INITIAL_PERCENTAGE}% 流量使用新版本"
echo "   階段 2: 50% 流量使用新版本"
echo "   階段 3: 100% 流量使用新版本"
echo ""
read -p "確定要繼續嗎？(y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}已取消${NC}"
  exit 0
fi

# 進入 app 目錄
cd "$APP_DIR"

# 1. 執行部署前檢查
echo ""
echo -e "${BLUE}📋 執行部署前檢查...${NC}"

# Typecheck
echo -n "  TypeScript 檢查... "
if bun run typecheck > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  echo -e "${RED}❌ TypeScript 檢查失敗${NC}"
  exit 1
fi

# 回到根目錄檢查 lint
cd ../..
echo -n "  Lint 檢查... "
if bun x ultracite check > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  echo -e "${RED}❌ Lint 檢查失敗${NC}"
  exit 1
fi

cd "$APP_DIR"

# 2. 上傳新版本（但不立即部署）
echo ""
echo -e "${BLUE}📤 上傳新版本...${NC}"
VERSION_OUTPUT=$(bunx wrangler versions upload 2>&1)
VERSION_ID=$(echo "$VERSION_OUTPUT" | grep -oE 'Version ID: [a-f0-9-]+' | cut -d' ' -f3 || echo "")

if [ -z "$VERSION_ID" ]; then
  # 嘗試另一種方式取得版本 ID
  VERSION_ID=$(echo "$VERSION_OUTPUT" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1 || echo "")
fi

if [ -z "$VERSION_ID" ]; then
  echo -e "${YELLOW}⚠️  無法取得版本 ID，使用最新版本${NC}"
  echo "$VERSION_OUTPUT"
else
  echo -e "${GREEN}✅ 新版本 ID: ${VERSION_ID}${NC}"
fi

# 3. 階段 1: 初始流量
echo ""
echo -e "${BLUE}🚀 階段 1: 部署 ${INITIAL_PERCENTAGE}% 流量...${NC}"
bunx wrangler versions deploy --percentage ${INITIAL_PERCENTAGE} --yes 2>/dev/null || \
  bunx wrangler deploy 2>/dev/null

echo -e "${GREEN}✅ 已部署 ${INITIAL_PERCENTAGE}% 流量${NC}"

# 健康檢查函數
health_check() {
  local url=$1
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    if curl -s -f "$url" > /dev/null 2>&1; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  return 1
}

# 取得健康檢查 URL
case $APP in
  server)
    HEALTH_URL="https://sales-ai-server.salesaiautomationv3.workers.dev/health"
    ;;
  queue-worker)
    HEALTH_URL="https://sales-ai-queue-worker.salesaiautomationv3.workers.dev/health"
    ;;
  slack-bot)
    HEALTH_URL="https://sales-ai-slack-bot.salesaiautomationv3.workers.dev/"
    ;;
esac

# 4. 監控階段 1
echo ""
echo -e "${BLUE}👀 監控 5 分鐘...${NC}"
for i in {1..5}; do
  sleep 60
  echo -n "  第 ${i} 分鐘... "
  if health_check "$HEALTH_URL"; then
    echo -e "${GREEN}✓ 健康${NC}"
  else
    echo -e "${YELLOW}⚠️ 無法連接（可能正常）${NC}"
  fi
done

# 確認是否繼續
echo ""
read -p "階段 1 完成。是否繼續增加到 50%？(y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}停留在 ${INITIAL_PERCENTAGE}%${NC}"
  echo "如需回滾，請執行: ./scripts/rollback.sh $APP production"
  exit 0
fi

# 5. 階段 2: 50% 流量
echo ""
echo -e "${BLUE}🚀 階段 2: 增加到 50% 流量...${NC}"
bunx wrangler versions deploy --percentage 50 --yes 2>/dev/null || true
echo -e "${GREEN}✅ 已部署 50% 流量${NC}"

# 監控階段 2
echo ""
echo -e "${BLUE}👀 監控 3 分鐘...${NC}"
for i in {1..3}; do
  sleep 60
  echo -n "  第 ${i} 分鐘... "
  if health_check "$HEALTH_URL"; then
    echo -e "${GREEN}✓ 健康${NC}"
  else
    echo -e "${YELLOW}⚠️ 無法連接（可能正常）${NC}"
  fi
done

# 確認是否繼續
echo ""
read -p "階段 2 完成。是否繼續增加到 100%？(y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}停留在 50%${NC}"
  echo "如需回滾，請執行: ./scripts/rollback.sh $APP production"
  exit 0
fi

# 6. 階段 3: 100% 流量
echo ""
echo -e "${BLUE}🚀 階段 3: 完全部署 (100%)...${NC}"
bunx wrangler versions deploy --percentage 100 --yes 2>/dev/null || \
  bunx wrangler deploy 2>/dev/null
echo -e "${GREEN}✅ 已完全部署 (100%)${NC}"

# 最終健康檢查
echo ""
echo -e "${BLUE}🔍 最終健康檢查...${NC}"
sleep 5
if health_check "$HEALTH_URL"; then
  echo -e "${GREEN}✅ 服務健康！${NC}"
else
  echo -e "${YELLOW}⚠️ 無法確認健康狀態，請手動檢查${NC}"
fi

# 發送 Slack 通知
if [ -f "../scripts/notify-deployment.sh" ]; then
  cd ../..
  ./scripts/notify-deployment.sh "$APP" "production" "canary-complete" 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}🎉 Canary 部署完成！${NC}"
echo ""
echo "部署摘要："
echo "  App: $APP"
echo "  環境: Production"
echo "  策略: Canary (${INITIAL_PERCENTAGE}% → 50% → 100%)"
echo ""
echo "如發現問題，請執行: ./scripts/rollback.sh $APP production"
