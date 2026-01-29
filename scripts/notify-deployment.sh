#!/bin/bash
# =============================================================================
# 部署通知腳本
# 用法: ./scripts/notify-deployment.sh [type] [app] [environment] [status] [message]
# 範例: ./scripts/notify-deployment.sh deploy server production success ""
#       ./scripts/notify-deployment.sh rollback server production warning "API 錯誤率異常"
# =============================================================================

# 顏色定義（用於本地輸出）
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 環境變數（必須設定）
# SLACK_WEBHOOK_URL - Slack Webhook URL
# SLACK_WEBHOOK_URL_ALERTS - 警報專用 Webhook（可選，預設使用 SLACK_WEBHOOK_URL）

# 函數：打印本地訊息
print_info() {
    echo -e "${BLUE}[通知] $1${NC}"
}

print_success() {
    echo -e "${GREEN}[通知] $1${NC}"
}

print_error() {
    echo -e "${RED}[通知] $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[通知] $1${NC}"
}

# 函數：取得當前時間
get_timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

# 函數：取得部署者名稱
get_deployer() {
    git config user.name 2>/dev/null || echo "${USER:-Unknown}"
}

# 函數：取得環境 URL
get_environment_url() {
    local APP=$1
    local ENV=$2

    case $APP in
        server)
            if [[ "$ENV" == "staging" ]]; then
                echo "https://sales-ai-server-staging.salesaiautomationv3.workers.dev"
            else
                echo "https://sales-ai-server.salesaiautomationv3.workers.dev"
            fi
            ;;
        web)
            if [[ "$ENV" == "staging" ]]; then
                echo "https://staging.sales-ai-web.pages.dev"
            else
                echo "https://sales-ai-web.pages.dev"
            fi
            ;;
        queue-worker)
            echo "(Queue Worker - 無公開 URL)"
            ;;
        slack-bot)
            echo "(Slack Bot - 無公開 URL)"
            ;;
        *)
            echo "(未知服務)"
            ;;
    esac
}

# 函數：取得狀態 Emoji
get_status_emoji() {
    local STATUS=$1
    case $STATUS in
        success)
            echo ":white_check_mark:"
            ;;
        failure|failed|error)
            echo ":x:"
            ;;
        warning)
            echo ":warning:"
            ;;
        rollback)
            echo ":rotating_light:"
            ;;
        health_ok)
            echo ":heartbeat:"
            ;;
        health_fail)
            echo ":broken_heart:"
            ;;
        *)
            echo ":information_source:"
            ;;
    esac
}

# 函數：取得環境顏色（Slack attachment color）
get_status_color() {
    local STATUS=$1
    case $STATUS in
        success|health_ok)
            echo "good"
            ;;
        failure|failed|error|health_fail)
            echo "danger"
            ;;
        warning|rollback)
            echo "warning"
            ;;
        *)
            echo "#439FE0"
            ;;
    esac
}

# 函數：發送部署通知
send_deploy_notification() {
    local APP=$1
    local ENV=$2
    local STATUS=$3
    local MESSAGE=$4

    local TIMESTAMP=$(get_timestamp)
    local DEPLOYER=$(get_deployer)
    local URL=$(get_environment_url "$APP" "$ENV")
    local EMOJI=$(get_status_emoji "$STATUS")
    local COLOR=$(get_status_color "$STATUS")

    # 根據狀態決定標題文字
    local STATUS_TEXT=""
    case $STATUS in
        success)
            STATUS_TEXT="部署成功"
            ;;
        failure|failed|error)
            STATUS_TEXT="部署失敗"
            ;;
        warning)
            STATUS_TEXT="部署警告"
            ;;
        *)
            STATUS_TEXT="部署狀態更新"
            ;;
    esac

    # 環境標籤（大寫）
    local ENV_LABEL=$(echo "$ENV" | tr '[:lower:]' '[:upper:]')

    # 構建 Slack 訊息 (使用 Blocks 格式)
    local PAYLOAD=$(cat <<EOF
{
    "attachments": [
        {
            "color": "${COLOR}",
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": "${EMOJI} [${ENV_LABEL}] ${APP} ${STATUS_TEXT}",
                        "emoji": true
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": "*服務:*\n${APP}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*環境:*\n${ENV_LABEL}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*時間:*\n${TIMESTAMP}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*部署者:*\n${DEPLOYER}"
                        }
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*URL:* ${URL}"
                    }
                }
            ]
        }
    ]
}
EOF
)

    # 如果有額外訊息，加入
    if [[ -n "$MESSAGE" ]]; then
        PAYLOAD=$(cat <<EOF
{
    "attachments": [
        {
            "color": "${COLOR}",
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": "${EMOJI} [${ENV_LABEL}] ${APP} ${STATUS_TEXT}",
                        "emoji": true
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": "*服務:*\n${APP}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*環境:*\n${ENV_LABEL}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*時間:*\n${TIMESTAMP}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*部署者:*\n${DEPLOYER}"
                        }
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*URL:* ${URL}"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*備註:* ${MESSAGE}"
                    }
                }
            ]
        }
    ]
}
EOF
)
    fi

    send_to_slack "$PAYLOAD"
}

# 函數：發送回滾通知
send_rollback_notification() {
    local APP=$1
    local ENV=$2
    local REASON=$3

    local TIMESTAMP=$(get_timestamp)
    local DEPLOYER=$(get_deployer)
    local URL=$(get_environment_url "$APP" "$ENV")
    local ENV_LABEL=$(echo "$ENV" | tr '[:lower:]' '[:upper:]')

    local PAYLOAD=$(cat <<EOF
{
    "attachments": [
        {
            "color": "danger",
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": ":rotating_light: [${ENV_LABEL}] ${APP} 緊急回滾",
                        "emoji": true
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": "*服務:*\n${APP}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*環境:*\n${ENV_LABEL}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*時間:*\n${TIMESTAMP}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*執行者:*\n${DEPLOYER}"
                        }
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*原因:* ${REASON:-未提供}"
                    }
                },
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": ":warning: 請立即確認服務狀態並調查回滾原因"
                        }
                    ]
                }
            ]
        }
    ]
}
EOF
)

    # 回滾通知使用警報 Webhook（如果有設定）
    send_to_slack "$PAYLOAD" "alert"
}

# 函數：發送健康檢查通知
send_health_notification() {
    local ENV=$1
    local STATUS=$2
    local DETAILS=$3

    local TIMESTAMP=$(get_timestamp)
    local ENV_LABEL=$(echo "$ENV" | tr '[:lower:]' '[:upper:]')
    local EMOJI=$(get_status_emoji "$STATUS")
    local COLOR=$(get_status_color "$STATUS")

    local STATUS_TEXT=""
    case $STATUS in
        health_ok)
            STATUS_TEXT="健康檢查通過"
            ;;
        health_fail)
            STATUS_TEXT="健康檢查失敗"
            ;;
        *)
            STATUS_TEXT="健康檢查結果"
            ;;
    esac

    local PAYLOAD=$(cat <<EOF
{
    "attachments": [
        {
            "color": "${COLOR}",
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": "${EMOJI} [${ENV_LABEL}] ${STATUS_TEXT}",
                        "emoji": true
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": "*環境:*\n${ENV_LABEL}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*時間:*\n${TIMESTAMP}"
                        }
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*詳細資訊:*\n\`\`\`${DETAILS}\`\`\`"
                    }
                }
            ]
        }
    ]
}
EOF
)

    # 健康檢查失敗使用警報 Webhook
    if [[ "$STATUS" == "health_fail" ]]; then
        send_to_slack "$PAYLOAD" "alert"
    else
        send_to_slack "$PAYLOAD"
    fi
}

# 函數：發送到 Slack
send_to_slack() {
    local PAYLOAD=$1
    local TYPE=${2:-"normal"}  # normal 或 alert

    # 選擇 Webhook URL
    local WEBHOOK_URL=""
    if [[ "$TYPE" == "alert" && -n "$SLACK_WEBHOOK_URL_ALERTS" ]]; then
        WEBHOOK_URL="$SLACK_WEBHOOK_URL_ALERTS"
    elif [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        WEBHOOK_URL="$SLACK_WEBHOOK_URL"
    fi

    # 檢查 Webhook URL
    if [[ -z "$WEBHOOK_URL" ]]; then
        print_warning "SLACK_WEBHOOK_URL 未設定，跳過 Slack 通知"
        print_info "請設定環境變數 SLACK_WEBHOOK_URL"
        return 0
    fi

    # 發送請求
    print_info "發送 Slack 通知..."

    local RESPONSE
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD" \
        "$WEBHOOK_URL" 2>/dev/null)

    if [[ "$RESPONSE" == "200" ]]; then
        print_success "Slack 通知發送成功"
        return 0
    else
        print_error "Slack 通知發送失敗 (HTTP $RESPONSE)"
        return 1
    fi
}

# 函數：顯示使用說明
show_usage() {
    echo "部署通知腳本"
    echo ""
    echo "用法:"
    echo "  ./scripts/notify-deployment.sh deploy [app] [env] [status] [message]"
    echo "  ./scripts/notify-deployment.sh rollback [app] [env] [reason]"
    echo "  ./scripts/notify-deployment.sh health [env] [status] [details]"
    echo ""
    echo "通知類型:"
    echo "  deploy      部署通知"
    echo "  rollback    回滾通知（緊急）"
    echo "  health      健康檢查通知"
    echo ""
    echo "狀態選項 (deploy):"
    echo "  success     部署成功"
    echo "  failure     部署失敗"
    echo "  warning     部署警告"
    echo ""
    echo "狀態選項 (health):"
    echo "  health_ok   健康檢查通過"
    echo "  health_fail 健康檢查失敗"
    echo ""
    echo "環境變數:"
    echo "  SLACK_WEBHOOK_URL        主要 Webhook URL（必須）"
    echo "  SLACK_WEBHOOK_URL_ALERTS 警報專用 Webhook URL（可選）"
    echo ""
    echo "範例:"
    echo "  ./scripts/notify-deployment.sh deploy server production success"
    echo "  ./scripts/notify-deployment.sh deploy web staging failure \"Build 失敗\""
    echo "  ./scripts/notify-deployment.sh rollback server production \"API 錯誤率異常\""
    echo "  ./scripts/notify-deployment.sh health production health_fail \"Server: DOWN\""
}

# 主程式
main() {
    local TYPE=${1:-""}

    if [[ -z "$TYPE" || "$TYPE" == "-h" || "$TYPE" == "--help" ]]; then
        show_usage
        exit 0
    fi

    case $TYPE in
        deploy)
            local APP=${2:-"unknown"}
            local ENV=${3:-"production"}
            local STATUS=${4:-"success"}
            local MESSAGE=${5:-""}
            send_deploy_notification "$APP" "$ENV" "$STATUS" "$MESSAGE"
            ;;
        rollback)
            local APP=${2:-"unknown"}
            local ENV=${3:-"production"}
            local REASON=${4:-""}
            send_rollback_notification "$APP" "$ENV" "$REASON"
            ;;
        health)
            local ENV=${2:-"production"}
            local STATUS=${3:-"health_ok"}
            local DETAILS=${4:-""}
            send_health_notification "$ENV" "$STATUS" "$DETAILS"
            ;;
        *)
            print_error "未知的通知類型: $TYPE"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
