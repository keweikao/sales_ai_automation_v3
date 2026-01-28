#!/bin/bash
# =============================================================================
# 快速回滾腳本
# 用法: ./scripts/rollback.sh [app] [environment]
# 範例: ./scripts/rollback.sh server production
# =============================================================================

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}  $1${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# 函數：取得 Worker 名稱
get_worker_name() {
    local APP=$1
    local ENV=$2

    case $APP in
        server)
            if [[ "$ENV" == "staging" ]]; then
                echo "sales-ai-server-staging"
            else
                echo "sales-ai-server"
            fi
            ;;
        queue-worker)
            if [[ "$ENV" == "staging" ]]; then
                echo "sales-ai-queue-worker-staging"
            else
                echo "sales-ai-queue-worker"
            fi
            ;;
        slack-bot)
            if [[ "$ENV" == "staging" ]]; then
                echo "sales-ai-slack-bot-preview"
            else
                echo "sales-ai-slack-bot"
            fi
            ;;
        *)
            echo ""
            ;;
    esac
}

# 函數：回滾 Cloudflare Worker
rollback_worker() {
    local APP=$1
    local ENV=$2
    local WORKER_NAME=$(get_worker_name "$APP" "$ENV")

    if [[ -z "$WORKER_NAME" ]]; then
        print_error "未知的 app: $APP"
        exit 1
    fi

    print_header "回滾 $WORKER_NAME"

    echo "查詢可用版本..."
    bunx wrangler deployments list --name "$WORKER_NAME" 2>/dev/null | head -20 || echo "(無法取得部署列表)"

    echo ""
    read -p "確定要回滾到上一個版本嗎？[y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "回滾已取消"
        exit 0
    fi

    echo "正在回滾..."
    bunx wrangler rollback --name "$WORKER_NAME"

    print_success "$WORKER_NAME 已回滾到上一個版本"
}

# 函數：回滾所有服務
rollback_all() {
    local ENV=$1

    print_header "回滾所有服務 ($ENV)"

    echo -e "${RED}⚠️  警告：即將回滾所有服務！${NC}"
    read -p "確定要繼續嗎？輸入 'rollback' 確認: " CONFIRM
    if [[ "$CONFIRM" != "rollback" ]]; then
        print_warning "回滾已取消"
        exit 0
    fi

    for APP in server queue-worker slack-bot; do
        local WORKER_NAME=$(get_worker_name "$APP" "$ENV")
        echo ""
        echo "回滾 $WORKER_NAME..."
        bunx wrangler rollback --name "$WORKER_NAME" 2>/dev/null || print_warning "無法回滾 $WORKER_NAME"
    done

    print_success "所有服務已回滾"
}

# 函數：顯示使用說明
show_usage() {
    echo "快速回滾腳本"
    echo ""
    echo "用法: ./scripts/rollback.sh [app] [environment]"
    echo ""
    echo "App 選項:"
    echo "  server        回滾 Server"
    echo "  queue-worker  回滾 Queue Worker"
    echo "  slack-bot     回滾 Slack Bot"
    echo "  all           回滾所有服務"
    echo ""
    echo "Environment 選項:"
    echo "  staging       回滾 Staging 環境"
    echo "  production    回滾 Production 環境 (預設)"
    echo ""
    echo "範例:"
    echo "  ./scripts/rollback.sh server                # 回滾 server production"
    echo "  ./scripts/rollback.sh server staging        # 回滾 server staging"
    echo "  ./scripts/rollback.sh all production        # 回滾所有 production 服務"
}

# 主程式
main() {
    APP=${1:-""}
    ENV=${2:-"production"}

    if [[ -z "$APP" || "$APP" == "-h" || "$APP" == "--help" ]]; then
        show_usage
        exit 0
    fi

    print_header "Sales AI Automation - 緊急回滾"
    echo "目標: $APP ($ENV)"
    echo "時間: $(date '+%Y-%m-%d %H:%M:%S')"

    if [[ "$APP" == "all" ]]; then
        rollback_all "$ENV"
    else
        rollback_worker "$APP" "$ENV"
    fi

    echo ""
    print_warning "回滾完成！請立即驗證服務狀態"
    echo ""
    echo "驗證 URL:"
    if [[ "$ENV" == "staging" ]]; then
        echo -e "  Server: ${BLUE}https://sales-ai-server-staging.salesaiautomationv3.workers.dev/health${NC}"
        echo -e "  Web:    ${BLUE}https://staging.sales-ai-web.pages.dev${NC}"
    else
        echo -e "  Server: ${BLUE}https://sales-ai-server.salesaiautomationv3.workers.dev/health${NC}"
        echo -e "  Web:    ${BLUE}https://sales-ai-web.pages.dev${NC}"
    fi
    echo ""
    echo "後續步驟："
    echo "  1. 監控服務狀態 5-10 分鐘"
    echo "  2. 檢查 Cloudflare Dashboard 錯誤日誌"
    echo "  3. 通知團隊成員"
    echo "  4. 分析回滾原因並修復"
}

main "$@"
