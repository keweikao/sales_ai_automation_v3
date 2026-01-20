#!/bin/bash

echo "🔍 檢查 Agent 完成狀態..."

# Agent A: Config + DB
echo ""
echo "📦 Agent A (Config + DB):"
[ -f "packages/config/src/product-lines/types.ts" ] && echo "  ✅ types.ts" || echo "  ❌ types.ts"
[ -f "packages/config/src/product-lines/registry.ts" ] && echo "  ✅ registry.ts" || echo "  ❌ registry.ts"
[ -f "packages/db/src/migrations/0003_add_product_line.sql" ] && echo "  ✅ migration" || echo "  ❌ migration"

# Agent B: Slack Bot
echo ""
echo "💬 Agent B (Slack Bot):"
[ -f "apps/slack-bot/src/utils/product-line-resolver.ts" ] && echo "  ✅ resolver" || echo "  ❌ resolver"
[ -f "apps/slack-bot/src/utils/form-builder.ts" ] && echo "  ✅ form-builder" || echo "  ❌ form-builder"

# Agent C: MEDDIC Prompts
echo ""
echo "📝 Agent C (MEDDIC Prompts):"
[ -d "packages/services/prompts/meddic/shared" ] && echo "  ✅ shared/" || echo "  ❌ shared/"
[ -d "packages/services/prompts/meddic/ichef" ] && echo "  ✅ ichef/" || echo "  ❌ ichef/"
[ -d "packages/services/prompts/meddic/beauty" ] && echo "  ✅ beauty/" || echo "  ❌ beauty/"
[ -f "packages/services/src/llm/prompt-loader.ts" ] && echo "  ✅ prompt-loader" || echo "  ❌ prompt-loader"

# Agent D: API + Queue
echo ""
echo "🔌 Agent D (API + Queue):"
grep -q "productLine" packages/api/src/routers/conversation.ts && echo "  ✅ API conversation router updated" || echo "  ❌ API conversation router not updated"
grep -q "productLine" packages/api/src/routers/opportunity.ts && echo "  ✅ API opportunity router updated" || echo "  ❌ API opportunity router not updated"
grep -q "productLine" apps/queue-worker/src/index.ts && echo "  ✅ Queue updated" || echo "  ❌ Queue not updated"

echo ""
echo "✅ 檢查完成"
