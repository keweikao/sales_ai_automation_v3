/**
 * Summary 編輯 Modal
 *
 * 讓業務編輯 AI 生成的會議摘要
 */

export interface SummaryModalData {
  conversationId: string;
  currentSummary: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
}

/**
 * 建構 Summary 編輯 Modal
 */
export function buildEditSummaryModal(data: SummaryModalData): object {
  const blocks: object[] = [
    // 客戶聯絡資訊（唯讀顯示）
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*客戶聯絡資訊*",
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*📞 電話*\n${data.contactPhone ?? "_無_"}`,
        },
        {
          type: "mrkdwn",
          text: `*📧 Email*\n${data.contactEmail ?? "_無_"}`,
        },
      ],
    },
    {
      type: "divider",
    },
    // 摘要編輯區
    {
      type: "input",
      block_id: "summary_block",
      element: {
        type: "plain_text_input",
        action_id: "summary_input",
        multiline: true,
        initial_value: data.currentSummary,
        placeholder: {
          type: "plain_text",
          text: "請輸入會議摘要內容...",
        },
      },
      label: {
        type: "plain_text",
        text: "會議摘要",
      },
      hint: {
        type: "plain_text",
        text: "編輯後的摘要將會儲存，也可用於發送簡訊或 Email 給客戶",
      },
    },
  ];

  return {
    type: "modal",
    callback_id: "edit_summary_modal",
    private_metadata: JSON.stringify({
      conversationId: data.conversationId,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
    }),
    title: {
      type: "plain_text",
      text: "編輯會議摘要",
    },
    submit: {
      type: "plain_text",
      text: "儲存",
    },
    close: {
      type: "plain_text",
      text: "取消",
    },
    blocks,
  };
}

/**
 * 解析 Modal 提交的資料
 */
export function parseEditSummaryValues(
  values: Record<string, Record<string, { value?: string }>>
): { summary: string } {
  const summary = values.summary_block?.summary_input?.value ?? "";
  return { summary };
}
