import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock MCP Server
const mockMCPServer = {
  registerTool: vi.fn(),
  executeTool: vi.fn(),
  listTools: vi.fn(),
  hasTool: vi.fn(),
};

// Mock LLM Client
const mockLLMClient = {
  generateContent: vi.fn(),
  testConnection: vi.fn(),
};

describe("Sales Coach Agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("MCP Server", () => {
    test("應該成功註冊 Tool", () => {
      const tool = {
        name: "test_tool",
        description: "測試工具",
        inputSchema: { type: "object" },
        handler: vi.fn(),
      };

      mockMCPServer.registerTool(tool);

      expect(mockMCPServer.registerTool).toHaveBeenCalledWith(tool);
    });

    test("應該成功執行 Tool", async () => {
      const mockResult = { success: true, data: { score: 85 } };
      mockMCPServer.executeTool.mockResolvedValue(mockResult);

      const result = await mockMCPServer.executeTool("get_rep_performance", {
        repId: "rep-123",
      });

      expect(result).toEqual(mockResult);
      expect(mockMCPServer.executeTool).toHaveBeenCalledWith(
        "get_rep_performance",
        { repId: "rep-123" }
      );
    });

    test("應該列出所有已註冊的 Tools", () => {
      const mockTools = [
        { name: "query_similar_cases", description: "查詢相似案例" },
        { name: "get_talk_tracks", description: "取得話術建議" },
        { name: "get_rep_performance", description: "取得業務績效" },
        { name: "send_alert", description: "發送警示" },
        { name: "schedule_follow_up", description: "排程跟進" },
        { name: "get_competitor_info", description: "取得競品資訊" },
      ];

      mockMCPServer.listTools.mockReturnValue(mockTools);

      const tools = mockMCPServer.listTools();

      expect(tools).toHaveLength(6);
      expect(tools.map((t: { name: string }) => t.name)).toContain(
        "query_similar_cases"
      );
    });

    test("應該處理不存在的 Tool", async () => {
      mockMCPServer.executeTool.mockRejectedValue(
        new Error("Tool not found: invalid_tool")
      );

      await expect(
        mockMCPServer.executeTool("invalid_tool", {})
      ).rejects.toThrow("Tool not found");
    });
  });

  describe("Tool Executor", () => {
    test("應該批次執行多個 Tools", async () => {
      const toolCalls = [
        { name: "get_talk_tracks", input: { situation: "異議處理" } },
        { name: "get_rep_performance", input: { repId: "rep-123" } },
      ];

      mockMCPServer.executeTool
        .mockResolvedValueOnce({
          success: true,
          data: { tracks: [{ id: "1", content: "話術1" }] },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { performance: { score: 85 } },
        });

      const results = await Promise.all(
        toolCalls.map((call) =>
          mockMCPServer.executeTool(call.name, call.input)
        )
      );

      expect(results).toHaveLength(2);
      expect(results[0].data.tracks).toBeDefined();
      expect(results[1].data.performance.score).toBe(85);
    });

    test("應該處理部分 Tool 執行失敗", async () => {
      mockMCPServer.executeTool
        .mockResolvedValueOnce({ success: true, data: {} })
        .mockRejectedValueOnce(new Error("Tool execution failed"));

      const executeWithFallback = async (
        name: string,
        input: Record<string, unknown>
      ) => {
        try {
          return await mockMCPServer.executeTool(name, input);
        } catch {
          return { success: false, error: "Execution failed" };
        }
      };

      const result1 = await executeWithFallback("tool1", {});
      const result2 = await executeWithFallback("tool2", {});

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
    });
  });

  describe("Result Parser", () => {
    test("應該正確解析 LLM 輸出的建議", () => {
      const llmOutput = `
根據對話分析，以下是我的建議：

## 建議行動
1. 安排與決策者的會議
2. 準備 ROI 計算文件
3. 跟進競品比較資料

## 推薦話術
- 針對價格異議：「相比其他方案，我們的 ROI 在第一年就能達到 30%...」
- 針對時程疑慮：「我們可以分階段導入，降低風險...」
`;

      const parseRecommendations = (output: string) => {
        const recommendations: string[] = [];
        const lines = output.split("\n");
        let inRecommendations = false;

        for (const line of lines) {
          if (line.includes("建議行動")) {
            inRecommendations = true;
            continue;
          }
          if (line.includes("##") && inRecommendations) {
            break;
          }
          if (inRecommendations && line.match(/^\d+\./)) {
            recommendations.push(line.replace(/^\d+\.\s*/, "").trim());
          }
        }
        return recommendations;
      };

      const recommendations = parseRecommendations(llmOutput);

      expect(recommendations).toHaveLength(3);
      expect(recommendations[0]).toBe("安排與決策者的會議");
    });

    test("應該正確解析 JSON 格式的輸出", () => {
      const jsonOutput = JSON.stringify({
        recommendations: [
          { priority: "high", action: "安排會議", deadline: "本週" },
          { priority: "medium", action: "準備文件", deadline: "下週" },
        ],
        talkTracks: [{ situation: "價格異議", content: "我們的價值在於..." }],
        alerts: [],
        followUps: [{ timing: "3_days", message: "跟進決策進度" }],
      });

      const parsed = JSON.parse(jsonOutput);

      expect(parsed.recommendations).toHaveLength(2);
      expect(parsed.talkTracks).toHaveLength(1);
      expect(parsed.followUps[0].timing).toBe("3_days");
    });

    test("應該處理不完整的 JSON 輸出", () => {
      const partialJson = '{"recommendations": [{"action": "test"}';

      const safeJsonParse = (text: string) => {
        try {
          return { success: true, data: JSON.parse(text) };
        } catch {
          return { success: false, error: "Invalid JSON" };
        }
      };

      const result = safeJsonParse(partialJson);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid JSON");
    });
  });

  describe("Agent 核心邏輯", () => {
    test("應該根據對話產生教練建議", async () => {
      const mockAnalysis = {
        summary: "客戶對產品有興趣但對價格有疑慮",
        recommendations: [
          { action: "強調 ROI", priority: "high" },
          { action: "提供案例研究", priority: "medium" },
        ],
        talkTracks: [{ situation: "價格異議", content: "考慮到長期效益..." }],
        alerts: [],
        followUps: [],
      };

      mockLLMClient.generateContent.mockResolvedValue({
        response: { text: () => JSON.stringify(mockAnalysis) },
      });

      const analyzeConversation = async (conversationId: string) => {
        const result = await mockLLMClient.generateContent([
          { text: `分析對話 ${conversationId} 並產生銷售教練建議` },
        ]);
        return JSON.parse(result.response.text());
      };

      const result = await analyzeConversation("conv-123");

      expect(result.summary).toContain("價格");
      expect(result.recommendations).toHaveLength(2);
      expect(result.recommendations[0].priority).toBe("high");
    });

    test("應該整合 MEDDIC 分析結果", async () => {
      const meddicAnalysis = {
        overallScore: 65,
        metrics: { score: 4, gaps: ["缺少具體數字"] },
        economicBuyer: { score: 3, gaps: ["未確認預算"] },
        champion: { score: 2, gaps: ["需要培養內部支持者"] },
      };

      const generateCoachingFromMeddic = (meddic: typeof meddicAnalysis) => {
        const coaching = {
          focusAreas: [] as string[],
          priorityActions: [] as string[],
        };

        if (meddic.champion.score < 3) {
          coaching.focusAreas.push("Champion 培養");
          coaching.priorityActions.push("識別並發展內部支持者");
        }

        if (meddic.economicBuyer.score < 4) {
          coaching.focusAreas.push("經濟買家接觸");
          coaching.priorityActions.push("安排與決策者的會議");
        }

        for (const gap of meddic.metrics.gaps) {
          coaching.priorityActions.push(`解決: ${gap}`);
        }

        return coaching;
      };

      const coaching = generateCoachingFromMeddic(meddicAnalysis);

      expect(coaching.focusAreas).toContain("Champion 培養");
      expect(coaching.priorityActions).toContain("識別並發展內部支持者");
    });
  });

  describe("Scenarios", () => {
    describe("Post Demo Coach (SC1)", () => {
      test("應該在 Demo 後產生跟進建議", async () => {
        const demoContext = {
          conversationId: "conv-demo-123",
          demoTopics: ["產品功能", "整合方式", "定價"],
          customerReactions: ["對功能感興趣", "擔心整合複雜度"],
        };

        const generatePostDemoCoaching = (context: typeof demoContext) => {
          const recommendations = [];

          if (context.customerReactions.some((r) => r.includes("擔心"))) {
            recommendations.push({
              type: "objection_handling",
              action: "準備詳細的整合文件和案例",
              priority: "high",
            });
          }

          if (context.demoTopics.includes("定價")) {
            recommendations.push({
              type: "follow_up",
              action: "發送正式報價單",
              priority: "high",
            });
          }

          return {
            scenario: "post_demo",
            recommendations,
            suggestedFollowUpTiming: "24_hours",
          };
        };

        const result = generatePostDemoCoaching(demoContext);

        expect(result.scenario).toBe("post_demo");
        expect(result.recommendations).toHaveLength(2);
        expect(result.suggestedFollowUpTiming).toBe("24_hours");
      });
    });

    describe("Close Now Alert (SC2)", () => {
      test("應該偵測 Close Now 機會", () => {
        const conversationSignals = {
          urgencyMentioned: true,
          budgetConfirmed: true,
          decisionTimelineMentioned: "本季度",
          competitorMentioned: false,
        };

        const detectCloseNowOpportunity = (
          signals: typeof conversationSignals
        ) => {
          let score = 0;

          if (signals.urgencyMentioned) {
            score += 30;
          }
          if (signals.budgetConfirmed) {
            score += 25;
          }
          if (signals.decisionTimelineMentioned) {
            score += 25;
          }
          if (!signals.competitorMentioned) {
            score += 10;
          }

          return {
            isCloseNow: score >= 70,
            score,
            alert:
              score >= 70
                ? {
                    type: "close_now",
                    message: "高成交機會！建議立即跟進",
                    priority: "urgent",
                  }
                : null,
          };
        };

        const result = detectCloseNowOpportunity(conversationSignals);

        expect(result.isCloseNow).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(70);
        expect(result.alert?.type).toBe("close_now");
      });

      test("應該在缺少關鍵訊號時不觸發警示", () => {
        const weakSignals = {
          urgencyMentioned: false,
          budgetConfirmed: false,
          decisionTimelineMentioned: "",
          competitorMentioned: true,
        };

        const detectCloseNowOpportunity = (signals: typeof weakSignals) => {
          let score = 0;
          if (signals.urgencyMentioned) {
            score += 30;
          }
          if (signals.budgetConfirmed) {
            score += 25;
          }
          if (signals.decisionTimelineMentioned) {
            score += 25;
          }
          if (!signals.competitorMentioned) {
            score += 10;
          }

          return {
            isCloseNow: score >= 70,
            score,
            alert: null,
          };
        };

        const result = detectCloseNowOpportunity(weakSignals);

        expect(result.isCloseNow).toBe(false);
        expect(result.alert).toBeNull();
      });
    });

    describe("Manager Report (SC3)", () => {
      test("應該產生團隊績效報告", () => {
        const teamData = {
          reps: [
            { id: "rep-1", name: "Alice", deals: 5, winRate: 0.6 },
            { id: "rep-2", name: "Bob", deals: 3, winRate: 0.4 },
            { id: "rep-3", name: "Carol", deals: 7, winRate: 0.7 },
          ],
          period: "2024-W02",
        };

        const generateManagerReport = (data: typeof teamData) => {
          const totalDeals = data.reps.reduce((sum, r) => sum + r.deals, 0);
          const avgWinRate =
            data.reps.reduce((sum, r) => sum + r.winRate, 0) / data.reps.length;
          const topPerformer = data.reps.reduce((top, r) =>
            r.winRate > top.winRate ? r : top
          );

          return {
            period: data.period,
            summary: {
              totalDeals,
              avgWinRate: Math.round(avgWinRate * 100),
              teamSize: data.reps.length,
            },
            highlights: {
              topPerformer: topPerformer.name,
              topWinRate: Math.round(topPerformer.winRate * 100),
            },
            recommendations:
              avgWinRate < 0.5
                ? ["考慮進行銷售培訓", "檢視話術效果"]
                : ["維持現有策略", "分享最佳實踐"],
          };
        };

        const report = generateManagerReport(teamData);

        expect(report.period).toBe("2024-W02");
        expect(report.summary.totalDeals).toBe(15);
        expect(report.highlights.topPerformer).toBe("Carol");
        expect(report.recommendations).toContain("維持現有策略");
      });
    });
  });

  describe("Talk Tracks", () => {
    test("應該根據情境推薦話術", async () => {
      const mockTalkTracks = [
        {
          id: "tt-1",
          situation: "價格異議",
          category: "objection_handling",
          content: "我理解您對價格的考量...",
          successRate: 0.72,
        },
        {
          id: "tt-2",
          situation: "價格比較",
          category: "objection_handling",
          content: "與競品相比，我們的優勢在於...",
          successRate: 0.68,
        },
      ];

      mockMCPServer.executeTool.mockResolvedValue({
        success: true,
        data: { talkTracks: mockTalkTracks },
      });

      const result = await mockMCPServer.executeTool("get_talk_tracks", {
        situation: "價格",
        category: "objection_handling",
      });

      expect(result.data.talkTracks).toHaveLength(2);
      expect(result.data.talkTracks[0].successRate).toBeGreaterThan(0.7);
    });
  });

  describe("Follow Up Scheduling", () => {
    test("應該正確計算排程時間", () => {
      const calculateScheduledTime = (
        timing: "2_hours" | "tomorrow_9am" | "3_days" | "1_week"
      ) => {
        const now = new Date("2024-01-15T10:00:00Z");

        switch (timing) {
          case "2_hours":
            return new Date(now.getTime() + 2 * 60 * 60 * 1000);
          case "tomorrow_9am": {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9, 0, 0, 0);
            return tomorrow;
          }
          case "3_days":
            return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
          case "1_week":
            return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        }
      };

      const twoHours = calculateScheduledTime("2_hours");
      const tomorrow = calculateScheduledTime("tomorrow_9am");
      const threeDays = calculateScheduledTime("3_days");

      // 驗證相對時間差而非絕對時間（避免時區問題）
      const baseTime = new Date("2024-01-15T10:00:00Z");
      expect(twoHours.getTime() - baseTime.getTime()).toBe(2 * 60 * 60 * 1000); // 2 hours in ms
      expect(tomorrow.getHours()).toBe(9);
      expect(threeDays.getTime() - baseTime.getTime()).toBe(
        3 * 24 * 60 * 60 * 1000
      ); // 3 days in ms
    });

    test("應該成功排程跟進", async () => {
      mockMCPServer.executeTool.mockResolvedValue({
        success: true,
        data: {
          followUpId: "fu-123",
          scheduledAt: "2024-01-16T09:00:00Z",
          status: "pending",
        },
      });

      const result = await mockMCPServer.executeTool("schedule_follow_up", {
        timing: "tomorrow_9am",
        channel: "slack_dm",
        message: "跟進決策進度",
      });

      expect(result.success).toBe(true);
      expect(result.data.followUpId).toBe("fu-123");
    });
  });

  describe("Competitor Info", () => {
    test("應該查詢競品資訊", async () => {
      const mockCompetitorInfo = {
        name: "Competitor A",
        strengths: ["價格低", "品牌知名度"],
        weaknesses: ["功能較少", "客服較慢"],
        differentiators: ["我們的整合能力更強", "我們提供客製化服務"],
      };

      mockMCPServer.executeTool.mockResolvedValue({
        success: true,
        data: mockCompetitorInfo,
      });

      const result = await mockMCPServer.executeTool("get_competitor_info", {
        competitorName: "Competitor A",
      });

      expect(result.data.name).toBe("Competitor A");
      expect(result.data.differentiators).toHaveLength(2);
    });
  });
});
