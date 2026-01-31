/**
 * 通過 API 查詢 M 開頭案件編號的對話狀態
 * Usage: API_TOKEN=xxx bun run scripts/check-m-cases-api.ts
 */

const serverUrl = "https://sales-ai-server.salesaiautomationv3.workers.dev";
const token = process.env.API_TOKEN;

if (!token) {
  console.error("❌ 請設定 API_TOKEN 環境變數");
  process.exit(1);
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
  console.log("=== 查詢所有對話以找出 M 開頭案件 ===\n");

  // 獲取所有對話
  let allConversations: any[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const result = await fetchConversations(limit, offset);
    const items = result.items || [];
    allConversations = [...allConversations, ...items];

    console.log(`已獲取 ${allConversations.length} 個對話...`);

    if (items.length < limit) {
      break;
    }
    offset += limit;
  }

  console.log(`\n總共 ${allConversations.length} 個對話\n`);

  // 過濾 M 開頭的案件（檢查 caseNumber 或 title）
  // 注意：API 可能不返回 legacyCaseId，我們需要檢查其他欄位
  const mCases = allConversations.filter((c) => {
    // 檢查 caseNumber 是否包含 M
    if (c.caseNumber?.includes("-M") || c.caseNumber?.startsWith("M")) {
      return true;
    }
    // 檢查 title 是否包含特定關鍵字
    if (c.title?.includes("M-") || c.title?.match(/^M\d+/)) {
      return true;
    }
    return false;
  });

  if (mCases.length === 0) {
    console.log("❌ 沒有找到 M 開頭的案件");
    console.log("\n顯示最近 10 個對話作為參考：");
    for (const c of allConversations.slice(0, 10)) {
      console.log(`  ${c.caseNumber} - ${c.status} - ${c.title}`);
    }
    return;
  }

  console.log(`找到 ${mCases.length} 個 M 開頭案件\n`);

  // 按狀態分類
  const byStatus: Record<string, any[]> = {};
  for (const c of mCases) {
    const status = c.status || "unknown";
    if (!byStatus[status]) {
      byStatus[status] = [];
    }
    byStatus[status].push(c);
  }

  // 顯示統計
  console.log("=== 狀態統計 ===");
  for (const [status, cases] of Object.entries(byStatus)) {
    console.log(`${status}: ${cases.length} 個`);
  }

  // 顯示未完成的案件詳情
  const incompleteStatuses = ["pending", "failed", "transcribing"];
  const incomplete = mCases.filter((c) =>
    incompleteStatuses.includes(c.status || "")
  );

  if (incomplete.length > 0) {
    console.log("\n=== 未完成的案件詳情 ===");
    for (const c of incomplete) {
      console.log(`\n案件: ${c.caseNumber}`);
      console.log(`  狀態: ${c.status}`);
      console.log(`  標題: ${c.title}`);
      console.log(`  建立: ${c.createdAt}`);
    }

    // 輸出可重試的案件編號
    console.log("\n=== 可重試的案件編號 ===");
    for (const c of incomplete) {
      console.log(c.caseNumber);
    }
  } else {
    console.log("\n✅ 所有 M 開頭案件都已完成處理");
  }
}

main().catch(console.error);
