/**
 * Notification Service - SMS 和 Email 發送服務
 *
 * 使用 EVERY8D API 發送簡訊
 */

import type { Env } from "../types";

interface SendResult {
  success: boolean;
  error?: string;
  messageId?: string;
  credit?: number;
}

interface NotificationService {
  sendSMS(phone: string, message: string): Promise<SendResult>;
  sendEmail(email: string, subject: string, body: string): Promise<SendResult>;
}

/**
 * 建立通知服務實例
 */
export function createNotificationService(env: Env): NotificationService {
  return {
    /**
     * 透過 EVERY8D API 發送簡訊
     *
     * API 文件：https://api.e8d.tw
     * 回傳格式：Credit,SendMessage,Cost,Unsend,SendTime
     * 成功範例：79.0,1,1.0,0,20170601165133
     * 失敗範例：-300 (帳號密碼錯誤)
     */
    async sendSMS(phone: string, message: string): Promise<SendResult> {
      const uid = env.EVERY8D_UID;
      const pwd = env.EVERY8D_PWD;
      // 支援 EVERY8D_API_URL 或 EVERY8D_SITE_URL (舊版命名)
      const apiUrl =
        env.EVERY8D_API_URL ||
        env.EVERY8D_SITE_URL ||
        "https://api.e8d.tw/API21/HTTP/sendSMS.ashx";

      if (!(uid && pwd)) {
        return {
          success: false,
          error: "SMS 服務未設定 (缺少 EVERY8D_UID 或 EVERY8D_PWD)",
        };
      }

      // 格式化電話號碼 (移除空格和特殊字元，確保台灣手機格式)
      const formattedPhone = formatPhoneNumber(phone);
      if (!formattedPhone) {
        return {
          success: false,
          error: `無效的電話號碼格式: ${phone}`,
        };
      }

      // 簡訊內容截斷 (單則簡訊最多 70 個中文字或 160 個英文字)
      const truncatedMessage = truncateMessage(message, 140);

      try {
        // 建立 EVERY8D API 請求
        const params = new URLSearchParams({
          UID: uid,
          PWD: pwd,
          SB: "", // 簡訊主旨 (可選)
          MSG: truncatedMessage,
          DEST: formattedPhone,
          ST: "", // 預約發送時間 (空白表示立即發送)
        });

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        const responseText = await response.text();

        // 解析 EVERY8D 回應
        // 成功格式: Credit,SendMessage,Cost,Unsend,SendTime
        // 失敗格式: 負數錯誤碼
        const result = parseEvery8DResponse(responseText);

        if (result.success) {
          return {
            success: true,
            messageId: result.sendTime,
            credit: result.credit,
          };
        }
        return {
          success: false,
          error: result.errorMessage || `API 錯誤: ${responseText}`,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "未知錯誤";
        return {
          success: false,
          error: `發送失敗: ${errorMessage}`,
        };
      }
    },

    /**
     * 發送 Email (目前未實作，返回待實作訊息)
     */
    async sendEmail(
      email: string,
      subject: string,
      _body: string
    ): Promise<SendResult> {
      // TODO: 整合 Email 服務 (如 Resend, SendGrid, Mailgun 等)
      return {
        success: false,
        error: `Email 服務尚未設定。無法發送至 ${email} (主旨: ${subject})`,
      };
    },
  };
}

/**
 * 格式化台灣手機號碼
 * 支援格式: 0912345678, 09-1234-5678, +886912345678
 */
function formatPhoneNumber(phone: string): string | null {
  // 移除所有非數字字元
  const digits = phone.replace(/\D/g, "");

  // 處理 +886 開頭的國際格式
  if (digits.startsWith("886") && digits.length === 12) {
    return `0${digits.slice(3)}`;
  }

  // 標準台灣手機格式 09XXXXXXXX
  if (digits.startsWith("09") && digits.length === 10) {
    return digits;
  }

  // 無法識別的格式
  return null;
}

/**
 * 截斷簡訊內容
 * 中文簡訊每則最多 70 字，超過會分則計費
 */
function truncateMessage(message: string, maxLength: number): string {
  if (message.length <= maxLength) {
    return message;
  }
  return `${message.slice(0, maxLength - 3)}...`;
}

interface Every8DResult {
  success: boolean;
  credit?: number;
  sendCount?: number;
  cost?: number;
  sendTime?: string;
  errorMessage?: string;
}

/**
 * 解析 EVERY8D API 回應
 *
 * 成功回應格式: Credit,SendMessage,Cost,Unsend,SendTime
 * 範例: 79.0,1,1.0,0,20170601165133
 *
 * 錯誤代碼:
 * -300: 帳號密碼錯誤
 * -301: 發送額度不足
 * -302: 無效的接收者
 * -303: 訊息內容為空
 */
function parseEvery8DResponse(response: string): Every8DResult {
  const trimmed = response.trim();

  // 檢查是否為錯誤代碼 (負數)
  if (trimmed.startsWith("-")) {
    const errorCode = Number.parseInt(trimmed, 10);
    const errorMessages: Record<number, string> = {
      "-300": "帳號密碼錯誤",
      "-301": "發送額度不足",
      "-302": "無效的接收者電話號碼",
      "-303": "訊息內容為空",
      "-304": "預約發送時間錯誤",
      "-305": "發送者識別碼錯誤",
      "-306": "帳號已停用",
      "-307": "簡訊內容含有違規字元",
      "-399": "系統錯誤，請稍後再試",
    };

    return {
      success: false,
      errorMessage: errorMessages[errorCode] || `未知錯誤 (${errorCode})`,
    };
  }

  // 解析成功回應
  const parts = trimmed.split(",");
  if (parts.length >= 5) {
    const credit = Number.parseFloat(parts[0] ?? "0");
    const sendCount = Number.parseInt(parts[1] ?? "0", 10);
    const cost = Number.parseFloat(parts[2] ?? "0");
    const sendTime = parts[4] ?? "";

    return {
      success: sendCount > 0,
      credit,
      sendCount,
      cost,
      sendTime,
    };
  }

  return {
    success: false,
    errorMessage: `無法解析 API 回應: ${trimmed}`,
  };
}
