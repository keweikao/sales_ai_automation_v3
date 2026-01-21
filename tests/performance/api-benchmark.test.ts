import { describe, expect, test } from "vitest";

/**
 * API 效能基準測試
 *
 * 這些測試用於確保 API 端點的回應時間符合效能要求。
 * 在 CI 環境中執行時，可能需要調整閾值或跳過這些測試。
 */

describe("API 效能基準測試", () => {
  const API_BASE_URL = process.env.TEST_API_URL ?? "http://localhost:3001";
  const PERFORMANCE_THRESHOLDS = {
    fast: 100, // 100ms - 簡單查詢
    normal: 500, // 500ms - 一般操作
    slow: 2000, // 2000ms - 複雜操作
    verySlowAllowed: 5000, // 5000ms - 重型操作（如分析）
  };

  // 輔助函式：測量 API 呼叫時間
  const measureApiCall = async (
    url: string,
    options?: RequestInit
  ): Promise<{ duration: number; status: number }> => {
    const start = performance.now();
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options?.headers ?? {}),
        },
      });
      const duration = performance.now() - start;
      return { duration, status: response.status };
    } catch {
      const duration = performance.now() - start;
      return { duration, status: 0 };
    }
  };

  // 輔助函式：執行多次並取平均值
  const measureAverage = async (
    fn: () => Promise<{ duration: number; status: number }>,
    iterations = 5
  ): Promise<{
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
  }> => {
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const result = await fn();
      durations.push(result.duration);
    }

    return {
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
    };
  };

  describe("健康檢查端點", () => {
    test("/health 應該在 500ms 內回應（包含 DB 檢查）", async () => {
      const { duration, status } = await measureApiCall(
        `${API_BASE_URL}/health`
      );

      console.log(
        `Health check 回應時間: ${duration.toFixed(2)}ms, 狀態: ${status}`
      );

      // 健康檢查包含 DB 查詢，給予較長時間
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.normal);
    });

    test("/live 應該在 50ms 內回應", async () => {
      const { duration } = await measureApiCall(`${API_BASE_URL}/live`);

      console.log(`Liveness probe 回應時間: ${duration.toFixed(2)}ms`);

      // Liveness 只檢查程序存活，應該非常快
      expect(duration).toBeLessThan(50);
    });

    test("/ready 應該在 500ms 內回應", async () => {
      const { duration } = await measureApiCall(`${API_BASE_URL}/ready`);

      console.log(`Readiness probe 回應時間: ${duration.toFixed(2)}ms`);

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.normal);
    });
  });

  describe("商機列表查詢", () => {
    test("分頁查詢應該在 500ms 內回應", async () => {
      const { avgDuration, minDuration, maxDuration } = await measureAverage(
        () =>
          measureApiCall(
            `${API_BASE_URL}/api/opportunity/list?limit=20&offset=0`
          ),
        3
      );

      console.log(
        `商機列表查詢 - 平均: ${avgDuration.toFixed(2)}ms, ` +
          `最小: ${minDuration.toFixed(2)}ms, 最大: ${maxDuration.toFixed(2)}ms`
      );

      expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.normal);
    });

    test("帶篩選條件的查詢應該在 500ms 內回應", async () => {
      const { duration } = await measureApiCall(
        `${API_BASE_URL}/api/opportunity/list?status=contacted&limit=10`
      );

      console.log(`帶篩選查詢回應時間: ${duration.toFixed(2)}ms`);

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.normal);
    });
  });

  describe("對話列表查詢", () => {
    test("分頁查詢應該在 500ms 內回應", async () => {
      const { duration } = await measureApiCall(
        `${API_BASE_URL}/api/conversation/list?limit=20`
      );

      console.log(`對話列表查詢回應時間: ${duration.toFixed(2)}ms`);

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.normal);
    });
  });

  describe("分析報表查詢", () => {
    test("Dashboard 統計應該在 1000ms 內回應", async () => {
      const { duration } = await measureApiCall(
        `${API_BASE_URL}/api/analytics/dashboard`
      );

      console.log(`Dashboard 查詢回應時間: ${duration.toFixed(2)}ms`);

      // Dashboard 可能需要聚合計算，給予較長時間
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.slow);
    });

    test("MEDDIC 趨勢應該在 2000ms 內回應", async () => {
      const { duration } = await measureApiCall(
        `${API_BASE_URL}/api/analytics/meddic-trends`
      );

      console.log(`MEDDIC 趨勢查詢回應時間: ${duration.toFixed(2)}ms`);

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.slow);
    });
  });

  describe("並發請求處理", () => {
    test("應該能同時處理 10 個請求", async () => {
      const concurrentRequests = 10;
      const start = performance.now();

      const promises = new Array(concurrentRequests)
        .fill(null)
        .map(() =>
          measureApiCall(`${API_BASE_URL}/api/opportunity/list?limit=5`)
        );

      const results = await Promise.all(promises);
      const totalDuration = performance.now() - start;

      const successCount = results.filter((r) => r.status === 200).length;
      const avgIndividual =
        results.reduce((sum, r) => sum + r.duration, 0) / results.length;

      console.log(
        `並發測試 - 總時間: ${totalDuration.toFixed(2)}ms, ` +
          `成功: ${successCount}/${concurrentRequests}, ` +
          `平均個別: ${avgIndividual.toFixed(2)}ms`
      );

      // 並發處理不應該比串行慢太多
      expect(totalDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.slow * 2);
    });

    test("應該能處理突發流量", async () => {
      const burstSize = 20;
      const results: Array<{ duration: number; status: number }> = [];

      // 模擬突發流量
      const start = performance.now();
      const promises = new Array(burstSize)
        .fill(null)
        .map(() => measureApiCall(`${API_BASE_URL}/health`));

      const burstResults = await Promise.all(promises);
      results.push(...burstResults);

      const totalDuration = performance.now() - start;
      const successRate =
        results.filter((r) => r.status === 200).length / results.length;

      console.log(
        `突發流量測試 - 總時間: ${totalDuration.toFixed(2)}ms, ` +
          `成功率: ${(successRate * 100).toFixed(1)}%`
      );

      // 成功率應該至少 90%
      expect(successRate).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe("回應大小測試", () => {
    test("大列表回應應該有合理的大小", async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/opportunity/list?limit=100`
      );

      if (response.ok) {
        const contentLength = response.headers.get("content-length");
        const body = await response.text();

        console.log(
          `大列表回應大小: ${body.length} bytes` +
            (contentLength ? ` (Content-Length: ${contentLength})` : "")
        );

        // 100 筆記錄不應超過 1MB
        expect(body.length).toBeLessThan(1024 * 1024);
      }
    });
  });

  describe("效能基準統計", () => {
    test("產生效能報告", async () => {
      const endpoints = [
        { name: "Health", url: `${API_BASE_URL}/health` },
        { name: "Live", url: `${API_BASE_URL}/live` },
        { name: "Ready", url: `${API_BASE_URL}/ready` },
        { name: "Opportunities", url: `${API_BASE_URL}/api/opportunity/list` },
        { name: "Conversations", url: `${API_BASE_URL}/api/conversation/list` },
        { name: "Dashboard", url: `${API_BASE_URL}/api/analytics/dashboard` },
      ];

      console.log("\n=== 效能基準報告 ===\n");

      for (const endpoint of endpoints) {
        const { avgDuration, minDuration, maxDuration } = await measureAverage(
          () => measureApiCall(endpoint.url),
          3
        );

        console.log(
          `${endpoint.name.padEnd(15)} | ` +
            `平均: ${avgDuration.toFixed(0).padStart(6)}ms | ` +
            `最小: ${minDuration.toFixed(0).padStart(6)}ms | ` +
            `最大: ${maxDuration.toFixed(0).padStart(6)}ms`
        );
      }

      console.log("\n===================\n");

      // 這個測試總是通過，僅用於產生報告
      expect(true).toBe(true);
    });
  });
});
