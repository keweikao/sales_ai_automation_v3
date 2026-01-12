// scripts/migration/validate.ts

import {
  conversations,
  meddicAnalyses,
  opportunities,
} from "../../packages/db/src/schema";
import { count, eq, isNull } from "drizzle-orm";
import { db, firestore } from "./config";
import type { FirestoreConversation } from "./types";

export interface ValidationCheck {
  name: string;
  passed: boolean;
  expected: number | string;
  actual: number | string;
  details?: string;
}

export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
  errors: string[];
  warnings: string[];
}

/**
 * 執行完整的遷移驗證
 */
export async function validateMigration(): Promise<ValidationResult> {
  const checks: ValidationCheck[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log("🔍 Starting migration validation...\n");

  // Check 1: Leads/Opportunities 筆數
  const firestoreLeadsCount = (
    await firestore.collection("leads").count().get()
  ).data().count;
  const [pgOpportunitiesCount] = await db
    .select({ count: count() })
    .from(opportunities);

  checks.push({
    name: "Leads → Opportunities 筆數",
    passed: firestoreLeadsCount === pgOpportunitiesCount.count,
    expected: firestoreLeadsCount,
    actual: pgOpportunitiesCount.count,
  });

  // Check 2: Conversations 筆數
  const firestoreCasesCount = (
    await firestore.collection("sales_cases").count().get()
  ).data().count;
  const [pgConversationsCount] = await db
    .select({ count: count() })
    .from(conversations);

  checks.push({
    name: "Sales Cases → Conversations 筆數",
    passed: firestoreCasesCount === pgConversationsCount.count,
    expected: firestoreCasesCount,
    actual: pgConversationsCount.count,
  });

  // Check 3: MEDDIC Analyses 筆數
  const casesSnapshot = await firestore.collection("sales_cases").get();
  const expectedMeddicCount = casesSnapshot.docs.filter((doc) => {
    const data = doc.data() as FirestoreConversation;
    return data.analysis?.meddic_score !== undefined;
  }).length;

  const [pgMeddicCount] = await db
    .select({ count: count() })
    .from(meddicAnalyses);

  checks.push({
    name: "MEDDIC Analyses 筆數",
    passed: expectedMeddicCount === pgMeddicCount.count,
    expected: expectedMeddicCount,
    actual: pgMeddicCount.count,
  });

  // Check 4: Orphaned Conversations（沒有對應 Opportunity 的 Conversation）
  const orphanedConversations = await db
    .select({ count: count() })
    .from(conversations)
    .leftJoin(opportunities, eq(conversations.opportunityId, opportunities.id))
    .where(isNull(opportunities.id));

  const orphanedCount = orphanedConversations[0]?.count ?? 0;

  checks.push({
    name: "Orphaned Conversations（無對應商機）",
    passed: orphanedCount === 0,
    expected: 0,
    actual: orphanedCount,
    details:
      orphanedCount > 0 ? "有對話沒有對應的商機，請檢查外鍵關聯" : undefined,
  });

  // Check 5: 抽樣檢查 MEDDIC 分數一致性
  const sampleSize = 10;
  let scoreMatchCount = 0;
  const scoreMismatchDetails: string[] = [];

  const sampleCases = casesSnapshot.docs
    .filter(
      (doc) =>
        (doc.data() as FirestoreConversation).analysis?.meddic_score !==
        undefined
    )
    .slice(0, sampleSize);

  for (const doc of sampleCases) {
    const firestoreScore = (doc.data() as FirestoreConversation).analysis
      ?.meddic_score;
    const pgAnalysis = await db.query.meddicAnalyses.findFirst({
      where: eq(meddicAnalyses.conversationId, doc.id),
    });

    if (pgAnalysis && pgAnalysis.overallScore === firestoreScore) {
      scoreMatchCount++;
    } else {
      scoreMismatchDetails.push(
        `${doc.id}: Firestore=${firestoreScore}, PG=${pgAnalysis?.overallScore ?? "null"}`
      );
    }
  }

  const matchRate =
    sampleCases.length > 0 ? scoreMatchCount / sampleCases.length : 1;

  checks.push({
    name: `MEDDIC 分數一致性（抽樣 ${sampleSize} 筆）`,
    passed: matchRate >= 0.9,
    expected: "90%+",
    actual: `${(matchRate * 100).toFixed(1)}%`,
    details:
      scoreMismatchDetails.length > 0
        ? scoreMismatchDetails.join(", ")
        : undefined,
  });

  // Check 6: 必填欄位檢查 - customerNumber
  const [missingCustomerNumber] = await db
    .select({ count: count() })
    .from(opportunities)
    .where(isNull(opportunities.customerNumber));

  checks.push({
    name: "商機缺少 customerNumber",
    passed: (missingCustomerNumber?.count ?? 0) === 0,
    expected: 0,
    actual: missingCustomerNumber?.count ?? 0,
  });

  // Check 7: 必填欄位檢查 - caseNumber
  const [missingCaseNumber] = await db
    .select({ count: count() })
    .from(conversations)
    .where(isNull(conversations.caseNumber));

  checks.push({
    name: "對話缺少 caseNumber",
    passed: (missingCaseNumber?.count ?? 0) === 0,
    expected: 0,
    actual: missingCaseNumber?.count ?? 0,
  });

  // 輸出結果
  console.log("\n📋 Validation Results:\n");
  for (const check of checks) {
    const status = check.passed ? "✅" : "❌";
    console.log(`${status} ${check.name}`);
    console.log(`   Expected: ${check.expected}, Actual: ${check.actual}`);
    if (check.details) {
      console.log(`   Details: ${check.details}`);
    }
    if (!check.passed) {
      errors.push(
        `${check.name}: expected ${check.expected}, got ${check.actual}`
      );
    }
  }

  const passed = errors.length === 0;
  console.log(
    `\n${passed ? "✅ All checks passed!" : "❌ Some checks failed!"}\n`
  );

  return {
    passed,
    checks,
    errors,
    warnings,
  };
}

// 如果直接執行此檔案
if (import.meta.main) {
  validateMigration()
    .then((result) => {
      process.exit(result.passed ? 0 : 1);
    })
    .catch((error) => {
      console.error("Validation failed:", error);
      process.exit(1);
    });
}
