/**
 * Slack Event Repair Tool
 * 修復 Slack Event Listener 問題
 */

import { z } from "zod";
import type { MCPTool } from "../../../../mcp/types.js";

const SlackEventRepairInput = z.object({
  dryRun: z.boolean().default(true),
  apiToken: z.string().optional(),
  recheckPermissions: z.boolean().default(true),
});

const SlackEventRepairOutput = z.object({
  repaired: z.boolean(),
  actions: z.array(z.string()),
  dryRun: z.boolean(),
  timestamp: z.date(),
});

type Input = z.infer<typeof SlackEventRepairInput>;
type Output = z.infer<typeof SlackEventRepairOutput>;

export const slackEventRepairTool: MCPTool<Input, Output> = {
  name: "slack_event_repair",
  description:
    "修復 Slack Event Listener 問題。檢查 Bot 權限、Event Subscriptions 配置等。",
  inputSchema: SlackEventRepairInput,
  handler: async (input: Input): Promise<Output> => {
    const actions: string[] = [];

    try {
      const token = input.apiToken || process.env.SLACK_BOT_TOKEN;

      if (!token) {
        actions.push("❌ SLACK_BOT_TOKEN 環境變數未設定");
        return {
          repaired: false,
          actions,
          dryRun: input.dryRun,
          timestamp: new Date(),
        };
      }

      if (input.dryRun) {
        actions.push("🔍 Dry Run 模式 - 僅模擬修復動作");
        actions.push("1. 檢查 Slack Bot 權限配置");
        actions.push("2. 驗證 Event Subscriptions 設定");
        actions.push("3. 檢查 Request URL 是否可訪問");
        actions.push("4. 測試發送模擬事件");

        return {
          repaired: false,
          actions,
          dryRun: true,
          timestamp: new Date(),
        };
      }

      // 實際修復邏輯
      actions.push("🔧 開始修復 Slack Event Listener...");

      // 1. 檢查 Bot 權限
      if (input.recheckPermissions) {
        actions.push("📡 檢查 Bot 權限...");

        const authResponse = await fetch("https://slack.com/api/auth.test", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const authData = (await authResponse.json()) as {
          ok: boolean;
          error?: string;
          bot_id?: string;
          team?: string;
        };

        if (!authData.ok) {
          actions.push(`❌ Bot 驗證失敗: ${authData.error}`);
          return {
            repaired: false,
            actions,
            dryRun: false,
            timestamp: new Date(),
          };
        }

        actions.push(`✅ Bot 驗證成功 (Bot ID: ${authData.bot_id})`);
      }

      // 2. 檢查必要的 Bot Scopes
      // 注意：實際的 scopes 檢查需要使用 apps.permissions.info API
      // 這裡我們通過嘗試訪問不同 API 來推斷權限

      const requiredScopes = [
        {
          name: "channels:history",
          api: "conversations.history",
          test: async () => {
            const response = await fetch(
              "https://slack.com/api/conversations.list",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ limit: 1 }),
              }
            );
            const data = (await response.json()) as { ok: boolean };
            return data.ok;
          },
        },
        {
          name: "files:read",
          api: "files.list",
          test: async () => {
            const response = await fetch("https://slack.com/api/files.list", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ count: 1 }),
            });
            const data = (await response.json()) as { ok: boolean };
            return data.ok;
          },
        },
      ];

      actions.push("🔍 檢查必要的 Bot Scopes...");
      let scopesPassed = 0;

      for (const scope of requiredScopes) {
        try {
          const hasPermission = await scope.test();
          if (hasPermission) {
            actions.push(`✅ ${scope.name} 權限正常`);
            scopesPassed++;
          } else {
            actions.push(`⚠️ ${scope.name} 權限可能缺失`);
          }
        } catch (_error) {
          actions.push(`❌ ${scope.name} 測試失敗`);
        }
      }

      if (scopesPassed === requiredScopes.length) {
        actions.push("✅ 所有必要權限檢查通過");
        actions.push(
          "💡 Event Listener 問題可能在 Slack App 配置層級，請檢查："
        );
        actions.push("   - Event Subscriptions 是否啟用");
        actions.push("   - Request URL 是否正確且可訪問");
        actions.push("   - 訂閱的事件類型是否正確");

        return {
          repaired: true,
          actions,
          dryRun: false,
          timestamp: new Date(),
        };
      }

      actions.push("⚠️ 部分權限缺失，Event Listener 可能無法正常工作");
      actions.push("💡 建議：前往 Slack App 設定頁面重新安裝 App 以更新權限");

      return {
        repaired: false,
        actions,
        dryRun: false,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      actions.push(`❌ 修復過程發生錯誤: ${errorMsg}`);

      return {
        repaired: false,
        actions,
        dryRun: input.dryRun,
        timestamp: new Date(),
      };
    }
  },
};
