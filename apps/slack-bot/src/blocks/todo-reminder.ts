/**
 * Todo Reminder Blocks
 *
 * 每日提醒訊息和相關 Modal 的 Block 建構器
 */

// Slack Block 類型（簡化版，避免依賴 @slack/types）
type SlackBlock = object;

export interface TodoReminderData {
  id: string;
  title: string;
  description?: string;
  dueDate: string; // ISO date string
  caseNumber?: string;
  opportunityName?: string;
  isOverdue?: boolean;
}

/**
 * 建構每日提醒訊息 Blocks
 */
export function buildDailyReminderBlocks(
  todos: TodoReminderData[]
): SlackBlock[] {
  if (todos.length === 0) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":white_check_mark: *今日沒有待處理的 Follow-up*\n繼續保持！",
        },
      },
    ];
  }

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Today's Follow-ups",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:bell: 你有 *${todos.length}* 個待處理的 Follow-up 事項`,
      },
    },
    {
      type: "divider",
    },
  ];

  // 新增每個 Todo 項目
  for (const todo of todos) {
    const statusIcon = todo.isOverdue ? ":warning:" : ":pushpin:";
    const overdueTag = todo.isOverdue ? " `逾期`" : "";

    // Todo 資訊區塊
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${statusIcon} *${todo.title}*${overdueTag}\n${todo.description ? `${todo.description}\n` : ""}${todo.caseNumber ? `:clipboard: ${todo.caseNumber}` : ""}${todo.opportunityName ? ` | :briefcase: ${todo.opportunityName}` : ""}\n:calendar: 到期日：${formatDate(todo.dueDate)}`,
      },
    });

    // 操作按鈕區塊
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          action_id: "complete_todo",
          text: {
            type: "plain_text",
            text: "完成",
            emoji: true,
          },
          style: "primary",
          value: JSON.stringify({ todoId: todo.id, todoTitle: todo.title }),
        },
        {
          type: "button",
          action_id: "postpone_todo",
          text: {
            type: "plain_text",
            text: "改期",
            emoji: true,
          },
          value: JSON.stringify({ todoId: todo.id, todoTitle: todo.title }),
        },
        {
          type: "button",
          action_id: "cancel_todo",
          text: {
            type: "plain_text",
            text: "取消",
            emoji: true,
          },
          style: "danger",
          value: JSON.stringify({ todoId: todo.id, todoTitle: todo.title }),
        },
      ],
    });

    blocks.push({
      type: "divider",
    });
  }

  return blocks;
}

/**
 * 建構完成 Todo Modal
 */
export function buildCompleteTodoModal(
  todoId: string,
  todoTitle: string
): object {
  return {
    type: "modal",
    callback_id: "complete_todo_form",
    private_metadata: JSON.stringify({ todoId, todoTitle }),
    title: {
      type: "plain_text",
      text: "完成 Follow-up",
    },
    submit: {
      type: "plain_text",
      text: "確認完成",
    },
    close: {
      type: "plain_text",
      text: "取消",
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:white_check_mark: *${todoTitle}*`,
        },
      },
      {
        type: "divider",
      },
      {
        type: "input",
        block_id: "completion_note_block",
        optional: true,
        label: {
          type: "plain_text",
          text: "完成備註",
        },
        element: {
          type: "plain_text_input",
          action_id: "completion_note_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "記錄這次 follow 的結果（選填）",
          },
        },
        hint: {
          type: "plain_text",
          text: "簡短記錄這次聯繫的結果或進展",
        },
      },
    ],
  };
}

/**
 * 建構改期 Todo Modal
 */
export function buildPostponeTodoModal(
  todoId: string,
  todoTitle: string
): object {
  // 計算預設日期為明天
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split("T")[0];

  return {
    type: "modal",
    callback_id: "postpone_todo_form",
    private_metadata: JSON.stringify({ todoId, todoTitle }),
    title: {
      type: "plain_text",
      text: "改期 Follow-up",
    },
    submit: {
      type: "plain_text",
      text: "確認改期",
    },
    close: {
      type: "plain_text",
      text: "取消",
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:calendar: *${todoTitle}*`,
        },
      },
      {
        type: "divider",
      },
      {
        type: "input",
        block_id: "new_date_block",
        label: {
          type: "plain_text",
          text: "新的到期日",
        },
        element: {
          type: "datepicker",
          action_id: "new_date_input",
          initial_date: defaultDate,
          placeholder: {
            type: "plain_text",
            text: "選擇日期",
          },
        },
      },
      {
        type: "input",
        block_id: "postpone_reason_block",
        optional: true,
        label: {
          type: "plain_text",
          text: "改期原因",
        },
        element: {
          type: "plain_text_input",
          action_id: "postpone_reason_input",
          placeholder: {
            type: "plain_text",
            text: "說明改期原因（選填）",
          },
        },
      },
    ],
  };
}

/**
 * 建構取消 Todo Modal
 */
export function buildCancelTodoModal(
  todoId: string,
  todoTitle: string
): object {
  return {
    type: "modal",
    callback_id: "cancel_todo_form",
    private_metadata: JSON.stringify({ todoId, todoTitle }),
    title: {
      type: "plain_text",
      text: "取消 Follow-up",
    },
    submit: {
      type: "plain_text",
      text: "確認取消",
    },
    close: {
      type: "plain_text",
      text: "返回",
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:x: *${todoTitle}*\n\n確定要取消這個 Follow-up 嗎？`,
        },
      },
      {
        type: "divider",
      },
      {
        type: "input",
        block_id: "cancel_reason_block",
        label: {
          type: "plain_text",
          text: "取消原因",
        },
        element: {
          type: "plain_text_input",
          action_id: "cancel_reason_input",
          placeholder: {
            type: "plain_text",
            text: "請說明取消原因",
          },
        },
        hint: {
          type: "plain_text",
          text: "例如：客戶已決定不採用、已轉交其他同事等",
        },
      },
    ],
  };
}

/**
 * 解析完成 Todo 表單值
 */
export function parseCompleteTodoFormValues(
  values: Record<string, Record<string, { value?: string }>>
): {
  completionNote?: string;
} {
  const completionNote =
    values.completion_note_block?.completion_note_input?.value;
  return {
    completionNote: completionNote || undefined,
  };
}

/**
 * 解析改期 Todo 表單值
 */
export function parsePostponeTodoFormValues(
  values: Record<
    string,
    Record<string, { value?: string; selected_date?: string }>
  >
): {
  newDate: string;
  reason?: string;
} {
  const newDate = values.new_date_block?.new_date_input?.selected_date || "";
  const reason = values.postpone_reason_block?.postpone_reason_input?.value;
  return {
    newDate,
    reason: reason || undefined,
  };
}

/**
 * 解析取消 Todo 表單值
 */
export function parseCancelTodoFormValues(
  values: Record<string, Record<string, { value?: string }>>
): {
  reason: string;
} {
  const reason = values.cancel_reason_block?.cancel_reason_input?.value || "";
  return { reason };
}

/**
 * 格式化日期為顯示格式
 */
function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
    return `${month}/${day} (${weekday})`;
  } catch {
    return isoDate;
  }
}
