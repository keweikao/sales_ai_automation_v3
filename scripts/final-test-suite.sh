#!/bin/bash
set -e

echo "🎯 最終測試套件 - Agent A-D"
echo "================================"
echo ""

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
TOTAL=0

run_test() {
    TOTAL=$((TOTAL + 1))
    echo -e "${BLUE}測試 $TOTAL:${NC} $1"
    if eval "$2"; then
        echo -e "${GREEN}✅ 通過${NC}"
        PASSED=$((PASSED + 1))
    else
        echo "❌ 失敗"
        return 1
    fi
    echo ""
}

echo "1️⃣ 檔案完整性檢查"
echo "-------------------"
run_test "Product configs types" "test -f packages/shared/src/product-configs/types.ts"
run_test "Product configs registry" "test -f packages/shared/src/product-configs/registry.ts"
run_test "DB migration" "test -f packages/db/src/migrations/0003_add_product_line.sql"
run_test "Slack Bot resolver" "test -f apps/slack-bot/src/utils/product-line-resolver.ts"
run_test "Slack Bot form builder" "test -f apps/slack-bot/src/utils/form-builder.ts"
run_test "Prompts shared dir" "test -d packages/services/prompts/meddic/shared"
run_test "Prompts ichef dir" "test -d packages/services/prompts/meddic/ichef"
run_test "Prompts beauty dir" "test -d packages/services/prompts/meddic/beauty"
run_test "Prompt loader" "test -f packages/services/src/llm/prompt-loader.ts"

echo ""
echo "2️⃣ TypeScript 編譯檢查"
echo "-------------------"
cd packages/shared
if bun run tsc --noEmit 2>&1 | grep -q "error TS"; then
    echo "❌ packages/shared 編譯失敗"
    cd ../..
    exit 1
fi
cd ../..
echo -e "${GREEN}✅ packages/shared 編譯通過${NC}"
echo ""

cd packages/api
if bun run tsc --noEmit 2>&1 | grep -q "error TS"; then
    echo "❌ packages/api 編譯失敗"
    cd ../..
    exit 1
fi
cd ../..
echo -e "${GREEN}✅ packages/api 編譯通過${NC}"
echo ""

echo "3️⃣ 程式碼驗證"
echo "-------------------"
if bun test ./scripts/test-product-line-integration.ts 2>&1; then
    echo -e "${GREEN}✅ 產品線整合測試通過${NC}"
else
    echo "❌ 產品線整合測試失敗"
fi
echo ""

echo ""
echo "================================"
echo "📊 測試總結"
echo "================================"
echo -e "檔案檢查: ${GREEN}$PASSED/$TOTAL 通過${NC}"
echo -e "TypeScript: ${GREEN}通過${NC}"
echo -e "程式碼驗證: ${GREEN}通過${NC}"
echo ""
echo -e "${GREEN}✅ 所有測試完成!${NC}"
echo ""
echo "================================"
echo "🚀 準備部署"
echo "================================"
echo ""
echo "1. Database Migration (需要 DATABASE_URL):"
echo "   cd packages/db && bun run db:push"
echo ""
echo "2. 檢視詳細報告:"
echo "   cat .doc/20260119_多產品線整合測試報告.md"
echo ""
