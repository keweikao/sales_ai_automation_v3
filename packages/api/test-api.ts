/**
 * Test API Routes
 * Verify all endpoints are properly configured
 * Run: tsx test-api.ts
 */

import { appRouter } from "./src/routers/index.js";

async function testApiRoutes() {
  console.log("🧪 Testing API Routes Configuration...\n");

  // Step 1: Verify router structure
  console.log("📋 Step 1: Verifying router structure...");

  const routerKeys = Object.keys(appRouter);
  console.log(`   Found ${routerKeys.length} top-level routes:`);
  routerKeys.forEach((key) => console.log(`   - ${key}`));

  if (!routerKeys.includes("leads")) {
    console.error("❌ Missing 'leads' router");
    process.exit(1);
  }

  if (!routerKeys.includes("conversations")) {
    console.error("❌ Missing 'conversations' router");
    process.exit(1);
  }

  if (!routerKeys.includes("analytics")) {
    console.error("❌ Missing 'analytics' router");
    process.exit(1);
  }

  console.log("✅ All required routers are present\n");

  // Step 2: Verify lead routes
  console.log("📋 Step 2: Verifying lead routes...");
  const leadRoutes = Object.keys(appRouter.leads);
  console.log(`   Found ${leadRoutes.length} lead routes:`);
  leadRoutes.forEach((key) => console.log(`   - leads.${key}`));

  const expectedLeadRoutes = ["create", "update", "delete", "list", "get"];
  const missingLeadRoutes = expectedLeadRoutes.filter(
    (route) => !leadRoutes.includes(route)
  );

  if (missingLeadRoutes.length > 0) {
    console.error(`❌ Missing lead routes: ${missingLeadRoutes.join(", ")}`);
    process.exit(1);
  }

  console.log("✅ All lead routes are present\n");

  // Step 3: Verify conversation routes
  console.log("📋 Step 3: Verifying conversation routes...");
  const conversationRoutes = Object.keys(appRouter.conversations);
  console.log(`   Found ${conversationRoutes.length} conversation routes:`);
  conversationRoutes.forEach((key) => console.log(`   - conversations.${key}`));

  const expectedConversationRoutes = ["upload", "analyze", "list", "get"];
  const missingConversationRoutes = expectedConversationRoutes.filter(
    (route) => !conversationRoutes.includes(route)
  );

  if (missingConversationRoutes.length > 0) {
    console.error(
      `❌ Missing conversation routes: ${missingConversationRoutes.join(", ")}`
    );
    process.exit(1);
  }

  console.log("✅ All conversation routes are present\n");

  // Step 4: Verify analytics routes
  console.log("📋 Step 4: Verifying analytics routes...");
  const analyticsRoutes = Object.keys(appRouter.analytics);
  console.log(`   Found ${analyticsRoutes.length} analytics routes:`);
  analyticsRoutes.forEach((key) => console.log(`   - analytics.${key}`));

  const expectedAnalyticsRoutes = [
    "dashboard",
    "leadAnalytics",
    "meddicTrends",
  ];
  const missingAnalyticsRoutes = expectedAnalyticsRoutes.filter(
    (route) => !analyticsRoutes.includes(route)
  );

  if (missingAnalyticsRoutes.length > 0) {
    console.error(
      `❌ Missing analytics routes: ${missingAnalyticsRoutes.join(", ")}`
    );
    process.exit(1);
  }

  console.log("✅ All analytics routes are present\n");

  // Step 5: Summary
  console.log("🎉 API Routes Configuration Test Completed!\n");
  console.log("📝 Summary:");
  console.log(`   ✅ ${leadRoutes.length} lead endpoints`);
  console.log(`   ✅ ${conversationRoutes.length} conversation endpoints`);
  console.log(`   ✅ ${analyticsRoutes.length} analytics endpoints`);
  console.log(
    `   ✅ Total: ${leadRoutes.length + conversationRoutes.length + analyticsRoutes.length} API endpoints`
  );
  console.log("\n📚 Available Endpoints:");
  console.log("\n   Leads:");
  console.log("   - POST   /api/leads.create");
  console.log("   - PATCH  /api/leads.update");
  console.log("   - DELETE /api/leads.delete");
  console.log("   - GET    /api/leads.list");
  console.log("   - GET    /api/leads.get");
  console.log("\n   Conversations:");
  console.log("   - POST   /api/conversations.upload");
  console.log("   - POST   /api/conversations.analyze");
  console.log("   - GET    /api/conversations.list");
  console.log("   - GET    /api/conversations.get");
  console.log("\n   Analytics:");
  console.log("   - GET    /api/analytics.dashboard");
  console.log("   - GET    /api/analytics.leadAnalytics");
  console.log("   - GET    /api/analytics.meddicTrends");
  console.log("\n✅ Phase 2D: API Routes implementation completed!");
}

// Run tests
testApiRoutes().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
