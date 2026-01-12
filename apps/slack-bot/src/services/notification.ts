/**
 * 通知服務抽象層
 *
 * 提供 SMS 和 Email 發送功能
 * TODO: 選擇供應商後實作具體服務
 * - SMS: Twilio 或其他
 * - Email: SendGrid、Resend 或其他
 */

import type { Env } from "../types";

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface NotificationService {
  sendSMS(phone: string, message: string): Promise<NotificationResult>;
  sendEmail(
    email: string,
    subject: string,
    body: string
  ): Promise<NotificationResult>;
}

/**
 * 建立通知服務實例
 */
export function createNotificationService(_env: Env): NotificationService {
  // TODO: 根據環境變數選擇實際服務
  // 目前使用 Mock 實作
  return new MockNotificationService();
}

/**
 * Mock 通知服務（開發/測試用）
 * 實際發送前會替換為真實服務
 */
class MockNotificationService implements NotificationService {
  async sendSMS(phone: string, message: string): Promise<NotificationResult> {
    console.log(`[Mock SMS] To: ${phone}`);
    console.log(`[Mock SMS] Message: ${message}`);

    // 模擬發送
    return {
      success: true,
      messageId: `mock-sms-${Date.now()}`,
    };
  }

  async sendEmail(
    email: string,
    subject: string,
    body: string
  ): Promise<NotificationResult> {
    console.log(`[Mock Email] To: ${email}`);
    console.log(`[Mock Email] Subject: ${subject}`);
    console.log(`[Mock Email] Body: ${body}`);

    // 模擬發送
    return {
      success: true,
      messageId: `mock-email-${Date.now()}`,
    };
  }
}

// ============================================================
// TODO: 以下為未來實作的服務類別範本
// ============================================================

/**
 * Twilio SMS 服務
 * 需要環境變數: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 */
// class TwilioSMSService implements NotificationService {
//   private accountSid: string;
//   private authToken: string;
//   private fromNumber: string;
//
//   constructor(accountSid: string, authToken: string, fromNumber: string) {
//     this.accountSid = accountSid;
//     this.authToken = authToken;
//     this.fromNumber = fromNumber;
//   }
//
//   async sendSMS(phone: string, message: string): Promise<NotificationResult> {
//     const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
//
//     const response = await fetch(url, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/x-www-form-urlencoded",
//         Authorization: `Basic ${btoa(`${this.accountSid}:${this.authToken}`)}`,
//       },
//       body: new URLSearchParams({
//         To: phone,
//         From: this.fromNumber,
//         Body: message,
//       }),
//     });
//
//     const result = await response.json();
//
//     if (response.ok) {
//       return { success: true, messageId: result.sid };
//     }
//     return { success: false, error: result.message };
//   }
//
//   async sendEmail(): Promise<NotificationResult> {
//     return { success: false, error: "Twilio service does not support email" };
//   }
// }

/**
 * Resend Email 服務
 * 需要環境變數: RESEND_API_KEY
 */
// class ResendEmailService implements NotificationService {
//   private apiKey: string;
//   private fromEmail: string;
//
//   constructor(apiKey: string, fromEmail: string) {
//     this.apiKey = apiKey;
//     this.fromEmail = fromEmail;
//   }
//
//   async sendSMS(): Promise<NotificationResult> {
//     return { success: false, error: "Resend service does not support SMS" };
//   }
//
//   async sendEmail(
//     email: string,
//     subject: string,
//     body: string
//   ): Promise<NotificationResult> {
//     const response = await fetch("https://api.resend.com/emails", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${this.apiKey}`,
//       },
//       body: JSON.stringify({
//         from: this.fromEmail,
//         to: email,
//         subject,
//         text: body,
//       }),
//     });
//
//     const result = await response.json();
//
//     if (response.ok) {
//       return { success: true, messageId: result.id };
//     }
//     return { success: false, error: result.message };
//   }
// }
