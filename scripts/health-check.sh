#!/bin/bash
# =============================================================================
# 健康檢查腳本
# 用法: ./scripts/health-check.sh [environment] [options]
# 範例: ./scripts/health-check.sh production
#       ./scripts/health-check.sh staging --notify
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
NC='\033[0m'

# 配置
TIMEOUT=10  # 請求超時秒數
RETRY_COUNT=3  # 重試次數
RETRY_DELAY=2  # 重試間隔秒數

# 環境 URL 配置
declare -A PRODUCTION_URLS=(
    ["server"]="https://sales-ai-server.salesaiautomationv3.workers.dev"
    ["web"]="https://sales-ai-web.pages.dev"
)

declare -A STAGING_URLS=(
    ["server"]="https://sales-ai-server-staging.salesaiautomationv3.workers.dev"
    ["web"]="https://staging.sales-ai-web.pages.dev"
)

# 函數：打印訊息
print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
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

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# 函數：檢查單個服務
check_service() {
    local SERVICE_NAME=$1
    local URL=$2
    local ENDPOINT=${3:-""}
    local FULL_URL="${URL}${ENDPOINT}"

    echo ""
    echo "檢查 $SERVICE_NAME..."
    echo "  URL: $FULL_URL"

    local ATTEMPT=1
    local HTTP_CODE=""
    local RESPONSE_TIME=""

    while [[ $ATTEMPT -le $RETRY_COUNT ]]; do
        # 執行健康檢查請求
        local START_TIME=$(date +%s%N)
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
            --connect-timeout $TIMEOUT \
            --max-time $TIMEOUT \
            "$FULL_URL" 2>/dev/null || echo "000")
        local END_TIME=$(date +%s%N)

        # 計算回應時間（毫秒）
        RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

        if [[ "$HTTP_CODE" == "200" ]]; then
            break
        fi

        if [[ $ATTEMPT -lt $RETRY_COUNT ]]; then
            echo "  嘗試 $ATTEMPT 失敗 (HTTP $HTTP_CODE)，${RETRY_DELAY} 秒後重試..."
            sleep $RETRY_DELAY
        fi

        ((ATTEMPT++))
    done

    # 判斷結果
    if [[ "$HTTP_CODE" == "200" ]]; then
        print_success "$SERVICE_NAME: 正常 (HTTP $HTTP_CODE, ${RESPONSE_TIME}ms)"
        return 0
    elif [[ "$HTTP_CODE" == "000" ]]; then
        print_error "$SERVICE_NAME: 無法連線 (連線逾時或服務不可用)"
        return 1
    else
        print_error "$SERVICE_NAME: 異常 (HTTP $HTTP_CODE)"
        return 1
    fi
}

# 函數：檢查 Server API 健康
check_server_health() {
    local URL=$1
    local HEALTH_ENDPOINT="/health"

    check_service "Server API" "$URL" "$HEALTH_ENDPOINT"
    return $?
}

# 函數：檢查 Web 前端
check_web_health() {
    local URL=$1

    check_service "Web 前端" "$URL" ""
    return $?
}

# 函數：執行完整健康檢查
run_health_check() {
    local ENV=$1
    local NOTIFY=$2

    print_header "健康檢查 - $(echo $ENV | tr '[:lower:]' '[:upper:]')"
    echo "時間: $(date '+%Y-%m-%d %H:%M:%S')"

    # 根據環境選擇 URL
    local SERVER_URL=""
    local WEB_URL=""

    if [[ "$ENV" == "staging" ]]; then
        SERVER_URL="${STAGING_URLS[server]}"
        WEB_URL="${STAGING_URLS[web]}"
    else
        SERVER_URL="${PRODUCTION_URLS[server]}"
        WEB_URL="${PRODUCTION_URLS[web]}"
    fi

    # 檢查結果
    local FAILED_SERVICES=()
    local PASSED_SERVICES=()
    local DETAILS=""

    # 檢查 Server
    if check_server_health "$SERVER_URL"; then
        PASSED_SERVICES+=("Server API")
        DETAILS="${DETAILS}Server API: OK\n"
    else
        FAILED_SERVICES+=("Server API")
        DETAILS="${DETAILS}Server API: FAILED\n"
    fi

    # 檢查 Web
    if check_web_health "$WEB_URL"; then
        PASSED_SERVICES+=("Web 前端")
        DETAILS="${DETAILS}Web 前端: OK\n"
    else
        FAILED_SERVICES+=("Web 前端")
        DETAILS="${DETAILS}Web 前端: FAILED\n"
    fi

    # 輸出摘要
    print_header "檢查結果摘要"

    echo ""
    echo "通過: ${#PASSED_SERVICES[@]} 個服務"
    for service in "${PASSED_SERVICES[@]}"; do
        print_success "  $service"
    done

    echo ""
    echo "失敗: ${#FAILED_SERVICES[@]} 個服務"
    for service in "${FAILED_SERVICES[@]}"; do
        print_error "  $service"
    done

    # 如果有失敗且需要通知
    if [[ ${#FAILED_SERVICES[@]} -gt 0 ]]; then
        echo ""
        print_error "健康檢查失敗！有 ${#FAILED_SERVICES[@]} 個服務異常"

        if [[ "$NOTIFY" == "true" ]]; then
            send_health_notification "$ENV" "health_fail" "$DETAILS"
        fi

        return 1
    else
        echo ""
        print_success "所有服務運作正常"

        if [[ "$NOTIFY" == "true" ]]; then
            send_health_notification "$ENV" "health_ok" "$DETAILS"
        fi

        return 0
    fi
}

# 函數：發送健康檢查通知
send_health_notification() {
    local ENV=$1
    local STATUS=$2
    local DETAILS=$3

    if [[ -f "$SCRIPT_DIR/notify-deployment.sh" ]]; then
        bash "$SCRIPT_DIR/notify-deployment.sh" health "$ENV" "$STATUS" "$DETAILS" || true
    fi
}

# 函數：持續監控模式
continuous_monitoring() {
    local ENV=$1
    local INTERVAL=${2:-60}  # 預設 60 秒檢查一次
    local NOTIFY=$3

    print_header "持續監控模式"
    echo "環境: $(echo $ENV | tr '[:lower:]' '[:upper:]')"
    echo "檢查間隔: ${INTERVAL} 秒"
    echo "按 Ctrl+C 停止監控"
    echo ""

    local CONSECUTIVE_FAILURES=0
    local MAX_CONSECUTIVE_FAILURES=3  # 連續失敗 3 次才發送通知

    while true; do
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "檢查時間: $(date '+%Y-%m-%d %H:%M:%S')"

        if run_health_check "$ENV" "false"; then
            CONSECUTIVE_FAILURES=0
        else
            ((CONSECUTIVE_FAILURES++))
            print_warning "連續失敗次數: $CONSECUTIVE_FAILURES"

            if [[ $CONSECUTIVE_FAILURES -ge $MAX_CONSECUTIVE_FAILURES && "$NOTIFY" == "true" ]]; then
                print_error "連續失敗 $MAX_CONSECUTIVE_FAILURES 次，發送警報"
                send_health_notification "$ENV" "health_fail" "連續 $CONSECUTIVE_FAILURES 次健康檢查失敗"
                CONSECUTIVE_FAILURES=0  # 重置計數，避免重複發送
            fi
        fi

        echo ""
        echo "下次檢查: $(date -d "+${INTERVAL} seconds" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -v+${INTERVAL}S '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "約 ${INTERVAL} 秒後")"
        sleep $INTERVAL
    done
}

# 函數：顯示使用說明
show_usage() {
    echo "健康檢查腳本"
    echo ""
    echo "用法: ./scripts/health-check.sh [environment] [options]"
    echo ""
    echo "Environment:"
    echo "  production    檢查 Production 環境 (預設)"
    echo "  staging       檢查 Staging 環境"
    echo ""
    echo "Options:"
    echo "  --notify      檢查失敗時發送 Slack 通知"
    echo "  --continuous  持續監控模式"
    echo "  --interval N  監控間隔秒數 (預設 60，僅配合 --continuous 使用)"
    echo "  -h, --help    顯示此說明"
    echo ""
    echo "環境變數:"
    echo "  SLACK_WEBHOOK_URL        Slack Webhook URL（用於發送通知）"
    echo "  SLACK_WEBHOOK_URL_ALERTS 警報專用 Webhook URL（可選）"
    echo ""
    echo "範例:"
    echo "  ./scripts/health-check.sh                         # 檢查 production"
    echo "  ./scripts/health-check.sh staging                 # 檢查 staging"
    echo "  ./scripts/health-check.sh production --notify     # 檢查並發送通知"
    echo "  ./scripts/health-check.sh production --continuous # 持續監控"
    echo "  ./scripts/health-check.sh production --continuous --interval 30 --notify"
}

# 主程式
main() {
    local ENV="production"
    local NOTIFY="false"
    local CONTINUOUS="false"
    local INTERVAL=60

    # 解析參數
    while [[ $# -gt 0 ]]; do
        case $1 in
            production|staging)
                ENV=$1
                shift
                ;;
            --notify)
                NOTIFY="true"
                shift
                ;;
            --continuous)
                CONTINUOUS="true"
                shift
                ;;
            --interval)
                INTERVAL=$2
                shift 2
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                print_error "未知的選項: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # 檢查必要命令
    if ! command -v curl &> /dev/null; then
        print_error "curl 未安裝，請先安裝"
        exit 1
    fi

    # 執行檢查
    if [[ "$CONTINUOUS" == "true" ]]; then
        continuous_monitoring "$ENV" "$INTERVAL" "$NOTIFY"
    else
        run_health_check "$ENV" "$NOTIFY"
        exit $?
    fi
}

main "$@"
