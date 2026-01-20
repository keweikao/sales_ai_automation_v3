/**
 * Performance Monitor
 * 監控 DAG Executor 的並行化效能與執行指標
 */

import type { BatchExecutionResult } from "./base-agent.js";

// ============================================================
// Performance Metrics Types
// ============================================================

export interface PerformanceMetrics {
  /** 總執行時間 (ms) */
  totalTimeMs: number;

  /** 並行化比例 (實際並行執行時間 / 理論序列執行時間) */
  parallelizationRatio: number;

  /** 加速百分比 (相對於序列執行的加速幅度) */
  speedupPercentage: number;

  /** 成功執行的 Agent 數量 */
  successCount: number;

  /** 失敗的 Agent 數量 */
  failureCount: number;

  /** 跳過的 Agent 數量 */
  skippedCount: number;

  /** 執行順序 */
  executionOrder: string[];

  /** 每個 Agent 的執行時間 */
  agentTimings: Record<string, number>;

  /** DAG 層級數量 */
  levelCount: number;

  /** 每層的並行度 */
  parallelismByLevel: Record<number, number>;
}

// ============================================================
// Performance Monitor Class
// ============================================================

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];

  /**
   * 記錄一次執行的效能指標
   * @param result - DAG 執行結果
   */
  recordExecution(result: BatchExecutionResult): void {
    // 計算加速百分比
    const sequentialTime = result.results.reduce(
      (sum, r) => sum + r.executionTimeMs,
      0
    );
    const speedupPercentage =
      sequentialTime > 0
        ? ((sequentialTime - result.totalTimeMs) / sequentialTime) * 100
        : 0;

    // 建立 Agent 執行時間映射
    const agentTimings: Record<string, number> = {};
    for (const r of result.results) {
      agentTimings[r.agentId] = r.executionTimeMs;
    }

    // 分析並行度 (需要額外資訊,暫時用簡化邏輯)
    const levelCount = this.estimateLevelCount(result.executionOrder);
    const parallelismByLevel = this.estimateParallelism(
      result.executionOrder,
      levelCount
    );

    const metrics: PerformanceMetrics = {
      totalTimeMs: result.totalTimeMs,
      parallelizationRatio: result.parallelizationRatio,
      speedupPercentage,
      successCount: result.successCount,
      failureCount: result.failureCount,
      skippedCount: result.skippedCount,
      executionOrder: result.executionOrder,
      agentTimings,
      levelCount,
      parallelismByLevel,
    };

    this.metrics.push(metrics);
  }

  /**
   * 取得最近一次執行的指標
   */
  getLatestMetrics(): PerformanceMetrics | undefined {
    return this.metrics.at(-1);
  }

  /**
   * 取得所有執行的統計摘要
   */
  getSummary(): {
    totalExecutions: number;
    averageTimeMs: number;
    averageParallelizationRatio: number;
    averageSpeedupPercentage: number;
    successRate: number;
  } {
    if (this.metrics.length === 0) {
      return {
        totalExecutions: 0,
        averageTimeMs: 0,
        averageParallelizationRatio: 0,
        averageSpeedupPercentage: 0,
        successRate: 0,
      };
    }

    const totalExecutions = this.metrics.length;
    const averageTimeMs =
      this.metrics.reduce((sum, m) => sum + m.totalTimeMs, 0) / totalExecutions;
    const averageParallelizationRatio =
      this.metrics.reduce((sum, m) => sum + m.parallelizationRatio, 0) /
      totalExecutions;
    const averageSpeedupPercentage =
      this.metrics.reduce((sum, m) => sum + m.speedupPercentage, 0) /
      totalExecutions;

    const totalAgents = this.metrics.reduce(
      (sum, m) => sum + m.successCount + m.failureCount,
      0
    );
    const successfulAgents = this.metrics.reduce(
      (sum, m) => sum + m.successCount,
      0
    );
    const successRate =
      totalAgents > 0 ? (successfulAgents / totalAgents) * 100 : 0;

    return {
      totalExecutions,
      averageTimeMs,
      averageParallelizationRatio,
      averageSpeedupPercentage,
      successRate,
    };
  }

  /**
   * 產生效能報告 (Markdown 格式)
   */
  generateReport(): string {
    if (this.metrics.length === 0) {
      return "No performance metrics recorded yet.";
    }

    const summary = this.getSummary();
    const latest = this.getLatestMetrics();

    let report = "# DAG Executor Performance Report\n\n";

    report += "## Summary Statistics\n\n";
    report += `- **Total Executions**: ${summary.totalExecutions}\n`;
    report += `- **Average Execution Time**: ${summary.averageTimeMs.toFixed(0)}ms\n`;
    report += `- **Average Parallelization Ratio**: ${summary.averageParallelizationRatio.toFixed(2)}x\n`;
    report += `- **Average Speedup**: ${summary.averageSpeedupPercentage.toFixed(1)}%\n`;
    report += `- **Success Rate**: ${summary.successRate.toFixed(1)}%\n\n`;

    if (latest) {
      report += "## Latest Execution\n\n";
      report += `- **Total Time**: ${latest.totalTimeMs}ms\n`;
      report += `- **Parallelization Ratio**: ${latest.parallelizationRatio.toFixed(2)}x\n`;
      report += `- **Speedup**: ${latest.speedupPercentage.toFixed(1)}%\n`;
      report += `- **Success**: ${latest.successCount}, Failure: ${latest.failureCount}, Skipped: ${latest.skippedCount}\n`;
      report += `- **Execution Order**: ${latest.executionOrder.join(" → ")}\n\n`;

      report += "### Agent Execution Times\n\n";
      report += "| Agent | Time (ms) |\n";
      report += "|-------|----------|\n";
      for (const [agent, time] of Object.entries(latest.agentTimings)) {
        report += `| ${agent} | ${time} |\n`;
      }
      report += "\n";

      report += "### Parallelism Analysis\n\n";
      report += `- **DAG Levels**: ${latest.levelCount}\n`;
      report += "- **Parallelism by Level**:\n";
      for (const [level, count] of Object.entries(latest.parallelismByLevel)) {
        report += `  - Level ${level}: ${count} agents\n`;
      }
    }

    return report;
  }

  /**
   * 輸出效能報告到 console (彩色輸出)
   */
  printReport(): void {
    const summary = this.getSummary();
    const latest = this.getLatestMetrics();

    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║  DAG Executor Performance Report                      ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    console.log("📊 Summary Statistics:\n");
    console.log(`  Total Executions: ${summary.totalExecutions}`);
    console.log(`  Average Time: ${summary.averageTimeMs.toFixed(0)}ms`);
    console.log(
      `  Average Parallelization: ${summary.averageParallelizationRatio.toFixed(2)}x`
    );
    console.log(
      `  Average Speedup: ${summary.averageSpeedupPercentage.toFixed(1)}%`
    );
    console.log(`  Success Rate: ${summary.successRate.toFixed(1)}%\n`);

    if (latest) {
      console.log("🎯 Latest Execution:\n");
      console.log(`  Total Time: ${latest.totalTimeMs}ms`);
      console.log(
        `  Parallelization Ratio: ${latest.parallelizationRatio.toFixed(2)}x`
      );
      console.log(`  Speedup: ${latest.speedupPercentage.toFixed(1)}%`);
      console.log(
        `  Success: ${latest.successCount}, Failure: ${latest.failureCount}, Skipped: ${latest.skippedCount}`
      );
      console.log(`  Execution Order: ${latest.executionOrder.join(" → ")}\n`);

      console.log("⏱️  Agent Execution Times:\n");
      for (const [agent, time] of Object.entries(latest.agentTimings)) {
        console.log(`  - ${agent}: ${time}ms`);
      }

      console.log("\n🔀 Parallelism Analysis:\n");
      console.log(`  DAG Levels: ${latest.levelCount}`);
      console.log("  Parallelism by Level:");
      for (const [level, count] of Object.entries(latest.parallelismByLevel)) {
        console.log(`    Level ${level}: ${count} agents`);
      }
    }

    console.log(
      "\n╚════════════════════════════════════════════════════════╝\n"
    );
  }

  /**
   * 清除所有記錄
   */
  clear(): void {
    this.metrics = [];
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  /**
   * 估算 DAG 層級數量 (簡化邏輯)
   */
  private estimateLevelCount(executionOrder: string[]): number {
    // 簡單假設:每個 Agent 按順序執行,層級數 = Agent 數量
    // 實際應該從 DAG 結構計算
    return Math.max(1, Math.ceil(executionOrder.length / 2));
  }

  /**
   * 估算每層的並行度 (簡化邏輯)
   */
  private estimateParallelism(
    executionOrder: string[],
    levelCount: number
  ): Record<number, number> {
    const result: Record<number, number> = {};

    // 簡單分配:平均分配到各層
    const agentsPerLevel = Math.ceil(executionOrder.length / levelCount);

    for (let i = 0; i < levelCount; i++) {
      result[i] = Math.min(
        agentsPerLevel,
        executionOrder.length - i * agentsPerLevel
      );
    }

    return result;
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * 建立 Performance Monitor 實例
 */
export function createPerformanceMonitor(): PerformanceMonitor {
  return new PerformanceMonitor();
}
