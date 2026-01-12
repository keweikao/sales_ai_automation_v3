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
  for (const key of routerKeys) console.log(`   - ${key}`);

  if (!routerKeys.includes("opportunities")) {
    console.error("❌ Missing 'opportunities' router");
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

  // Step 2: Verify opportunity routes
  console.log("📋 Step 2: Verifying opportunity routes...");
  const opportunityRoutes = Object.keys(appRouter.opportunities);
  console.log(`   Found ${opportunityRoutes.length} opportunity routes:`);
  for (const key of opportunityRoutes) console.log(`   - opportunities.${key}`);

  const expectedOpportunityRoutes = [
    "create",
    "update",
    "delete",
    "list",
    "get",
    "getByCustomerNumber",
  ];
  const missingOpportunityRoutes = expectedOpportunityRoutes.filter(
    (route) => !opportunityRoutes.includes(route)
  );

  if (missingOpportunityRoutes.length > 0) {
    console.error(
      `❌ Missing opportunity routes: ${missingOpportunityRoutes.join(", ")}`
    );
    process.exit(1);
  }

  console.log("✅ All opportunity routes are present\n");

  // Step 3: Verify conversation routes
  console.log("📋 Step 3: Verifying conversation routes...");
  const conversationRoutes = Object.keys(appRouter.conversations);
  console.log(`   Found ${conversationRoutes.length} conversation routes:`);
  for (const key of conversationRoutes)
    console.log(`   - conversations.${key}`);

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
  for (const key of analyticsRoutes) console.log(`   - analytics.${key}`);

  const expectedAnalyticsRoutes = [
    "dashboard",
    "opportunityAnalytics",
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
  console.log(`   ✅ ${opportunityRoutes.length} opportunity endpoints`);
  console.log(`   ✅ ${conversationRoutes.length} conversation endpoints`);
  console.log(`   ✅ ${analyticsRoutes.length} analytics endpoints`);
  console.log(
    `   ✅ Total: ${opportunityRoutes.length + conversationRoutes.length + analyticsRoutes.length} API endpoints`
  );
  console.log("\n📚 Available Endpoints:");
  console.log("\n   Opportunities:");
  console.log("   - POST   /api/opportunities.create");
  console.log("   - PATCH  /api/opportunities.update");
  console.log("   - DELETE /api/opportunities.delete");
  console.log("   - GET    /api/opportunities.list");
  console.log("   - GET    /api/opportunities.get");
  console.log("   - GET    /api/opportunities.getByCustomerNumber");
  console.log("\n   Conversations:");
  console.log("   - POST   /api/conversations.upload");
  console.log("   - POST   /api/conversations.analyze");
  console.log("   - GET    /api/conversations.list");
  console.log("   - GET    /api/conversations.get");
  console.log("\n   Analytics:");
  console.log("   - GET    /api/analytics.dashboard");
  console.log("   - GET    /api/analytics.opportunityAnalytics");
  console.log("   - GET    /api/analytics.meddicTrends");
  console.log("\n✅ V3 API Routes with Salesforce UUID integration completed!");
}

// Run tests
testApiRoutes().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
