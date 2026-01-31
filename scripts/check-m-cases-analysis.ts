/**
 * 檢查 M 開頭案件的分析狀態
 * Usage: API_TOKEN=xxx bun run scripts/check-m-cases-analysis.ts
 */

const serverUrl = "https://sales-ai-server.salesaiautomationv3.workers.dev";
const token = process.env.API_TOKEN;

if (!token) {
  console.error("❌ 請設定 API_TOKEN 環境變數");
  process.exit(1);
}

async function getConversationDetail(conversationId: string) {
  const response = await fetch(`${serverUrl}/rpc/conversations/get`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ json: { conversationId } }),
  });

  if (!response.ok) {
    return null;
  }

  const result = await response.json();
  return result.json || result;
}

async function fetchConversations(limit = 100, offset = 0) {
  const response = await fetch(`${serverUrl}/rpc/conversations/list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ json: { limit, offset } }),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  return result.json || result;
}

async function main() {
  console.log("=== 檢查 M 開頭案件的分析狀態 ===\n");

  // 獲取對話列表
  const result = await fetchConversations(100, 0);
  const allConversations = result.items || [];

  // 過濾 M 開頭的案件
  const mCases = allConversations.filter((c: any) => {
    return c.caseNumber?.startsWith("M");
  });

  console.log(`找到 ${mCases.length} 個 M 開頭案件\n`);

  // 檢查每個案件的詳細狀態
  const needsAnalysis: any[] = [];
  const hasAnalysis: any[] = [];
  const noTranscript: any[] = [];

  for (const c of mCases) {
    const detail = await getConversationDetail(c.id);
    if (!detail) {
      console.log(`⚠️  無法獲取 ${c.caseNumber} 詳情`);
      continue;
    }

    const hasTranscript = detail.transcript && detail.transcript.fullText;
    const hasAnalysisResult = detail.analysis != null;

    if (!hasTranscript) {
      noTranscript.push({ ...c, detail });
    } else if (!hasAnalysisResult) {
      needsAnalysis.push({ ...c, detail });
    } else {
      hasAnalysis.push({ ...c, detail });
    }
  }

  // 顯示統計
  console.log("=== 狀態統計 ===");
  console.log(`已有分析: ${hasAnalysis.length} 個`);
  console.log(`有轉錄但無分析: ${needsAnalysis.length} 個`);
  console.log(`無轉錄: ${noTranscript.length} 個`);

  // 顯示需要分析的案件
  if (needsAnalysis.length > 0) {
    console.log("\n=== 需要分析的案件 ===");
    for (const c of needsAnalysis) {
      console.log(`\n案件: ${c.caseNumber}`);
      console.log(`  ID: ${c.id}`);
      console.log(`  標題: ${c.title}`);
      console.log(`  狀態: ${c.status}`);
      console.log(`  轉錄長度: ${c.detail.transcript?.fullText?.length || 0} 字`);
    }

    console.log("\n=== 需要分析的案件 ID ===");
    for (const c of needsAnalysis) {
      console.log(`${c.caseNumber}: ${c.id}`);
    }
  }

  // 顯示無轉錄的案件
  if (noTranscript.length > 0) {
    console.log("\n=== 無轉錄的案件 ===");
    for (const c of noTranscript) {
      console.log(`${c.caseNumber}: ${c.title} (狀態: ${c.status})`);
    }
  }
}

main().catch(console.error);
