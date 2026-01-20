/**
 * 手動觸發 Slack 通知
 * 用於測試更新後的 URL
 */

import { createNotificationService } from "./packages/services/src/notifications/slack";

const conversationId = "202601-IC021"; // 從案件編號推測

async function triggerNotification() {
  console.log("🔔 準備觸發通知...");
  console.log("對話 ID:", conversationId);

  // 從環境變數讀取設定
  const env = {
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
    SLACK_CHANNEL_ID: process.env.SLACK_CHANNEL_ID || "#general",
  };

  if (!env.SLACK_BOT_TOKEN) {
    console.error("❌ 缺少 SLACK_BOT_TOKEN 環境變數");
    process.exit(1);
  }

  const notificationService = createNotificationService(env as any);

  // 模擬完整的分析結果
  const mockAnalysisResult = {
    overallScore: 50,
    qualificationStatus: "Medium",
    alerts: [
      "錯失推進機會 - [17:16]：客戶詢問「用越多的商品，價格會不會不一樣？進銷存要不要加錢？」業務直接跳到費用結構，但沒有明確指出iCHEF的進銷存是內建免費功能，錯失了強調產品價值和消除客戶對潛在額外費用疑慮的機會",
      "尚未充分討論量化指標",
      "尚未明確了解決策標準",
    ],
    painPoints: [
      "費用結構與成本控制",
      "人力與效率優化",
      "新開店初期營運",
      "電子發票導入",
    ],
    risks: [
      {
        risk: "客戶對轉換有顧慮: 費用結構/成本控制",
        severity: "medium",
        mitigation: "提供詳細的轉換計劃和支援服務,降低轉換成本",
      },
      {
        risk: "業務錯失關鍵機會: [17:16]：客戶詢問「用越多的商品，價格會不會不一樣？進銷存要不要加錢？」業務直接跳到費用結構，但沒有明確指出iCHEF的進銷存是內建免費功能，錯失了強調產品價值和消除客戶對潛在額外費用疑慮的機會。, [27:38]：客戶對線上點餐/定位的合約與單量計費方式有深入疑慮，業務解釋後，客戶表示「沒錯」，但業務沒有進一步確認客戶是否完全理解或是否有其他顧慮，也沒有順勢推進下一步（例如：提供報價單讓客戶帶回去與合夥人討論，或確認合夥人何時有空進行三方會議）。",
        severity: "medium",
        mitigation: "後續跟進時...",
      },
    ],
    smsText:
      "王老闆您好,非常感謝您今天撥冗討論!針對您關心的線上點餐計費與成本效益,已為您整理會議重點,請點擊查看👉[SHORT_URL]",
    summary: "會議摘要內容...",
    contactPhone: "0912345678", // 測試用
  };

  try {
    await notificationService.sendProcessingCompleted(
      conversationId,
      "202601-IC021",
      mockAnalysisResult as any,
      154_800, // 154.8 秒
      "test-share-token-123"
    );

    console.log("✅ 通知已發送!");
  } catch (error) {
    console.error("❌ 發送失敗:", error);
    process.exit(1);
  }
}

triggerNotification();
