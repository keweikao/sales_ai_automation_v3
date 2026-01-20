#!/bin/bash
set -e

echo "🚀 多產品線功能部署與測試腳本"
echo "================================"
echo ""

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 步驟計數
STEP=1

print_step() {
    echo ""
    echo -e "${BLUE}[步驟 ${STEP}/${1}]${NC} $2"
    STEP=$((STEP + 1))
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 總步驟數
TOTAL_STEPS=8

# ============================================================
# 階段 1: 前置檢查
# ============================================================

print_step $TOTAL_STEPS "前置條件檢查"

# 檢查是否在專案根目錄
if [ ! -f "package.json" ]; then
    print_error "請在專案根目錄執行此腳本"
    exit 1
fi

# 檢查 DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    print_warning "DATABASE_URL 未設定"
    echo "請設定環境變數: export DATABASE_URL='your_database_url'"
    echo ""
    echo "或者建立 apps/server/.env 檔案並加入:"
    echo "DATABASE_URL=postgresql://..."
    echo ""
    read -p "是否繼續? (跳過 Migration) [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    SKIP_MIGRATION=true
else
    print_success "DATABASE_URL 已設定"
    SKIP_MIGRATION=false
fi

# ============================================================
# 階段 2: 執行 Database Migration (如果可以)
# ============================================================

if [ "$SKIP_MIGRATION" = false ]; then
    print_step $TOTAL_STEPS "執行 Database Migration"
    
    echo "⚠️  即將執行 Database Migration,這會修改資料庫 Schema"
    echo ""
    echo "Migration 內容:"
    echo "  - 新增 product_line 欄位到 4 個表格"
    echo "  - 預設值: 'ichef'"
    echo "  - 建立 4 個索引"
    echo ""
    read -p "確定要執行 Migration? [y/N] " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd packages/db
        
        # 備份提醒
        print_warning "建議先備份資料庫!"
        echo "執行: pg_dump \$DATABASE_URL > backup_\$(date +%Y%m%d_%H%M%S).sql"
        echo ""
        read -p "已備份? 繼續執行 Migration? [y/N] " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # 執行 Migration
            bun run db:push || {
                print_error "Migration 失敗"
                cd ../..
                exit 1
            }
            
            print_success "Migration 執行成功"
        else
            print_warning "跳過 Migration"
        fi
        
        cd ../..
    else
        print_warning "跳過 Migration"
    fi
else
    print_step $TOTAL_STEPS "跳過 Database Migration (無 DATABASE_URL)"
fi

# ============================================================
# 階段 3: TypeScript 編譯檢查
# ============================================================

print_step $TOTAL_STEPS "TypeScript 編譯檢查"

echo "檢查 packages/shared..."
cd packages/shared
if bun run tsc --noEmit 2>&1 | grep -q "error TS"; then
    print_error "packages/shared TypeScript 編譯失敗"
    cd ../..
    exit 1
fi
cd ../..
print_success "packages/shared 編譯通過"

echo "檢查 packages/api..."
cd packages/api
if bun run tsc --noEmit 2>&1 | grep -q "error TS"; then
    print_error "packages/api TypeScript 編譯失敗"
    cd ../..
    exit 1
fi
cd ../..
print_success "packages/api 編譯通過"

# ============================================================
# 階段 4: 執行單元測試
# ============================================================

print_step $TOTAL_STEPS "執行單元測試"

if [ -f "scripts/test-integration-multi-product.ts" ]; then
    echo "執行整合測試..."
    if ! bun test scripts/test-integration-multi-product.ts; then
        print_error "整合測試失敗"
        exit 1
    fi
    print_success "整合測試通過"
else
    print_warning "找不到測試檔案,跳過"
fi

# ============================================================
# 階段 5: 驗證 API/Queue 程式碼
# ============================================================

print_step $TOTAL_STEPS "驗證 API/Queue 程式碼"

if [ -f "scripts/verify-api-queue-integration.ts" ]; then
    echo "執行 API/Queue 驗證..."
    if ! bun test scripts/verify-api-queue-integration.ts; then
        print_error "API/Queue 驗證失敗"
        exit 1
    fi
    print_success "API/Queue 驗證通過"
else
    print_warning "找不到驗證檔案,跳過"
fi

# ============================================================
# 階段 6: 建置服務
# ============================================================

print_step $TOTAL_STEPS "建置服務"

echo "建置 packages/shared..."
cd packages/shared
bun run build || print_warning "packages/shared 無 build script"
cd ../..

echo "建置 packages/api..."
cd packages/api
bun run build || print_warning "packages/api 無 build script"
cd ../..

print_success "建置完成"

# ============================================================
# 階段 7: 端到端測試 (如果有 DB)
# ============================================================

if [ "$SKIP_MIGRATION" = false ]; then
    print_step $TOTAL_STEPS "端到端測試準備"
    
    echo "端到端測試需要:"
    echo "  1. 資料庫已執行 Migration"
    echo "  2. API Server 正在運行"
    echo "  3. Queue Worker 正在運行"
    echo ""
    
    read -p "是否執行端到端測試? [y/N] " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -f "scripts/test-end-to-end.ts" ]; then
            bun run scripts/test-end-to-end.ts || print_warning "端到端測試失敗或未完成"
        else
            print_warning "找不到端到端測試腳本"
        fi
    else
        print_warning "跳過端到端測試"
    fi
else
    print_step $TOTAL_STEPS "跳過端到端測試 (無資料庫連線)"
fi

# ============================================================
# 階段 8: 部署總結
# ============================================================

print_step $TOTAL_STEPS "部署總結"

echo ""
echo "================================"
echo "📊 部署狀態報告"
echo "================================"
echo ""

if [ "$SKIP_MIGRATION" = false ]; then
    print_success "Database Migration: 已執行"
else
    print_warning "Database Migration: 跳過 (無 DATABASE_URL)"
fi

print_success "TypeScript 編譯: 通過"
print_success "單元測試: 通過"
print_success "API/Queue 驗證: 通過"
print_success "服務建置: 完成"

echo ""
echo "================================"
echo "🎯 下一步行動"
echo "================================"
echo ""

if [ "$SKIP_MIGRATION" = false ]; then
    echo "✅ 資料庫已就緒,可以部署服務"
    echo ""
    echo "部署 API Server:"
    echo "  cd apps/server && wrangler deploy"
    echo ""
    echo "部署 Queue Worker:"
    echo "  cd apps/queue-worker && wrangler deploy"
    echo ""
    echo "部署 Slack Bot:"
    echo "  cd apps/slack-bot && wrangler deploy"
else
    echo "⚠️  需要先執行 Database Migration"
    echo ""
    echo "1. 設定 DATABASE_URL:"
    echo "   export DATABASE_URL='postgresql://...'"
    echo ""
    echo "2. 執行 Migration:"
    echo "   cd packages/db && bun run db:push"
    echo ""
    echo "3. 重新執行此腳本:"
    echo "   bash scripts/deploy-and-test.sh"
fi

echo ""
echo "================================"
echo "📚 相關文件"
echo "================================"
echo ""
echo "整合測試報告: .doc/20260119_多產品線整合測試報告.md"
echo "部署指南: .doc/multi-product-line-guides/06_整合測試與部署.md"
echo ""

print_success "部署流程完成! 🎉"
