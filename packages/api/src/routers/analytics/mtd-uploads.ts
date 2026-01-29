/**
 * MTD Uploads Module
 * 取得當月至今的上傳列表
 */

import { db } from "@Sales_ai_automation_v3/db";
import {
  conversations,
  opportunities,
  user,
  userProfiles,
} from "@Sales_ai_automation_v3/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, gte, lte, ne } from "drizzle-orm";

import { protectedProcedure } from "../../index";
import { mtdUploadsSchema } from "./schemas";

// ============================================================
// Types
// ============================================================

/** MTD 上傳項目 */
export interface MtdUploadItem {
  id: string;
  salesRep: string;
  salesEmail: string;
  customerNumber: string;
  caseNumber: string;
  storeName: string;
  createdAt: string;
  status: string;
}

/** getMtdUploads 返回型別 */
export interface MtdUploadsResult {
  year: number;
  month: number;
  mtdStart: string;
  mtdEnd: string;
  totalCount: number;
  uploads: MtdUploadItem[];
}

// ============================================================
// MTD Uploads Procedure
// ============================================================

/**
 * 取得 MTD 上傳列表
 * - 只有 manager 和 admin 可以存取
 * - 支援指定年月查詢
 */
export const getMtdUploads = protectedProcedure
  .input(mtdUploadsSchema)
  .handler(async ({ input, context }): Promise<MtdUploadsResult> => {
    const userId = context.session?.user.id;

    if (!userId) {
      throw new ORPCError("UNAUTHORIZED");
    }

    // 檢查權限：只有 manager 和 admin 可以存取
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    });

    const role = profile?.role || "sales_rep";
    if (role !== "admin" && role !== "manager") {
      throw new ORPCError("FORBIDDEN", {
        message: "只有經理或管理員可以查看此報告",
      });
    }

    // 計算 MTD 日期範圍
    const now = new Date();
    const year = input.year || now.getFullYear();
    const month = input.month || now.getMonth() + 1;
    const mtdStart = new Date(year, month - 1, 1);
    const mtdEnd = new Date(year, month, 0, 23, 59, 59, 999);

    // 查詢 MTD 上傳列表
    const uploads = await db
      .select({
        id: conversations.id,
        salesRep: user.name,
        salesEmail: user.email,
        customerNumber: opportunities.customerNumber,
        caseNumber: conversations.caseNumber,
        storeName: opportunities.companyName,
        createdAt: conversations.createdAt,
        status: conversations.status,
      })
      .from(conversations)
      .leftJoin(user, eq(conversations.createdBy, user.id))
      .leftJoin(
        opportunities,
        eq(conversations.opportunityId, opportunities.id)
      )
      .where(
        and(
          gte(conversations.createdAt, mtdStart),
          lte(conversations.createdAt, mtdEnd),
          ne(conversations.status, "archived")
        )
      )
      .orderBy(desc(conversations.createdAt));

    return {
      year,
      month,
      mtdStart: mtdStart.toISOString(),
      mtdEnd: mtdEnd.toISOString(),
      totalCount: uploads.length,
      uploads: uploads.map((u) => ({
        id: u.id,
        salesRep: u.salesRep || "未知",
        salesEmail: u.salesEmail || "",
        customerNumber: u.customerNumber || "-",
        caseNumber: u.caseNumber || "-",
        storeName: u.storeName || "未設定",
        createdAt: u.createdAt?.toISOString() || "",
        status: u.status || "unknown",
      })),
    };
  });
