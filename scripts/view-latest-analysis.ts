/**
 * 查看最新的 MEDDIC 分析結果
 */

import * as dotenv from "dotenv";
import pg from "pg";

// 載入環境變數
dotenv.config();

const CONVERSATION_ID = "bda22553-e408-4ca7-a845-c3e288f0935d";

async function viewAnalysis() {
  console.log("🔍 查看 MEDDIC 分析結果");
  console.log("=".repeat(80));
  console.log(`\nConversation ID: ${CONVERSATION_ID}\n`);

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("✅ 資料庫連線成功\n");

    // 查詢 conversation 基本資訊
    const convResult = await client.query(
      `
      SELECT
        id,
        title,
        status,
        transcription_status,
        created_at,
        updated_at,
        audio_url
      FROM conversations
      WHERE id = $1
    `,
      [CONVERSATION_ID]
    );

    if (convResult.rows.length === 0) {
      console.log("❌ 找不到此 Conversation");
      process.exit(1);
    }

    const conv = convResult.rows[0];
    console.log("📝 Conversation 資訊:");
    console.log(`   ID: ${conv.id}`);
    console.log(`   標題: ${conv.title}`);
    console.log(`   狀態: ${conv.status}`);
    console.log(`   轉錄狀態: ${conv.transcription_status}`);
    console.log(`   建立時間: ${conv.created_at}`);
    console.log(`   更新時間: ${conv.updated_at}`);
    console.log("");

    // 查詢 MEDDIC 分析結果
    const analysisResult = await client.query(
      `
      SELECT
        id,
        metrics_score,
        economic_buyer_score,
        decision_criteria_score,
        decision_process_score,
        identify_pain_score,
        champion_score,
        overall_score,
        qualification_status,
        executive_summary,
        key_findings,
        next_steps,
        risks,
        coaching_notes,
        alerts,
        agent_outputs,
        created_at
      FROM meddic_analyses
      WHERE conversation_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
      [CONVERSATION_ID]
    );

    if (analysisResult.rows.length === 0) {
      console.log("⚠️  沒有找到 MEDDIC 分析結果");
      process.exit(0);
    }

    const analysis = analysisResult.rows[0];

    console.log("🎯 MEDDIC 分析結果:");
    console.log("=".repeat(80));
    console.log("\n📊 總分與狀態:");
    console.log(`   總分: ${analysis.overall_score}/100`);
    console.log(`   資格狀態: ${analysis.qualification_status}`);
    console.log(`   分析時間: ${analysis.created_at}`);

    console.log("\n🎯 各維度評分:");
    console.log(`   Metrics (指標): ${analysis.metrics_score}/100`);
    console.log(
      `   Economic Buyer (經濟決策者): ${analysis.economic_buyer_score}/100`
    );
    console.log(
      `   Decision Criteria (決策標準): ${analysis.decision_criteria_score}/100`
    );
    console.log(
      `   Decision Process (決策流程): ${analysis.decision_process_score}/100`
    );
    console.log(
      `   Identify Pain (痛點識別): ${analysis.identify_pain_score}/100`
    );
    console.log(`   Champion (內部支持者): ${analysis.champion_score}/100`);

    if (analysis.executive_summary) {
      console.log("\n📝 執行摘要:");
      console.log(`   ${analysis.executive_summary}`);
    }

    if (analysis.key_findings && analysis.key_findings.length > 0) {
      console.log("\n💡 關鍵發現:");
      for (const finding of analysis.key_findings.slice(0, 5)) {
        console.log(`   • ${finding}`);
      }
      if (analysis.key_findings.length > 5) {
        console.log(`   ... 還有 ${analysis.key_findings.length - 5} 個發現`);
      }
    }

    if (analysis.next_steps && analysis.next_steps.length > 0) {
      console.log("\n📋 下一步行動:");
      for (const step of analysis.next_steps.slice(0, 5)) {
        console.log(
          `   • ${step.action} ${step.owner ? `(負責人: ${step.owner})` : ""}`
        );
      }
    }

    if (analysis.risks && analysis.risks.length > 0) {
      console.log("\n⚠️  風險:");
      for (const risk of analysis.risks.slice(0, 5)) {
        console.log(`   • ${risk.risk} (嚴重度: ${risk.severity})`);
      }
    }

    if (analysis.alerts && analysis.alerts.length > 0) {
      console.log("\n🚨 警報:");
      for (const alert of analysis.alerts) {
        console.log(
          `   ${alert.severity === "Critical" ? "🔴" : alert.severity === "High" ? "🟠" : "🟡"} [${alert.type}] ${alert.message}`
        );
      }
    }

    if (analysis.coaching_notes) {
      console.log("\n👨‍🏫 教練建議:");
      console.log(`   ${analysis.coaching_notes.substring(0, 200)}...`);
    }

    // 顯示所有 Agent 的輸出
    if (analysis.agent_outputs) {
      console.log("\n\n🤖 所有 Agent 輸出:");
      console.log("=".repeat(80));

      const agents = analysis.agent_outputs;

      if (agents.context) {
        console.log("\n📍 Agent 1 - Context (情境分析):");
        console.log(`   決策者: ${agents.context.decision_maker || "未知"}`);
        console.log(
          `   決策者已確認: ${agents.context.decision_maker_confirmed ? "是" : "否"}`
        );
        console.log(`   緊急程度: ${agents.context.urgency_level || "未知"}`);
        console.log(`   截止日期: ${agents.context.deadline_date || "無"}`);
        console.log(
          `   客戶動機: ${agents.context.customer_motivation || "未知"}`
        );
        if (agents.context.barriers && agents.context.barriers.length > 0) {
          console.log(`   障礙: ${agents.context.barriers.join(", ")}`);
        }
      }

      if (agents.buyer) {
        console.log("\n💰 Agent 2 - Buyer (買方分析):");
        console.log(
          `   未成交原因: ${agents.buyer.not_closed_reason || "未知"}`
        );
        console.log(`   詳細說明: ${agents.buyer.not_closed_detail || "無"}`);
        console.log(
          `   客戶類型: ${agents.buyer.customer_type?.type || "未知"}`
        );
        if (agents.buyer.switch_concerns?.detected) {
          console.log(
            `   轉換顧慮: ${agents.buyer.switch_concerns.worry_about}`
          );
          console.log(`   複雜度: ${agents.buyer.switch_concerns.complexity}`);
        }
        console.log(`   現有系統: ${agents.buyer.current_system || "未知"}`);
      }

      if (agents.seller) {
        console.log("\n📈 Agent 3 - Seller (賣方分析):");
        console.log(`   進度分數: ${agents.seller.progress_score || 0}/100`);
        console.log(
          `   有明確要求: ${agents.seller.has_clear_ask ? "是" : "否"}`
        );
        console.log(
          `   推薦策略: ${agents.seller.recommended_strategy || "未知"}`
        );
        console.log(`   策略原因: ${agents.seller.strategy_reason || "無"}`);
        console.log(
          `   安全警報: ${agents.seller.safety_alert ? "⚠️ 是" : "✅ 否"}`
        );
      }

      if (agents.summary) {
        console.log("\n📋 Agent 4 - Summary (摘要):");
        console.log(`   SMS 簡訊: ${agents.summary.sms_text || "無"}`);
        console.log(`   痛點數量: ${agents.summary.pain_points?.length || 0}`);
        console.log(
          `   解決方案數量: ${agents.summary.solutions?.length || 0}`
        );
        console.log(
          `   iCHEF 行動項目: ${agents.summary.action_items?.ichef?.length || 0}`
        );
        console.log(
          `   客戶行動項目: ${agents.summary.action_items?.customer?.length || 0}`
        );
      }

      if (agents.crm) {
        console.log("\n💼 Agent 5 - CRM:");
        console.log(`   階段: ${agents.crm.stage_name || "未知"}`);
        console.log(`   階段信心: ${agents.crm.stage_confidence || "未知"}`);
        if (agents.crm.budget?.mentioned) {
          console.log(`   預算範圍: ${agents.crm.budget.range}`);
        }
        console.log(
          `   決策者數量: ${agents.crm.decision_makers?.length || 0}`
        );
        console.log(`   痛點數量: ${agents.crm.pain_points?.length || 0}`);
        console.log(
          `   時間線緊急度: ${agents.crm.timeline?.urgency || "未知"}`
        );
      }

      if (agents.coach) {
        console.log("\n👨‍🏫 Agent 6 - Coach:");
        console.log(
          `   警報觸發: ${agents.coach.alert_triggered ? "⚠️ 是" : "✅ 否"}`
        );
        if (agents.coach.alert_triggered) {
          console.log(`   警報類型: ${agents.coach.alert_type}`);
          console.log(`   嚴重度: ${agents.coach.alert_severity}`);
          console.log(`   警報訊息: ${agents.coach.alert_message}`);
        }
        console.log(`   優點數量: ${agents.coach.strengths?.length || 0}`);
        console.log(
          `   改進建議數量: ${agents.coach.improvements?.length || 0}`
        );
        console.log(
          `   偵測到的異議: ${agents.coach.detected_objections?.length || 0}`
        );
        console.log(
          `   需經理警示: ${agents.coach.manager_alert ? "⚠️ 是" : "否"}`
        );
      }
    }

    console.log(`\n${"=".repeat(80)}`);
    console.log("✅ 完成!");
  } catch (error) {
    console.error("\n❌ 查詢失敗:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// 執行
viewAnalysis();
