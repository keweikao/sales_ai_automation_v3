#!/bin/bash
# =============================================================================
# Staging 環境部署腳本
# 用法: ./scripts/deploy-staging.sh [app]
# 範例: ./scripts/deploy-staging.sh server
#       ./scripts/deploy-staging.sh all
# =============================================================================

set -e

# 取得腳本所在目錄
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 函數：打印標題
print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# 函數：打印成功訊息
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 函數：打印警告訊息
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# 函數：打印錯誤訊息
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# 函數：檢查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 未安裝，請先安裝"
        exit 1
    fi
}

# 函數：發送部署通知
send_notification() {
    local APP=$1
    local STATUS=$2
    local MESSAGE=${3:-""}

    if [[ -f "$SCRIPT_DIR/notify-deployment.sh" ]]; then
        bash "$SCRIPT_DIR/notify-deployment.sh" deploy "$APP" staging "$STATUS" "$MESSAGE" || true
    fi
}

# 函數：處理部署失敗
handle_deploy_failure() {
    local APP=$1
    local ERROR_MSG=${2:-"部署過程中發生錯誤"}
    print_error "$APP 部署失敗: $ERROR_MSG"
    send_notification "$APP" "failure" "$ERROR_MSG"
    exit 1
}

# 函數：執行部署前檢查
pre_deploy_checks() {
    print_header "執行部署前檢查"

    # 1. 檢查是否有未提交的變更
    if [[ -n $(git status --porcelain) ]]; then
        print_error "有未提交的變更！請先提交或 stash"
        git status --short
        exit 1
    fi
    print_success "Git 狀態乾淨"

    # 2. 類型檢查
    echo ""
    echo "執行類型檢查..."
    if ! bun run typecheck; then
        print_error "類型檢查失敗！"
        exit 1
    fi
    print_success "類型檢查通過"

    # 3. 程式碼品質檢查
    echo ""
    echo "執行程式碼品質檢查..."
    if ! bun x ultracite check; then
        print_error "程式碼品質檢查失敗！"
        exit 1
    fi
    print_success "程式碼品質檢查通過"
}

# 函數：部署 Server 到 Staging
deploy_server() {
    print_header "部署 Server 到 Staging"
    cd "$PROJECT_ROOT/apps/server"
    if bunx wrangler deploy --env staging; then
        cd "$PROJECT_ROOT"
        print_success "Server 部署完成"
        echo -e "  URL: ${BLUE}https://sales-ai-server-staging.salesaiautomationv3.workers.dev${NC}"
        send_notification "server" "success"
    else
        cd "$PROJECT_ROOT"
        handle_deploy_failure "server" "Wrangler 部署命令失敗"
    fi
}

# 函數：部署 Queue Worker 到 Staging
deploy_queue_worker() {
    print_header "部署 Queue Worker 到 Staging"
    cd "$PROJECT_ROOT/apps/queue-worker"
    if bunx wrangler deploy --env staging; then
        cd "$PROJECT_ROOT"
        print_success "Queue Worker 部署完成"
        send_notification "queue-worker" "success"
    else
        cd "$PROJECT_ROOT"
        handle_deploy_failure "queue-worker" "Wrangler 部署命令失敗"
    fi
}

# 函數：部署 Web 到 Staging
deploy_web() {
    print_header "部署 Web 到 Staging"
    cd "$PROJECT_ROOT/apps/web"

    # 使用 staging 環境變數建置
    echo "使用 .env.staging 建置..."
    if ! VITE_SERVER_URL=https://sales-ai-server-staging.salesaiautomationv3.workers.dev bun run build; then
        cd "$PROJECT_ROOT"
        handle_deploy_failure "web" "Build 失敗"
    fi

    # 部署到 Cloudflare Pages (staging branch)
    if bunx wrangler pages deploy dist --project-name=sales-ai-web --branch=staging; then
        cd "$PROJECT_ROOT"
        print_success "Web 部署完成"
        echo -e "  URL: ${BLUE}https://staging.sales-ai-web.pages.dev${NC}"
        send_notification "web" "success"
    else
        cd "$PROJECT_ROOT"
        handle_deploy_failure "web" "Wrangler Pages 部署失敗"
    fi
}

# 函數：顯示使用說明
show_usage() {
    echo "Staging 環境部署腳本"
    echo ""
    echo "用法: ./scripts/deploy-staging.sh [選項]"
    echo ""
    echo "選項:"
    echo "  server        只部署 Server"
    echo "  queue-worker  只部署 Queue Worker"
    echo "  web           只部署 Web 前端"
    echo "  all           部署所有服務"
    echo "  --skip-checks 跳過部署前檢查（不建議）"
    echo "  -h, --help    顯示此說明"
    echo ""
    echo "範例:"
    echo "  ./scripts/deploy-staging.sh server"
    echo "  ./scripts/deploy-staging.sh all"
}

# 主程式
main() {
    # 檢查必要命令
    check_command "bun"
    check_command "git"

    # 解析參數
    SKIP_CHECKS=false
    APP=""

    for arg in "$@"; do
        case $arg in
            --skip-checks)
                SKIP_CHECKS=true
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                APP=$arg
                ;;
        esac
    done

    # 如果沒有指定 app，顯示使用說明
    if [[ -z "$APP" ]]; then
        show_usage
        exit 1
    fi

    print_header "Sales AI Automation - Staging 部署"
    echo "目標: $APP"
    echo "時間: $(date '+%Y-%m-%d %H:%M:%S')"

    # 執行部署前檢查（除非跳過）
    if [[ "$SKIP_CHECKS" == false ]]; then
        pre_deploy_checks
    else
        print_warning "跳過部署前檢查（--skip-checks）"
    fi

    # 根據參數執行部署
    case $APP in
        server)
            deploy_server
            ;;
        queue-worker)
            deploy_queue_worker
            ;;
        web)
            deploy_web
            ;;
        all)
            deploy_server
            deploy_queue_worker
            deploy_web
            ;;
        *)
            print_error "未知的選項: $APP"
            show_usage
            exit 1
            ;;
    esac

    print_header "部署完成"
    echo ""
    echo "Staging 環境 URL:"
    echo -e "  Server:  ${BLUE}https://sales-ai-server-staging.salesaiautomationv3.workers.dev${NC}"
    echo -e "  Web:     ${BLUE}https://staging.sales-ai-web.pages.dev${NC}"
    echo ""
    print_warning "請在 Staging 環境驗證功能後，再部署到 Production"
}

main "$@"
