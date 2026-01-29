#!/bin/bash
# =============================================================================
# Production 環境部署腳本 (安全版)
# 用法: ./scripts/deploy-production.sh [app]
# 範例: ./scripts/deploy-production.sh server
#       ./scripts/deploy-production.sh all
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
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# 函數：打印標題
print_header() {
    echo ""
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}  $1${NC}"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
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
        bash "$SCRIPT_DIR/notify-deployment.sh" deploy "$APP" production "$STATUS" "$MESSAGE" || true
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
    print_header "執行 Production 部署前檢查"

    # 1. 檢查是否有未提交的變更
    if [[ -n $(git status --porcelain) ]]; then
        print_error "有未提交的變更！請先提交或 stash"
        git status --short
        exit 1
    fi
    print_success "Git 狀態乾淨"

    # 2. 檢查是否在正確的分支
    CURRENT_BRANCH=$(git branch --show-current)
    if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "master" ]]; then
        print_warning "目前不在 main/master 分支 (當前: $CURRENT_BRANCH)"
        read -p "確定要從非主分支部署嗎？[y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "部署已取消"
            exit 1
        fi
    fi
    print_success "分支檢查通過 ($CURRENT_BRANCH)"

    # 3. 類型檢查
    echo ""
    echo "執行類型檢查..."
    if ! bun run typecheck; then
        print_error "類型檢查失敗！"
        exit 1
    fi
    print_success "類型檢查通過"

    # 4. 程式碼品質檢查
    echo ""
    echo "執行程式碼品質檢查..."
    if ! bun x ultracite check; then
        print_error "程式碼品質檢查失敗！"
        exit 1
    fi
    print_success "程式碼品質檢查通過"

    # 5. 執行測試
    echo ""
    echo "執行測試..."
    if ! bun run test; then
        print_warning "測試未完全通過，請確認是否繼續"
        read -p "確定要繼續部署嗎？[y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "部署已取消"
            exit 1
        fi
    else
        print_success "測試通過"
    fi
}

# 函數：確認部署
confirm_production_deploy() {
    print_header "Production 部署確認"

    echo -e "${RED}⚠️  警告：你即將部署到 PRODUCTION 環境！${NC}"
    echo ""
    echo "這會直接影響所有用戶。請確認："
    echo "  1. 已在 Staging 環境驗證過功能"
    echo "  2. 所有測試都通過"
    echo "  3. 已通知相關團隊成員"
    echo ""

    read -p "輸入 'deploy' 確認部署到 Production: " CONFIRM
    if [[ "$CONFIRM" != "deploy" ]]; then
        print_error "部署已取消"
        exit 1
    fi
}

# 函數：部署 Server 到 Production
deploy_server() {
    print_header "部署 Server 到 Production"
    cd "$PROJECT_ROOT/apps/server"
    if bunx wrangler deploy; then
        cd "$PROJECT_ROOT"
        print_success "Server 部署完成"
        echo -e "  URL: ${BLUE}https://sales-ai-server.salesaiautomationv3.workers.dev${NC}"
        send_notification "server" "success"
    else
        cd "$PROJECT_ROOT"
        handle_deploy_failure "server" "Wrangler 部署命令失敗"
    fi
}

# 函數：部署 Queue Worker 到 Production
deploy_queue_worker() {
    print_header "部署 Queue Worker 到 Production"
    cd "$PROJECT_ROOT/apps/queue-worker"
    if bunx wrangler deploy; then
        cd "$PROJECT_ROOT"
        print_success "Queue Worker 部署完成"
        send_notification "queue-worker" "success"
    else
        cd "$PROJECT_ROOT"
        handle_deploy_failure "queue-worker" "Wrangler 部署命令失敗"
    fi
}

# 函數：部署 Web 到 Production
deploy_web() {
    print_header "部署 Web 到 Production"
    cd "$PROJECT_ROOT/apps/web"

    # 檢查 .env.production 是否存在
    if [[ ! -f ".env.production" ]]; then
        print_error ".env.production 不存在！"
        echo "請建立 apps/web/.env.production 並設定："
        echo "  VITE_SERVER_URL=https://sales-ai-server.salesaiautomationv3.workers.dev"
        cd "$PROJECT_ROOT"
        handle_deploy_failure "web" ".env.production 檔案缺失"
    fi

    # 使用 production 環境變數建置
    echo "使用 .env.production 建置..."
    if ! bun run build; then
        cd "$PROJECT_ROOT"
        handle_deploy_failure "web" "Build 失敗"
    fi

    # 部署到 Cloudflare Pages (main branch)
    if bunx wrangler pages deploy dist --project-name=sales-ai-web --branch=main; then
        cd "$PROJECT_ROOT"
        print_success "Web 部署完成"
        echo -e "  URL: ${BLUE}https://sales-ai-web.pages.dev${NC}"
        send_notification "web" "success"
    else
        cd "$PROJECT_ROOT"
        handle_deploy_failure "web" "Wrangler Pages 部署失敗"
    fi
}

# 函數：部署後健康檢查
post_deploy_health_check() {
    print_header "執行部署後健康檢查"

    echo "檢查 Server API..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://sales-ai-server.salesaiautomationv3.workers.dev/health 2>/dev/null || echo "000")
    if [[ "$HTTP_CODE" == "200" ]]; then
        print_success "Server API 正常 (HTTP $HTTP_CODE)"
    else
        print_warning "Server API 回應異常 (HTTP $HTTP_CODE)"
    fi

    echo "檢查 Web 前端..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://sales-ai-web.pages.dev 2>/dev/null || echo "000")
    if [[ "$HTTP_CODE" == "200" ]]; then
        print_success "Web 前端正常 (HTTP $HTTP_CODE)"
    else
        print_warning "Web 前端回應異常 (HTTP $HTTP_CODE)"
    fi
}

# 函數：顯示使用說明
show_usage() {
    echo "Production 環境部署腳本 (安全版)"
    echo ""
    echo "用法: ./scripts/deploy-production.sh [選項]"
    echo ""
    echo "選項:"
    echo "  server        只部署 Server"
    echo "  queue-worker  只部署 Queue Worker"
    echo "  web           只部署 Web 前端"
    echo "  all           部署所有服務"
    echo "  -h, --help    顯示此說明"
    echo ""
    echo "注意: 此腳本會執行完整的部署前檢查，並要求確認"
    echo ""
    echo "範例:"
    echo "  ./scripts/deploy-production.sh server"
    echo "  ./scripts/deploy-production.sh all"
}

# 主程式
main() {
    # 檢查必要命令
    check_command "bun"
    check_command "git"
    check_command "curl"

    # 解析參數
    APP=""

    for arg in "$@"; do
        case $arg in
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

    print_header "Sales AI Automation - Production 部署"
    echo "目標: $APP"
    echo "時間: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "部署者: $(git config user.name 2>/dev/null || echo 'Unknown')"

    # 執行部署前檢查
    pre_deploy_checks

    # 確認部署
    confirm_production_deploy

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

    # 部署後健康檢查
    post_deploy_health_check

    print_header "Production 部署完成"
    echo ""
    echo "Production 環境 URL:"
    echo -e "  Server:  ${BLUE}https://sales-ai-server.salesaiautomationv3.workers.dev${NC}"
    echo -e "  Web:     ${BLUE}https://sales-ai-web.pages.dev${NC}"
    echo ""
    print_warning "請持續監控服務狀態 5-10 分鐘"
    echo ""
    echo "如需回滾，執行: ./scripts/rollback.sh [app]"
}

main "$@"
