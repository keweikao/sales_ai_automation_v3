/**
 * Follow-up Modal
 *
 * 讓業務在上傳音檔後設定 follow-up 待辦事項
 * 或標記客戶已拒絕（結案）
 */

export interface FollowUpModalData {
  conversationId: string;
  caseNumber: string;
  opportunityId?: string;
  opportunityName?: string;
  customerNumber?: string; // 主要連接欄位，用於關聯 opportunity
}

/**
 * 建構第一步：選擇處理方式 Modal
 */
export function buildFollowUpChoiceModal(data: FollowUpModalData): object {
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
    // 說明文字
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*請選擇後續處理方式*",
      },
    },
    // 處理方式選擇
    {
      type: "actions",
      block_id: "action_choice_block",
      elements: [
        {
          type: "button",
          action_id: "choose_follow_up",
          text: {
            type: "plain_text",
            text: "📅 建立 Follow-up",
          },
          style: "primary",
          value: JSON.stringify({
            conversationId: data.conversationId,
            caseNumber: data.caseNumber,
            opportunityId: data.opportunityId,
            opportunityName: data.opportunityName,
            customerNumber: data.customerNumber,
          }),
        },
        {
          type: "button",
          action_id: "choose_close_case",
          text: {
            type: "plain_text",
            text: "👋 客戶已拒絕",
          },
          style: "danger",
          value: JSON.stringify({
            conversationId: data.conversationId,
            caseNumber: data.caseNumber,
            opportunityId: data.opportunityId,
            opportunityName: data.opportunityName,
            customerNumber: data.customerNumber,
          }),
        },
      ],
    },
  ];

  return {
    type: "modal",
    callback_id: "follow_up_choice",
    private_metadata: JSON.stringify({
      conversationId: data.conversationId,
      caseNumber: data.caseNumber,
      opportunityId: data.opportunityId,
      opportunityName: data.opportunityName,
      customerNumber: data.customerNumber,
    }),
    title: {
      type: "plain_text",
      text: "後續處理",
    },
    close: {
      type: "plain_text",
      text: "取消",
    },
    blocks,
  };
}

/**
 * 建構 Follow-up 表單 Modal（第二步：建立 Follow-up）
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
    {
      type: "divider",
    },
    // 返回按鈕
    {
      type: "actions",
      block_id: "back_action_block",
      elements: [
        {
          type: "button",
          action_id: "back_to_choice",
          text: {
            type: "plain_text",
            text: "← 返回選擇",
          },
          value: JSON.stringify({
            conversationId: data.conversationId,
            caseNumber: data.caseNumber,
            opportunityId: data.opportunityId,
            opportunityName: data.opportunityName,
            customerNumber: data.customerNumber,
          }),
        },
      ],
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
      customerNumber: data.customerNumber,
    }),
    title: {
      type: "plain_text",
      text: "建立 Follow-up",
    },
    submit: {
      type: "plain_text",
      text: "確認建立",
    },
    close: {
      type: "plain_text",
      text: "取消",
    },
    blocks,
  };
}

export interface ParsedFollowUpFormValues {
  days: number;
  title: string;
  description?: string;
}

/**
 * 解析 Follow-up 表單值（submit 時呼叫）
 */
export function parseFollowUpFormValues(
  values: Record<
    string,
    Record<
      string,
      {
        value?: string;
        selected_option?: { value: string };
      }
    >
  >
): ParsedFollowUpFormValues {
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

/**
 * 建構結案 Modal（填寫拒絕原因）
 */
export function buildCloseCaseModal(data: FollowUpModalData): object {
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
    // 拒絕原因
    {
      type: "input",
      block_id: "reject_reason_block",
      label: {
        type: "plain_text",
        text: "拒絕原因",
      },
      element: {
        type: "plain_text_input",
        action_id: "reject_reason_input",
        placeholder: {
          type: "plain_text",
          text: "例如：預算不足、選擇競品、時機不對",
        },
      },
      hint: {
        type: "plain_text",
        text: "記錄客戶拒絕的原因，以利後續分析",
      },
    },
    // 競品資訊（選填）
    {
      type: "input",
      block_id: "competitor_block",
      optional: true,
      label: {
        type: "plain_text",
        text: "競品資訊",
      },
      element: {
        type: "plain_text_input",
        action_id: "competitor_input",
        placeholder: {
          type: "plain_text",
          text: "客戶選擇的競品（選填）",
        },
      },
    },
    {
      type: "divider",
    },
    // 返回按鈕
    {
      type: "actions",
      block_id: "back_action_block",
      elements: [
        {
          type: "button",
          action_id: "back_to_choice",
          text: {
            type: "plain_text",
            text: "← 返回選擇",
          },
          value: JSON.stringify({
            conversationId: data.conversationId,
            caseNumber: data.caseNumber,
            opportunityId: data.opportunityId,
            opportunityName: data.opportunityName,
            customerNumber: data.customerNumber,
          }),
        },
      ],
    },
  ];

  return {
    type: "modal",
    callback_id: "close_case_form",
    private_metadata: JSON.stringify({
      conversationId: data.conversationId,
      caseNumber: data.caseNumber,
      opportunityId: data.opportunityId,
      opportunityName: data.opportunityName,
      customerNumber: data.customerNumber,
    }),
    title: {
      type: "plain_text",
      text: "結案",
    },
    submit: {
      type: "plain_text",
      text: "確認結案",
    },
    close: {
      type: "plain_text",
      text: "取消",
    },
    blocks,
  };
}

export interface ParsedCloseCaseFormValues {
  rejectReason: string;
  competitor?: string;
}

/**
 * 解析結案表單值
 */
export function parseCloseCaseFormValues(
  values: Record<
    string,
    Record<
      string,
      {
        value?: string;
      }
    >
  >
): ParsedCloseCaseFormValues {
  const rejectReason =
    values.reject_reason_block?.reject_reason_input?.value || "";
  const competitor = values.competitor_block?.competitor_input?.value;

  return {
    rejectReason,
    competitor: competitor || undefined,
  };
}
