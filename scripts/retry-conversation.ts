/**
 * Retry a failed conversation
 * Usage: SERVICE_API_TOKEN=xxx bun run scripts/retry-conversation.ts 202601-IC013
 */

const caseNumber = process.argv[2] || "202601-IC013";
const serverUrl = "https://sales-ai-server.salesaiautomationv3.workers.dev";
const token = process.env.SERVICE_API_TOKEN;

if (!token) {
  console.error("❌ 請設定 SERVICE_API_TOKEN 環境變數");
  console.error("   或在 Cloudflare Dashboard 查看 queue-worker 的 secrets");
  process.exit(1);
}

console.log(`重試對話: ${caseNumber}`);
console.log(`Server: ${serverUrl}`);

const response = await fetch(`${serverUrl}/rpc/conversation.retry`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  },
  body: JSON.stringify({ caseNumber }),
});

const text = await response.text();
console.log(`Status: ${response.status}`);
console.log(`Response: ${text}`);
