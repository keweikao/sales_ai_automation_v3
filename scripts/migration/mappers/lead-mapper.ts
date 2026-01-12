// scripts/migration/mappers/lead-mapper.ts

import type { Timestamp } from "firebase-admin/firestore";
import type { NewOpportunity } from "../../../packages/db/src/schema";
import type { FirestoreConversation, FirestoreLead } from "../types";

/**
 * V2 Lead Status → V3 Opportunity Status 映射
 */
export function mapLeadStatus(
  v2Status?: string
): NonNullable<NewOpportunity["status"]> {
  const mapping: Record<string, NonNullable<NewOpportunity["status"]>> = {
    new: "new",
    contacted: "contacted",
    qualified: "qualified",
    converted: "won",
    lost: "lost",
  };
  return mapping[v2Status || "new"] || "new";
}

/**
 * 生成客戶編號
 * 格式: YYYYMM-XXXXXX
 */
export function generateCustomerNumber(createdAt?: Timestamp): string {
  const date = createdAt?.toDate() || new Date();
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  const sequence = String(Math.floor(Math.random() * 999_999)).padStart(6, "0");
  return `${yearMonth}-${sequence}`;
}

/**
 * 從最新對話中提取公司名稱
 */
export function extractCompanyName(
  lead: FirestoreLead,
  latestConversation?: FirestoreConversation
): string {
  // 優先使用對話中的 store_name
  if (latestConversation?.analysis?.store_name) {
    return latestConversation.analysis.store_name;
  }

  // 使用 email 域名
  if (lead.email) {
    const domain = lead.email.split("@")[1];
    if (domain && !["gmail.com", "yahoo.com", "hotmail.com"].includes(domain)) {
      return domain.split(".")[0].toUpperCase();
    }
  }

  // 使用 ID 前綴
  return `Company_${lead.id?.slice(0, 8) || "Unknown"}`;
}

/**
 * 將 Firestore Lead 映射為 V3 Opportunity
 */
export function mapLeadToOpportunity(
  docId: string,
  lead: FirestoreLead,
  latestConversation?: FirestoreConversation,
  userId?: string
): NewOpportunity {
  return {
    id: docId,
    userId: userId || "migration-user", // 需要提供有效的 userId
    customerNumber: generateCustomerNumber(lead.created_at),
    companyName: extractCompanyName(lead, latestConversation),
    contactEmail: lead.email || null,
    status: mapLeadStatus(lead.status),
    source: "import", // 使用 import 作為遷移來源
    createdAt: lead.created_at?.toDate() || new Date(),
    updatedAt: lead.updated_at?.toDate() || new Date(),
  };
}
