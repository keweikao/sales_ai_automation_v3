#!/bin/bash
# ============================================
# Branch Protection 設定腳本
# ============================================
#
# 此腳本使用 GitHub CLI (gh) 設定 main 分支的保護規則
# 確保所有變更都經過 CI 測試和 Code Review
#
# 使用方式：
#   ./scripts/setup-branch-protection.sh
#
# 前置條件：
#   1. 安裝 GitHub CLI: brew install gh
#   2. 登入 GitHub: gh auth login
#   3. 確保有 repo 的 admin 權限
#
# ============================================

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 取得 repository 資訊
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null)

if [ -z "$REPO" ]; then
  echo -e "${RED}❌ 無法取得 repository 資訊${NC}"
  echo "請確保您在 git repository 目錄中，且已登入 GitHub CLI"
  exit 1
fi

echo -e "${BLUE}🔒 設定 Branch Protection: ${REPO}${NC}"
echo "========================================"

# 確認操作
echo -e "${YELLOW}⚠️  此操作將設定 main 分支的保護規則：${NC}"
echo "   - 要求 PR 審查（至少 1 人）"
echo "   - 要求 CI 測試通過（lint, unit-integration, api-tests）"
echo "   - 禁止直接 push 到 main"
echo "   - 禁止 force push"
echo ""
read -p "確定要繼續嗎？(y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}已取消${NC}"
  exit 0
fi

echo ""
echo -e "${BLUE}📋 設定 Branch Protection Rules...${NC}"

# 使用 GitHub API 設定 Branch Protection
# 注意：這需要 admin 權限
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "/repos/${REPO}/branches/main/protection" \
  -f "required_status_checks[strict]=true" \
  -f "required_status_checks[contexts][]=Lint & Type Check" \
  -f "required_status_checks[contexts][]=Unit & Integration Tests" \
  -f "required_status_checks[contexts][]=API Tests" \
  -f "enforce_admins=false" \
  -f "required_pull_request_reviews[dismiss_stale_reviews]=true" \
  -f "required_pull_request_reviews[require_code_owner_reviews]=false" \
  -f "required_pull_request_reviews[required_approving_review_count]=1" \
  -f "restrictions=null" \
  -f "required_linear_history=false" \
  -f "allow_force_pushes=false" \
  -f "allow_deletions=false" \
  -f "block_creations=false" \
  -f "required_conversation_resolution=true" \
  --silent

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Branch Protection 設定完成！${NC}"
  echo ""
  echo -e "${BLUE}已套用的規則：${NC}"
  echo "  ✅ 要求 Pull Request 審查（1 人）"
  echo "  ✅ 要求 CI 測試通過："
  echo "     - Lint & Type Check"
  echo "     - Unit & Integration Tests"
  echo "     - API Tests"
  echo "  ✅ 過期的審查會自動失效（當有新 commit 時）"
  echo "  ✅ 要求解決所有對話後才能合併"
  echo "  ✅ 禁止 Force Push"
  echo "  ✅ 禁止刪除分支"
  echo ""
  echo -e "${YELLOW}注意事項：${NC}"
  echo "  - E2E Tests 和 Performance Tests 不是必要的（需要手動加標籤觸發）"
  echo "  - Admin 可以在緊急情況下 bypass 這些規則"
  echo "  - 如需修改規則，請到 GitHub Repository Settings > Branches"
else
  echo -e "${RED}❌ 設定失敗${NC}"
  echo ""
  echo "可能的原因："
  echo "  1. 沒有 admin 權限"
  echo "  2. GitHub CLI 未正確登入"
  echo "  3. Repository 不存在或名稱錯誤"
  echo ""
  echo "請手動到 GitHub 設定："
  echo "  https://github.com/${REPO}/settings/branches"
  exit 1
fi

echo ""
echo -e "${GREEN}🎉 安全部署機制設定完成！${NC}"
echo ""
echo "現在的部署流程："
echo "  1. 建立 feature branch"
echo "  2. 開發並提交變更"
echo "  3. 建立 Pull Request"
echo "  4. 等待 CI 測試通過"
echo "  5. 請求 Code Review"
echo "  6. 合併到 main"
echo "  7. 部署到 staging: ./scripts/deploy-staging.sh all"
echo "  8. 驗證後部署到 production: ./scripts/deploy-production.sh all"
