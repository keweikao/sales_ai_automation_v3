/**
 * Follow-up Modal
 *
 * 讓業務在上傳音檔後設定 follow-up 待辦事項
 */

export interface FollowUpModalData {
  conversationId: string;
  caseNumber: string;
  opportunityId?: string;
  opportunityName?: string;
}

/**
 * 建構 Follow-up Modal
 */
export function buildFollowUpModal(data: FollowUpModalData): object {
  const blocks: object[] = [
    // 案件資訊區塊
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*案件資訊*\n:clipboard: 案件編號：\`${data.caseNumber}\`${data.opportunityName ? `\n:briefcase: 商機：${data.opportunityName}` : ""}`,
      },
    },
    {
      type: "divider",
    },
    // 天數選擇
    {
      type: "input",
      block_id: "days_block",
      label: {
        type: "plain_text",
        text: "幾天後提醒",
      },
      element: {
        type: "static_select",
        action_id: "days_input",
        placeholder: {
          type: "plain_text",
          text: "選擇天數",
        },
        options: [
          { text: { type: "plain_text", text: "1 天後" }, value: "1" },
          { text: { type: "plain_text", text: "3 天後" }, value: "3" },
          { text: { type: "plain_text", text: "5 天後" }, value: "5" },
          { text: { type: "plain_text", text: "7 天後" }, value: "7" },
          { text: { type: "plain_text", text: "14 天後" }, value: "14" },
        ],
        initial_option: {
          text: { type: "plain_text", text: "3 天後" },
          value: "3",
        },
      },
    },
    // Follow 事項（必填）
    {
      type: "input",
      block_id: "title_block",
      label: {
        type: "plain_text",
        text: "Follow 事項",
      },
      element: {
        type: "plain_text_input",
        action_id: "title_input",
        placeholder: {
          type: "plain_text",
          text: "例如：確認客戶試用狀況、跟進報價單",
        },
      },
      hint: {
        type: "plain_text",
        text: "簡短描述要 follow 的事項",
      },
    },
    // 詳細描述（選填）
    {
      type: "input",
      block_id: "description_block",
      optional: true,
      label: {
        type: "plain_text",
        text: "詳細描述",
      },
      element: {
        type: "plain_text_input",
        action_id: "description_input",
        multiline: true,
        placeholder: {
          type: "plain_text",
          text: "補充說明（選填）",
        },
      },
    },
  ];

  return {
    type: "modal",
    callback_id: "follow_up_form",
    private_metadata: JSON.stringify({
      conversationId: data.conversationId,
      caseNumber: data.caseNumber,
      opportunityId: data.opportunityId,
      opportunityName: data.opportunityName,
    }),
    title: {
      type: "plain_text",
      text: "設定 Follow-up",
    },
    submit: {
      type: "plain_text",
      text: "建立",
    },
    close: {
      type: "plain_text",
      text: "跳過",
    },
    blocks,
  };
}

/**
 * 解析 Follow-up 表單值
 */
export function parseFollowUpFormValues(
  values: Record<
    string,
    Record<string, { value?: string; selected_option?: { value: string } }>
  >
): {
  days: number;
  title: string;
  description?: string;
} {
  const days = Number.parseInt(
    values.days_block?.days_input?.selected_option?.value || "3",
    10
  );
  const title = values.title_block?.title_input?.value || "";
  const description = values.description_block?.description_input?.value;

  return {
    days,
    title,
    description: description || undefined,
  };
}
