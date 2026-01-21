#!/usr/bin/env node
// scripts/migration/compare-schemas.ts

import { firestore } from "./config";

interface FieldInfo {
  type: string;
  count: number;
  coverage: number; // 百分比
  samples: any[];
}

async function compareSchemas() {
  console.log("📊 V2 Firestore vs V3 PostgreSQL Schema 比對");
  console.log("=".repeat(100));

  // 讀取所有 cases
  const snapshot = await firestore.collection("cases").get();
  const totalCases = snapshot.size;
  console.log(`\n📦 分析 ${totalCases} 筆 Firestore cases...\n`);

  // 分析所有欄位
  const fields = new Map<string, FieldInfo>();

  function analyzeObject(obj: any, prefix = ""): void {
    if (!obj || typeof obj !== "object") return;

    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;

      if (!fields.has(path)) {
        fields.set(path, { type: "unknown", count: 0, coverage: 0, samples: [] });
      }

      const info = fields.get(path)!;
      info.count++;
      info.coverage = (info.count / totalCases) * 100;

      if (value === null || value === undefined) {
        info.type = "null";
      } else if (Array.isArray(value)) {
        info.type = "array";
        if (info.samples.length < 2) info.samples.push(value.slice(0, 2));
      } else if (typeof value === "object") {
        if (value._seconds) {
          info.type = "timestamp";
          if (info.samples.length < 2) {
            info.samples.push(new Date(value._seconds * 1000).toISOString());
          }
        } else {
          info.type = "object";
          analyzeObject(value, path);
        }
      } else {
        info.type = typeof value;
        if (info.samples.length < 3 && !info.samples.includes(value)) {
          info.samples.push(value);
        }
      }
    }
  }

  for (const doc of snapshot.docs) {
    analyzeObject(doc.data());
  }

  // V3 Schema 定義 (根據 opportunities, conversations, meddic_analyses)
  const v3Schema = {
    opportunities: [
      "userId", "productLine", "customerNumber", "companyName", "contactName",
      "contactEmail", "contactPhone", "source", "status",
      "storeType", "serviceType", "currentSystem", "decisionMakerPresent",
      "createdAt", "updatedAt"
    ],
    conversations: [
      "id", "opportunityId", "productLine", "caseNumber", "title", "type", "status",
      "audioUrl", "transcript", "summary", "duration",
      "meddicAnalysis", "progressScore", "coachingNotes", "urgencyLevel",
      "storeName", "slackChannelId", "slackThreadTs", "slackUserId", "slackUsername",
      "conversationDate", "createdAt", "updatedAt"
    ],
    meddicAnalyses: [
      "conversationId", "opportunityId", "productLine",
      "metricsScore", "economicBuyerScore", "decisionCriteriaScore",
      "decisionProcessScore", "identifyPainScore", "championScore",
      "overallScore", "status", "dimensions", "keyFindings", "nextSteps", "risks",
      "agentOutputs", "createdAt"
    ]
  };

  // V2 → V3 映射規則
  const mappingRules = {
    // Opportunities
    "customerId": "opportunities.customerNumber (⚠️ 需轉換: V2 customerId = V2 caseId, V3 需生成新的 customerNumber)",
    "customerName": "opportunities.companyName",
    "customerPhone": "opportunities.contactPhone",
    "customerEmail": "❌ V2 無此欄位 → opportunities.contactEmail = null",
    "salesRepSlackId": "opportunities.userId (需映射透過 user_profiles.slackUserId)",
    "unit": "opportunities.productLine (IC→ichef, OC→outchef)",
    "demoMeta.storeType": "opportunities.storeType",
    "demoMeta.serviceType": "opportunities.serviceType",
    "demoMeta.currentPos": "opportunities.currentSystem",
    "demoMeta.decisionMakerOnsite": "opportunities.decisionMakerPresent (boolean→text)",

    // Conversations
    "caseId": "conversations.id (完全沿用)",
    "caseId (dup)": "conversations.caseNumber (完全沿用)",
    "status": "conversations.status (需映射)",
    "audio.gcsPath": "conversations.audioUrl (第二階段遷移)",
    "audio.duration": "conversations.duration",
    "transcription": "conversations.transcript (需轉換 JSONB)",
    "analysis.agents.agent4.data.summary": "conversations.summary",
    "notification.slackChannelId": "conversations.slackChannelId",
    "notification.slackThreadTs": "conversations.slackThreadTs",
    "salesRepSlackId (dup)": "conversations.slackUserId",
    "salesRepName": "conversations.slackUsername",

    // MEDDIC Analyses
    "analysis.agents": "meddicAnalyses.agentOutputs (V2 僅 4 個 agent, agent5/6=null)",
    "analysis.agents.agent4.data.keyFindings": "meddicAnalyses.keyFindings",
  };

  // ========== 輸出報告 ==========
  console.log("\n" + "=".repeat(100));
  console.log("📋 V2 Firestore 欄位分析 (依覆蓋率排序)");
  console.log("=".repeat(100));
  console.log(`${"欄位路徑".padEnd(60)} ${"覆蓋率".padEnd(10)} ${"類型".padEnd(12)} 範例`);
  console.log("-".repeat(120));

  const sorted = Array.from(fields.entries())
    .filter(([path]) => !path.includes("[0]")) // 過濾陣列內部欄位
    .sort((a, b) => b[1].coverage - a[1].coverage);

  for (const [path, info] of sorted) {
    const coverage = `${info.coverage.toFixed(0)}%`;
    const sample = String(info.samples[0] || "").substring(0, 30);
    console.log(`${path.padEnd(60)} ${coverage.padEnd(10)} ${info.type.padEnd(12)} ${sample}`);
  }

  // ========== V2 有但 V3 無法直接映射的欄位 ==========
  console.log("\n" + "=".repeat(100));
  console.log("⚠️  V2 有但 V3 無法直接映射的欄位");
  console.log("=".repeat(100));

  const unmappedFields = [
    { v2: "sourceType", coverage: fields.get("sourceType")?.coverage || 0, reason: "V3 無此欄位", action: "忽略或記錄在 metadata" },
    { v2: "uploadedBy", coverage: fields.get("uploadedBy")?.coverage || 0, reason: "V3 無此欄位", action: "忽略,改用 salesRepSlackId" },
    { v2: "uploadedByName", coverage: fields.get("uploadedByName")?.coverage || 0, reason: "V3 無此欄位", action: "忽略,改用 salesRepName" },
    { v2: "uploadedBySlackName", coverage: fields.get("uploadedBySlackName")?.coverage || 0, reason: "V3 無此欄位", action: "忽略" },
    { v2: "metadata", coverage: fields.get("metadata")?.coverage || 0, reason: "V3 無此欄位", action: "忽略或記錄在 conversations.metadata" },
    { v2: "notification.slackFileId", coverage: fields.get("notification.slackFileId")?.coverage || 0, reason: "V3 無此欄位", action: "忽略" },
    { v2: "notification.messageTs", coverage: fields.get("notification.messageTs")?.coverage || 0, reason: "V3 無此欄位", action: "忽略" },
    { v2: "audio.fileName", coverage: fields.get("audio.fileName")?.coverage || 0, reason: "V3 無此欄位", action: "忽略,僅保留 audioUrl" },
    { v2: "audio.slackFileId", coverage: fields.get("audio.slackFileId")?.coverage || 0, reason: "V3 無此欄位", action: "忽略" },
    { v2: "audio.fileSize", coverage: fields.get("audio.fileSize")?.coverage || 0, reason: "V3 無此欄位", action: "忽略" },
    { v2: "transcription.speakers", coverage: fields.get("transcription.speakers")?.coverage || 0, reason: "V3 無此欄位", action: "包含在 transcript.segments 中" },
    { v2: "transcription.language", coverage: fields.get("transcription.language")?.coverage || 0, reason: "V3 無此欄位", action: "固定為 zh-TW" },
    { v2: "analysis.status", coverage: fields.get("analysis.status")?.coverage || 0, reason: "V3 無對應", action: "記錄在 meddicAnalysis.status" },
    { v2: "analysis.completedAt", coverage: fields.get("analysis.completedAt")?.coverage || 0, reason: "V3 無對應", action: "記錄在 meddicAnalyses.createdAt" },
    { v2: "analysis.customerSummary", coverage: fields.get("analysis.customerSummary")?.coverage || 0, reason: "V3 無此欄位", action: "忽略或記錄在 summary" },
  ];

  for (const field of unmappedFields) {
    if (field.coverage > 0) {
      console.log(`❓ ${field.v2.padEnd(40)} (${field.coverage.toFixed(0)}%) → ${field.action}`);
    }
  }

  // ========== V3 有但 V2 無的欄位 ==========
  console.log("\n" + "=".repeat(100));
  console.log("➕ V3 有但 V2 無的欄位 (需設為 null 或預設值)");
  console.log("=".repeat(100));

  const v3OnlyFields = [
    { field: "opportunities.contactName", action: "設為 null (V2 無此資料)" },
    { field: "opportunities.contactEmail", action: "設為 null (V2 無此資料)" },
    { field: "opportunities.source", action: "設為 'import' (標記為遷移資料)" },
    { field: "opportunities.status", action: "設為 'contacted' (預設已聯絡)" },
    { field: "conversations.type", action: "設為 'demo' (預設為 Demo)" },
    { field: "conversations.progressScore", action: "設為 null (V2 無此資料)" },
    { field: "conversations.coachingNotes", action: "設為 null (V2 無此資料)" },
    { field: "conversations.urgencyLevel", action: "設為 null (V2 無此資料)" },
    { field: "meddicAnalyses.metricsScore", action: "設為 null (V2 僅 4 個 agent)" },
    { field: "meddicAnalyses.economicBuyerScore", action: "設為 null (V2 僅 4 個 agent)" },
    { field: "meddicAnalyses.decisionCriteriaScore", action: "設為 null (V2 僅 4 個 agent)" },
    { field: "meddicAnalyses.decisionProcessScore", action: "設為 null (V2 僅 4 個 agent)" },
    { field: "meddicAnalyses.identifyPainScore", action: "設為 null (V2 僅 4 個 agent)" },
    { field: "meddicAnalyses.championScore", action: "設為 null (V2 僅 4 個 agent)" },
    { field: "meddicAnalyses.overallScore", action: "從 agent2/agent3 計算平均" },
    { field: "meddicAnalyses.status", action: "根據 overallScore 推斷" },
    { field: "meddicAnalyses.nextSteps", action: "設為 null (V2 無此資料)" },
    { field: "meddicAnalyses.risks", action: "設為 null (V2 無此資料)" },
  ];

  for (const item of v3OnlyFields) {
    console.log(`➕ ${item.field.padEnd(50)} → ${item.action}`);
  }

  // ========== 需要討論的模糊欄位 ==========
  console.log("\n" + "=".repeat(100));
  console.log("🤔 需要討論的模糊欄位");
  console.log("=".repeat(100));

  const ambiguousFields = [
    {
      v2Field: "customerId",
      v2Coverage: fields.get("customerId")?.coverage.toFixed(0) + "%",
      v2Sample: fields.get("customerId")?.samples[0],
      issue: "V2 customerId = caseId (案件層級),但 V3 customerNumber 是客戶層級",
      question: "如何生成 V3 opportunities.customerNumber?",
      options: [
        "A. 基於 customerName hash 生成 (目前方案)",
        "B. 使用 V2 customerId 直接作為 customerNumber (會導致一個客戶多個 opportunity)",
        "C. 其他方案?"
      ]
    },
    {
      v2Field: "salesRepEmail vs salesRepSlackId",
      v2Coverage: `Email: ${fields.get("salesRepEmail")?.coverage.toFixed(0)}%, SlackId: ${fields.get("salesRepSlackId")?.coverage.toFixed(0)}%`,
      v2Sample: `Email: ${fields.get("salesRepEmail")?.samples[0]}, SlackId: ${fields.get("salesRepSlackId")?.samples[0]}`,
      issue: "V2 同時有 salesRepEmail 和 salesRepSlackId",
      question: "用哪個來映射到 V3 opportunities.userId?",
      options: [
        "A. 優先用 salesRepSlackId 查詢 user_profiles (目前方案)",
        "B. 優先用 salesRepEmail 查詢 users",
        "C. 兩者都查,優先順序: SlackId > Email > service-account"
      ]
    },
    {
      v2Field: "demoMeta",
      v2Coverage: fields.get("demoMeta")?.coverage.toFixed(0) + "%",
      v2Sample: "僅 6% 有資料",
      issue: "demoMeta 覆蓋率很低 (僅 6%)",
      question: "是否需要遷移 demoMeta 相關欄位?",
      options: [
        "A. 遷移所有 demoMeta 欄位,無資料設為 null (目前方案)",
        "B. 忽略 demoMeta,不遷移",
        "C. 僅遷移有資料的 cases"
      ]
    },
    {
      v2Field: "analysis.agents (4 個) vs V3 MEDDIC (6 維度)",
      v2Coverage: fields.get("analysis.agents")?.coverage.toFixed(0) + "%",
      v2Sample: "agent1-4",
      issue: "V2 僅有 4 個 Agent,V3 期望 6 個 MEDDIC 維度",
      question: "如何處理缺少的 agent5/agent6?",
      options: [
        "A. agent5/agent6 設為 null,保留擴展性 (目前方案)",
        "B. 不建立 meddicAnalyses,僅保留在 conversations.meddicAnalysis",
        "C. 嘗試從現有 agent 資料推斷 MEDDIC 6 維度"
      ]
    },
    {
      v2Field: "audio.gcsPath",
      v2Coverage: fields.get("audio.gcsPath")?.coverage.toFixed(0) + "%",
      v2Sample: fields.get("audio.gcsPath")?.samples[0],
      issue: "音檔路徑在 GCS,需遷移到 R2",
      question: "音檔遷移時機?",
      options: [
        "A. 第二階段獨立遷移 (目前方案)",
        "B. 第一階段一起遷移",
        "C. 暫不遷移,保留 GCS 路徑"
      ]
    },
  ];

  for (const item of ambiguousFields) {
    console.log(`\n🤔 ${item.v2Field}`);
    console.log(`   覆蓋率: ${item.v2Coverage}`);
    console.log(`   範例: ${item.v2Sample}`);
    console.log(`   問題: ${item.issue}`);
    console.log(`   需討論: ${item.question}`);
    for (const option of item.options) {
      console.log(`      ${option}`);
    }
  }

  // ========== 統計摘要 ==========
  console.log("\n" + "=".repeat(100));
  console.log("📊 統計摘要");
  console.log("=".repeat(100));
  console.log(`V2 Firestore cases 總數: ${totalCases}`);
  console.log(`V2 總欄位數: ${sorted.length}`);
  console.log(`V2 無法直接映射的欄位: ${unmappedFields.filter(f => f.coverage > 0).length}`);
  console.log(`V3 獨有欄位 (需設預設值): ${v3OnlyFields.length}`);
  console.log(`需要討論的模糊欄位: ${ambiguousFields.length}`);

  console.log("\n✅ 比對完成!\n");
}

compareSchemas().catch(console.error);
