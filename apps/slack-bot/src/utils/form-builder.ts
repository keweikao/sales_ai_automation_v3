/**
 * Dynamic Form Builder
 * 根據產品線動態生成 Slack Modal 表單
 */

import {
  getProductConfig,
  type ProductLine,
} from "@Sales_ai_automation_v3/shared/product-configs";
import type { PendingAudioFile } from "../types";

/**
 * 驗證台灣手機號碼格式
 * 支援格式:
 * - 0912345678
 * - 0912-345-678
 * - 09-1234-5678
 */
function validateTaiwanPhoneNumber(phone: string): boolean {
  if (!phone) {
    return false; // 必填欄位，空值視為無效
  }

  // 移除所有非數字字元
  const digitsOnly = phone.replace(/\D/g, "");

  // 檢查是否為 10 碼且以 09 開頭
  const isValid = /^09\d{8}$/.test(digitsOnly);

  return isValid;
}

/**
 * 格式化台灣手機號碼為標準格式
 * 輸入: "0912345678" 或 "0912-345-678"
 * 輸出: "0912-345-678"
 */
function formatTaiwanPhoneNumber(phone: string): string {
  if (!phone) {
    return "";
  }

  const digitsOnly = phone.replace(/\D/g, "");

  if (digitsOnly.length === 10 && digitsOnly.startsWith("09")) {
    return `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
  }

  return phone; // 無法格式化則返回原值
}

// Slack Modal View 類型
interface SlackModalView {
  type: "modal";
  callback_id: string;
  title: {
    type: "plain_text";
    text: string;
  };
  submit: {
    type: "plain_text";
    text: string;
  };
  close: {
    type: "plain_text";
    text: string;
  };
  blocks: object[];
  private_metadata: string;
}

// 音檔上傳 Metadata 類型
export interface AudioUploadMetadata {
  customerNumber: string;
  customerName: string;
  contactPhone?: string; // 客戶電話（選填）
  productLine?: ProductLine;
  storeType?: string;
  serviceType?: string; // iCHEF only
  staffCount?: string; // Beauty only
  currentSystem?: string;
  decisionMakerPresent?: string;
}

/**
 * 建立文字輸入欄位
 */
function buildTextInput(
  blockId: string,
  label: string,
  placeholder?: string,
  required = true
) {
  return {
    type: "input",
    block_id: blockId,
    label: {
      type: "plain_text",
      text: label,
    },
    element: {
      type: "plain_text_input",
      action_id: blockId,
      placeholder: placeholder
        ? {
            type: "plain_text",
            text: placeholder,
          }
        : undefined,
    },
    optional: !required,
  };
}

/**
 * 建立選擇欄位
 */
function buildSelectInput(
  blockId: string,
  label: string,
  options: Array<{ value: string; label: string; emoji?: string }>,
  required = true
) {
  return {
    type: "input",
    block_id: blockId,
    label: {
      type: "plain_text",
      text: label,
    },
    element: {
      type: "static_select",
      action_id: blockId,
      placeholder: {
        type: "plain_text",
        text: `選擇${label}`,
      },
      options: options.map((opt) => ({
        text: {
          type: "plain_text",
          text: opt.emoji ? `${opt.emoji} ${opt.label}` : opt.label,
        },
        value: opt.value,
      })),
    },
    optional: !required,
  };
}

/**
 * 建立音檔上傳 Modal
 *
 * @param pendingFile - 待處理的音檔資訊
 * @param productLine - 產品線 ('ichef' | 'beauty')
 * @returns Slack Modal View
 */
export function buildAudioUploadModal(
  pendingFile: PendingAudioFile,
  productLine: ProductLine
): SlackModalView {
  const config = getProductConfig(productLine);

  // 通用欄位
  const commonBlocks = [
    buildTextInput("customer_number", "客戶編號", "例如：C001、A0123", true),
    buildTextInput("customer_name", "客戶名稱", "例如：王小明咖啡店", true),
    buildTextInput(
      "contact_phone",
      "客戶電話（用於發送 SMS 通知）",
      "例如：0912-345-678",
      true // 必填
    ),
  ];

  // 產品線特定欄位
  const productBlocks = [
    // 店鋪類型 (所有產品線都有)
    buildSelectInput(
      "store_type",
      config.formFields.storeType.label,
      config.formFields.storeType.options,
      config.formFields.storeType.required ?? true
    ),
  ];

  // iCHEF: 營運型態
  if (productLine === "ichef" && config.formFields.serviceType) {
    productBlocks.push(
      buildSelectInput(
        "service_type",
        config.formFields.serviceType.label,
        config.formFields.serviceType.options,
        config.formFields.serviceType.required ?? true
      )
    );
  }

  // Beauty: 員工數量
  if (productLine === "beauty" && config.formFields.staffCount) {
    productBlocks.push(
      buildSelectInput(
        "staff_count",
        config.formFields.staffCount.label,
        config.formFields.staffCount.options,
        config.formFields.staffCount.required ?? true
      )
    );
  }

  // 現有系統 (所有產品線都有)
  productBlocks.push(
    buildSelectInput(
      "current_system",
      config.formFields.currentSystem.label,
      config.formFields.currentSystem.options,
      config.formFields.currentSystem.required ?? true
    )
  );

  // 決策者在場
  const additionalBlocks = [
    buildSelectInput(
      "decision_maker_present",
      "決策者在場",
      [
        { value: "yes", label: "是", emoji: "✅" },
        { value: "no", label: "否", emoji: "❌" },
        { value: "unknown", label: "不確定", emoji: "❓" },
      ],
      false
    ),
  ];

  return {
    type: "modal",
    callback_id: "audio_upload_form",
    title: {
      type: "plain_text",
      text: `${config.displayName} - 音檔資訊`,
    },
    submit: {
      type: "plain_text",
      text: "提交",
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
          text: `:microphone: 音檔：*${pendingFile.fileName}*\n\n請填寫以下客戶資訊：`,
        },
      },
      {
        type: "divider",
      },
      ...commonBlocks,
      ...productBlocks,
      ...additionalBlocks,
    ],
    private_metadata: JSON.stringify({
      fileId: pendingFile.fileId,
      fileName: pendingFile.fileName,
      channelId: pendingFile.channelId,
      userId: pendingFile.userId,
      userName: pendingFile.userName,
      threadTs: pendingFile.threadTs,
      downloadUrl: pendingFile.downloadUrl,
      productLine, // 重要: 儲存產品線資訊
    }),
  };
}

/**
 * 解析表單提交的值
 *
 * @param values - Slack 表單值
 * @param productLine - 產品線
 * @returns 解析後的 metadata
 */
export function parseAudioUploadFormValues(
  values: Record<
    string,
    Record<string, { value?: string; selected_option?: { value: string } }>
  >,
  productLine: ProductLine
): Partial<AudioUploadMetadata> {
  // 取得電話號碼原始值
  const rawPhone = values.contact_phone?.contact_phone?.value;

  // 驗證並格式化電話號碼
  let contactPhone: string | undefined;
  if (rawPhone) {
    if (validateTaiwanPhoneNumber(rawPhone)) {
      contactPhone = formatTaiwanPhoneNumber(rawPhone);
    } else {
      // 格式不正確，忽略此欄位
      console.warn(`[Form] Invalid phone number: ${rawPhone}`);
      contactPhone = undefined;
    }
  }

  const metadata: Partial<AudioUploadMetadata> = {
    productLine, // 加入產品線
    customerNumber: values.customer_number?.customer_number?.value,
    customerName: values.customer_name?.customer_name?.value,
    contactPhone, // 新增電話號碼
    storeType: values.store_type?.store_type?.selected_option?.value,
    currentSystem:
      values.current_system?.current_system?.selected_option?.value,
    decisionMakerPresent:
      values.decision_maker_present?.decision_maker_present?.selected_option
        ?.value,
  };

  // iCHEF 特定欄位
  if (productLine === "ichef") {
    metadata.serviceType =
      values.service_type?.service_type?.selected_option?.value;
  }

  // Beauty 特定欄位
  if (productLine === "beauty") {
    metadata.staffCount =
      values.staff_count?.staff_count?.selected_option?.value;
  }

  return metadata;
}
