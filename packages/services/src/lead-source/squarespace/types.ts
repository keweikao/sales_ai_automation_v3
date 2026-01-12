/**
 * Squarespace Webhook Types
 * Squarespace 表單提交的 webhook payload 類型
 */

// Squarespace Form Submission Webhook Payload
export interface SquarespaceFormPayload {
  formId: string;
  formName: string;
  websiteId: string;
  createdOn: string; // ISO 8601 timestamp
  data: SquarespaceFormData;
}

export interface SquarespaceFormData {
  // 標準欄位
  fname?: string;
  lname?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  message?: string;

  // UTM 隱藏欄位
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;

  // 其他自訂欄位
  [key: string]: string | undefined;
}

// Squarespace Webhook Headers
export interface SquarespaceWebhookHeaders {
  "x-squarespace-signature"?: string;
  "content-type": string;
}

// 驗證結果
export interface SignatureVerificationResult {
  valid: boolean;
  error?: string;
}
