// scripts/migration/report.ts

import type { MigrationResult, MigrationStats } from "./types";

/**
 * 格式化統計資料
 */
function formatStats(name: string, stats: MigrationStats): string {
  const successRate =
    stats.total > 0
      ? ((stats.success / stats.total) * 100).toFixed(1)
      : "100.0";

  return [
    `${name}:`,
    `  Total:   ${stats.total}`,
    `  Success: ${stats.success} (${successRate}%)`,
    `  Failed:  ${stats.failed}`,
    `  Skipped: ${stats.skipped}`,
    "",
  ].join("\n");
}

/**
 * 生成遷移報告
 */
export function generateReport(result: MigrationResult): string {
  const lines: string[] = [];

  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push(
    "                    V2 → V3 Migration Report                    "
  );
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push(`Started:   ${result.startedAt.toISOString()}`);
  lines.push(`Completed: ${result.completedAt.toISOString()}`);
  lines.push(`Duration:  ${result.duration.toFixed(2)} seconds`);
  lines.push("");
  lines.push("───────────────────────────────────────────────────────────────");
  lines.push(
    "                         Summary                                "
  );
  lines.push("───────────────────────────────────────────────────────────────");
  lines.push("");

  lines.push(formatStats("Leads → Opportunities", result.leads));
  lines.push(formatStats("Conversations", result.conversations));
  lines.push(formatStats("MEDDIC Analyses", result.meddicAnalyses));
  lines.push(formatStats("Audio Files", result.audioFiles));

  lines.push("");
  lines.push("───────────────────────────────────────────────────────────────");
  lines.push(
    "                         Errors                                 "
  );
  lines.push("───────────────────────────────────────────────────────────────");
  lines.push("");

  const allErrors = [
    ...result.leads.errors.map((e) => `[Lead] ${e.id}: ${e.error}`),
    ...result.conversations.errors.map(
      (e) => `[Conversation] ${e.id}: ${e.error}`
    ),
    ...result.meddicAnalyses.errors.map((e) => `[MEDDIC] ${e.id}: ${e.error}`),
    ...result.audioFiles.errors.map((e) => `[Audio] ${e.id}: ${e.error}`),
  ];

  if (allErrors.length === 0) {
    lines.push("No errors!");
  } else {
    for (const error of allErrors.slice(0, 50)) {
      lines.push(`  • ${error}`);
    }
    if (allErrors.length > 50) {
      lines.push(`  ... and ${allErrors.length - 50} more errors`);
    }
  }

  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════════");

  return lines.join("\n");
}

/**
 * 儲存報告到檔案
 */
export async function saveReport(
  result: MigrationResult,
  filename?: string
): Promise<string> {
  const report = generateReport(result);
  const reportPath =
    filename ||
    `migration-report-${result.startedAt.toISOString().replace(/[:.]/g, "-")}.txt`;

  await Bun.write(reportPath, report);
  console.log(`\n📄 Report saved to: ${reportPath}`);

  return reportPath;
}
