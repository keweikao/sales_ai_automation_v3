#!/bin/bash

echo "=================================================="
echo "  多產品線整合測試 - 完整測試套件"
echo "=================================================="
echo ""

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0

# ============================================
# 1. 檢查檔案完整性
# ============================================
echo "📋 Step 1: 檢查 Agent 完成狀態..."
echo ""
bash scripts/check-agents-completion.sh
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Step 1: 檔案完整性檢查通過${NC}"
else
  echo -e "${RED}❌ Step 1: 檔案完整性檢查失敗${NC}"
  FAILED=1
fi
echo ""

# ============================================
# 2. 執行單元測試
# ============================================
echo "🧪 Step 2: 執行單元測試 (26 tests)..."
echo ""
bun test ./scripts/test-integration-multi-product.ts
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Step 2: 單元測試通過 (26/26)${NC}"
else
  echo -e "${RED}❌ Step 2: 單元測試失敗${NC}"
  FAILED=1
fi
echo ""

# ============================================
# 3. 執行程式碼驗證
# ============================================
echo "🔍 Step 3: 執行 API/Queue 整合驗證 (15 tests)..."
echo ""
bun test ./scripts/verify-api-queue-integration.ts
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Step 3: 程式碼驗證通過 (15/15)${NC}"
else
  echo -e "${RED}❌ Step 3: 程式碼驗證失敗${NC}"
  FAILED=1
fi
echo ""

# ============================================
# 4. TypeScript 類型檢查
# ============================================
echo "📝 Step 4: TypeScript 類型檢查..."
echo ""
cd packages/shared && bun run check-types > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ shared package 類型檢查通過${NC}"
else
  echo -e "${RED}❌ shared package 類型檢查失敗${NC}"
  FAILED=1
fi

cd ../api && bun run check-types > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ api package 類型檢查通過${NC}"
else
  echo -e "${RED}❌ api package 類型檢查失敗${NC}"
  FAILED=1
fi
cd ../..
echo ""

# ============================================
# 總結
# ============================================
echo "=================================================="
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ 所有測試通過! (42/42 tests)${NC}"
  echo ""
  echo "🎉 多產品線功能已準備好部署!"
  echo ""
  echo "下一步:"
  echo "  1. 查看測試報告: .doc/20260119_多產品線整合測試報告.md"
  echo "  2. 執行端到端測試 (需要資料庫)"
  echo "  3. 開始分階段部署"
  echo ""
else
  echo -e "${RED}❌ 部分測試失敗,請檢查錯誤訊息${NC}"
  echo ""
fi
echo "=================================================="

exit $FAILED
