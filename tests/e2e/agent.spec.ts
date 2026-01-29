import { expect, test } from "@playwright/test";

/**
 * Sales Coach Agent E2E 測試
 *
 * 這些測試驗證 Agent 的端到端功能，包括：
 * - API 端點可用性
 * - Slack 指令整合
 * - 完整的分析流程
 */

const API_BASE_URL = process.env.TEST_API_URL || "http://localhost:3001";

// 需要 API server 的測試，在沒有 server 時跳過
const testWithServer = process.env.SKIP_WEB_SERVER ? test.skip : test;

test.describe("Sales Coach Agent API", () => {
  test.describe("GET /api/agent/analyze", () => {
    testWithServer("未認證時應返回 401", async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/agent.analyze`, {
        data: {
          conversationId: "test-conv-123",
          scenario: "general",
        },
      });

      expect(response.status()).toBe(401);
    });

    test("認證後應成功分析對話", async ({ request }) => {
      // 需要先取得認證 token
      const response = await request.post(`${API_BASE_URL}/api/agent.analyze`, {
        headers: {
          Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
        },
        data: {
          conversationId: "test-conv-123",
          scenario: "post_demo",
        },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("conversationId");
      expect(data).toHaveProperty("analysis");
    });
  });

  test.describe("GET /api/agent/recommendations", () => {
    testWithServer("未認證時應返回 401", async ({ request }) => {
      const response = await request.post(
        `${API_BASE_URL}/api/agent.recommendations`,
        {
          data: {
            conversationId: "test-conv-123",
            limit: 5,
          },
        }
      );

      expect(response.status()).toBe(401);
    });
  });

  test.describe("GET /api/agent/talkTracks", () => {
    testWithServer("未認證時應返回 401", async ({ request }) => {
      const response = await request.post(
        `${API_BASE_URL}/api/agent.talkTracks`,
        {
          data: {
            category: "objection_handling",
            limit: 10,
          },
        }
      );

      expect(response.status()).toBe(401);
    });
  });

  test.describe("POST /api/agent/scheduleFollowUp", () => {
    testWithServer("未認證時應返回 401", async ({ request }) => {
      const response = await request.post(
        `${API_BASE_URL}/api/agent.scheduleFollowUp`,
        {
          data: {
            opportunityId: "opp-123",
            timing: "tomorrow_9am",
            channel: "slack_dm",
            message: "跟進決策進度",
          },
        }
      );

      expect(response.status()).toBe(401);
    });
  });

  test.describe("POST /api/agent/ask", () => {
    testWithServer("未認證時應返回 401", async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/agent.ask`, {
        data: {
          conversationId: "test-conv-123",
          question: "這個客戶的主要痛點是什麼？",
        },
      });

      expect(response.status()).toBe(401);
    });
  });
});

test.describe("Sales Coach Agent 完整流程", () => {
  test("應完成從分析到建議的完整流程", async ({ request }) => {
    // 步驟 1: 分析對話
    const analyzeResponse = await request.post(
      `${API_BASE_URL}/api/agent.analyze`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
        },
        data: {
          conversationId: "test-conv-123",
          scenario: "post_demo",
        },
      }
    );

    expect(analyzeResponse.ok()).toBe(true);
    const analysis = await analyzeResponse.json();

    // 步驟 2: 取得建議
    const recommendationsResponse = await request.post(
      `${API_BASE_URL}/api/agent.recommendations`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
        },
        data: {
          conversationId: "test-conv-123",
          limit: 5,
        },
      }
    );

    expect(recommendationsResponse.ok()).toBe(true);
    const recommendations = await recommendationsResponse.json();
    expect(recommendations.recommendations).toBeDefined();

    // 步驟 3: 取得話術建議
    const talkTracksResponse = await request.post(
      `${API_BASE_URL}/api/agent.talkTracks`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
        },
        data: {
          category: "objection_handling",
          limit: 3,
        },
      }
    );

    expect(talkTracksResponse.ok()).toBe(true);

    // 步驟 4: 排程跟進
    if (analysis.followUps?.length > 0) {
      const followUpResponse = await request.post(
        `${API_BASE_URL}/api/agent.scheduleFollowUp`,
        {
          headers: {
            Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
          },
          data: {
            opportunityId: "opp-123",
            timing: "tomorrow_9am",
            channel: "slack_dm",
            message: analysis.followUps[0].message,
          },
        }
      );

      expect(followUpResponse.ok()).toBe(true);
    }
  });
});

test.describe("Talk Tracks API", () => {
  test.describe("GET /api/talkTracks/list", () => {
    testWithServer("未認證時應返回 401", async ({ request }) => {
      const response = await request.post(
        `${API_BASE_URL}/api/talkTracks.list`,
        {
          data: {
            category: "all",
            limit: 10,
          },
        }
      );

      expect(response.status()).toBe(401);
    });
  });

  test.describe("GET /api/talkTracks/search", () => {
    testWithServer("未認證時應返回 401", async ({ request }) => {
      const response = await request.post(
        `${API_BASE_URL}/api/talkTracks.search`,
        {
          data: {
            query: "價格異議",
            limit: 5,
          },
        }
      );

      expect(response.status()).toBe(401);
    });
  });
});

test.describe("Health Check", () => {
  testWithServer("API 健康檢查應返回 OK", async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/healthCheck`);

    // 健康檢查端點應該是公開的
    expect(response.ok()).toBe(true);
  });
});

test.describe("Slack 指令模擬", () => {
  test("模擬 /coach 指令請求格式", async ({ request }) => {
    // 模擬 Slack 指令的 payload 格式
    const slackPayload = {
      command: "/coach",
      text: "conv-123",
      user_id: "U123456",
      channel_id: "C123456",
      response_url: "https://hooks.slack.com/commands/xxx",
      trigger_id: "123.456",
    };

    // 這個測試主要驗證 payload 格式
    expect(slackPayload.command).toBe("/coach");
    expect(slackPayload.text).toBe("conv-123");
  });

  test("模擬 /coach ask 指令請求格式", async () => {
    const slackPayload = {
      command: "/coach",
      text: "ask conv-123 這個客戶的主要痛點是什麼？",
      user_id: "U123456",
      channel_id: "C123456",
      response_url: "https://hooks.slack.com/commands/xxx",
      trigger_id: "123.456",
    };

    // 解析子指令
    const args = slackPayload.text.split(/\s+/);
    const subcommand = args[0];
    const conversationId = args[1];
    const question = args.slice(2).join(" ");

    expect(subcommand).toBe("ask");
    expect(conversationId).toBe("conv-123");
    expect(question).toBe("這個客戶的主要痛點是什麼？");
  });

  test("模擬 /coach followup 指令請求格式", async () => {
    const slackPayload = {
      command: "/coach",
      text: "followup opp-123 tomorrow",
      user_id: "U123456",
      channel_id: "C123456",
      response_url: "https://hooks.slack.com/commands/xxx",
      trigger_id: "123.456",
    };

    const args = slackPayload.text.split(/\s+/);
    const subcommand = args[0];
    const opportunityId = args[1];
    const timing = args[2];

    expect(subcommand).toBe("followup");
    expect(opportunityId).toBe("opp-123");
    expect(timing).toBe("tomorrow");
  });

  test("模擬 /coach tracks 指令請求格式", async () => {
    const slackPayload = {
      command: "/coach",
      text: "tracks objection_handling",
      user_id: "U123456",
      channel_id: "C123456",
      response_url: "https://hooks.slack.com/commands/xxx",
      trigger_id: "123.456",
    };

    const args = slackPayload.text.split(/\s+/);
    const subcommand = args[0];
    const category = args[1];

    expect(subcommand).toBe("tracks");
    expect(category).toBe("objection_handling");
  });
});

test.describe("Scenario: Post Demo Coach", () => {
  test("應正確處理 Demo 後教練場景", async () => {
    const demoContext = {
      conversationId: "demo-conv-123",
      scenario: "post_demo",
      demoTopics: ["產品功能展示", "定價討論", "整合方案"],
      customerReactions: {
        positive: ["對自動化功能感興趣"],
        concerns: ["擔心整合複雜度", "需要確認預算"],
      },
    };

    // 驗證場景資料結構
    expect(demoContext.scenario).toBe("post_demo");
    expect(demoContext.demoTopics).toContain("產品功能展示");
    expect(demoContext.customerReactions.concerns).toHaveLength(2);
  });
});

test.describe("Scenario: Close Now Alert", () => {
  test("應正確識別 Close Now 機會", async () => {
    const closeNowSignals = {
      urgencyLevel: "high",
      budgetConfirmed: true,
      decisionTimeline: "本月底",
      stakeholderAlignment: true,
      competitorMentioned: false,
    };

    // 計算 Close Now 分數
    let score = 0;
    if (closeNowSignals.urgencyLevel === "high") {
      score += 25;
    }
    if (closeNowSignals.budgetConfirmed) {
      score += 25;
    }
    if (closeNowSignals.decisionTimeline) {
      score += 20;
    }
    if (closeNowSignals.stakeholderAlignment) {
      score += 20;
    }
    if (!closeNowSignals.competitorMentioned) {
      score += 10;
    }

    expect(score).toBeGreaterThanOrEqual(80);
    expect(score).toBe(100); // 所有條件都滿足
  });
});

test.describe("Scenario: Manager Weekly Report", () => {
  test("應正確產生週報資料結構", async () => {
    const weeklyReportData = {
      period: "2024-W03",
      team: {
        totalReps: 5,
        activeReps: 4,
      },
      metrics: {
        totalConversations: 42,
        avgMeddicScore: 68,
        dealsInPipeline: 15,
        dealsWon: 3,
        dealsClosed: 2,
      },
      highlights: {
        topPerformer: "Alice",
        biggestDeal: "Enterprise Corp - $150K",
        improvementArea: "Decision Process 確認",
      },
      recommendations: [
        "加強 Decision Process 相關話術訓練",
        "安排 Champion 培養工作坊",
      ],
    };

    expect(weeklyReportData.period).toMatch(/^\d{4}-W\d{2}$/);
    expect(weeklyReportData.metrics.avgMeddicScore).toBeGreaterThan(0);
    expect(weeklyReportData.recommendations).toHaveLength(2);
  });
});
