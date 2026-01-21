#!/usr/bin/env node
import { firestore } from "./config";

interface FieldInfo {
  type: string;
  count: number;
  samples: any[];
}

function analyzeObject(obj: any, fields: Map<string, FieldInfo>, prefix = ""): void {
  if (!obj || typeof obj !== "object") return;

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (!fields.has(path)) {
      fields.set(path, { type: "unknown", count: 0, samples: [] });
    }

    const info = fields.get(path)!;
    info.count++;

    if (value === null || value === undefined) {
      info.type = "null";
    } else if (Array.isArray(value)) {
      info.type = "array";
      if (info.samples.length < 2) info.samples.push(value.slice(0, 2));
      if (value[0] && typeof value[0] === "object") {
        analyzeObject(value[0], fields, `${path}[0]`);
      }
    } else if (typeof value === "object") {
      if (value._seconds) {
        info.type = "timestamp";
        if (info.samples.length < 2) {
          info.samples.push(new Date(value._seconds * 1000).toISOString());
        }
      } else {
        info.type = "object";
        analyzeObject(value, fields, path);
      }
    } else {
      info.type = typeof value;
      if (info.samples.length < 3 && !info.samples.includes(value)) {
        info.samples.push(value);
      }
    }
  }
}

async function main() {
  const snapshot = await firestore.collection("cases").limit(50).get();
  const fields = new Map<string, FieldInfo>();
  const samples: any[] = [];

  for (const doc of snapshot.docs) {
    if (samples.length < 2) samples.push({ id: doc.id, data: doc.data() });
    analyzeObject(doc.data(), fields);
  }

  console.log("=".repeat(90));
  console.log(`📊 Firestore Schema 分析 (${snapshot.size} 筆)`);
  console.log("=".repeat(90));
  console.log(`\n${"欄位路徑".padEnd(55)} ${"類型".padEnd(12)} ${"出現率".padEnd(10)} 範例`);
  console.log("-".repeat(110));

  const sorted = Array.from(fields.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  for (const [path, info] of sorted) {
    const rate = `${((info.count / snapshot.size) * 100).toFixed(0)}%`;
    const sample = String(info.samples[0] || "").substring(0, 35);
    console.log(`${path.padEnd(55)} ${info.type.padEnd(12)} ${rate.padEnd(10)} ${sample}`);
  }

  // 關鍵欄位檢查
  console.log("\n" + "=".repeat(90));
  console.log("🔑 關鍵欄位檢查");
  console.log("=".repeat(90));

  const keys = [
    "customerId", "customerName", "customerPhone", "customerEmail",
    "salesRepSlackId", "salesRepName", "salesRepEmail",
    "uploadedBy", "uploadedByName", "uploadedBySlackName",
    "unit", "audio", "audio.gcsPath", "demoMeta", "analysis.agents"
  ];

  for (const k of keys) {
    const i = fields.get(k);
    console.log(i
      ? `✅ ${k.padEnd(35)} ${i.type.padEnd(12)} (${((i.count/snapshot.size)*100).toFixed(0)}%) → ${i.samples[0]}`
      : `❌ ${k.padEnd(35)} 未找到`
    );
  }

  // 搜尋 Slack 相關
  console.log("\n" + "=".repeat(90));
  console.log("🔎 Slack/業務相關欄位");
  console.log("=".repeat(90));

  for (const [path, info] of sorted) {
    if (path.toLowerCase().match(/slack|rep|upload|user/)) {
      console.log(`  ${path.padEnd(45)} ${info.type.padEnd(12)} ${info.samples[0]}`);
    }
  }

  // 範例文檔
  console.log("\n" + "=".repeat(90));
  console.log("📄 範例文檔");
  console.log("=".repeat(90));
  console.log(JSON.stringify(samples[0], null, 2));

  console.log("\n✅ 完成! 請根據結果更新遷移映射邏輯\n");
}

main().catch(console.error);
