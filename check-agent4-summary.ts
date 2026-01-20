import { neon } from "@neondatabase/serverless";

const DATABASE_URL = "postgresql://neondb_owner:npg_ZkASu5qnc9vB@ep-sparkling-band-a130c5ks-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function checkAgent4Summary() {
  const sql = neon(DATABASE_URL);

  const analyses = await sql`
    SELECT agent_outputs
    FROM meddic_analyses
    WHERE conversation_id = (
      SELECT id FROM conversations WHERE case_number = '202601-IC019'
    )
    LIMIT 1
  `;

  if (analyses.length > 0) {
    const agentOutputs = analyses[0].agent_outputs as any;
    const agent4 = agentOutputs.agent4;

    console.log("=== Agent 4 Summary Agent 輸出 ===\n");
    console.log("markdown 欄位:");
    console.log(agent4.markdown);
    console.log("\n---\n");
    console.log("sms_text 欄位:");
    console.log(agent4.sms_text);
    console.log("\n---\n");
    console.log("character_count:", agent4.character_count);
  }
}

checkAgent4Summary().catch(console.error);
