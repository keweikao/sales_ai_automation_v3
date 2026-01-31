/**
 * PostgreSQL MCP Server Integration
 * 整合 Drizzle ORM 到 MCP 工具中，提供資料庫查詢和 schema 檢視功能
 */

import { db } from "@Sales_ai_automation_v3/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { MCPTool } from "../types.js";

// ============================================================
// PostgreSQL Query Tool
// ============================================================

const PostgresQueryInputSchema = z.object({
  query: z.string().min(1, "Query is required"),
  params: z.array(z.unknown()).optional(),
});

const PostgresQueryOutputSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
  rowCount: z.number(),
  fields: z.array(z.string()).optional(),
});

type PostgresQueryInput = z.infer<typeof PostgresQueryInputSchema>;
type PostgresQueryOutput = z.infer<typeof PostgresQueryOutputSchema>;

export const postgresQueryTool: MCPTool<
  PostgresQueryInput,
  PostgresQueryOutput
> = {
  name: "postgres_query",
  description:
    "執行 PostgreSQL SELECT 查詢。用於複雜的資料分析、報表生成、趨勢分析等。僅支援 SELECT 查詢以確保安全性。",
  inputSchema: PostgresQueryInputSchema,
  handler: async (input, _context) => {
    // 安全性檢查：僅允許 SELECT 查詢
    const trimmedQuery = input.query.trim().toLowerCase();
    if (!trimmedQuery.startsWith("select")) {
      throw new Error(
        "Only SELECT queries are allowed for security reasons. Use repair tools for data modifications."
      );
    }

    try {
      const result = await db.execute(sql.raw(input.query));

      return {
        rows: result.rows as Record<string, unknown>[],
        rowCount: result.rowCount ?? 0,
        fields: result.rows.length > 0 ? Object.keys(result.rows[0]!) : [],
      };
    } catch (error) {
      throw new Error(
        `PostgreSQL query failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};

// ============================================================
// PostgreSQL Schema Inspector Tool
// ============================================================

const PostgresSchemaInputSchema = z.object({
  tableName: z.string().optional(),
});

const PostgresSchemaOutputSchema = z.object({
  tables: z.array(
    z.object({
      name: z.string(),
      columns: z
        .array(
          z.object({
            name: z.string(),
            type: z.string(),
            nullable: z.boolean(),
          })
        )
        .optional(),
    })
  ),
});

type PostgresSchemaInput = z.infer<typeof PostgresSchemaInputSchema>;
type PostgresSchemaOutput = z.infer<typeof PostgresSchemaOutputSchema>;

export const postgresSchemaInspectorTool: MCPTool<
  PostgresSchemaInput,
  PostgresSchemaOutput
> = {
  name: "postgres_inspect_schema",
  description:
    "檢視資料庫 schema 結構，列出所有表或特定表的欄位定義。用於了解資料庫結構、產生查詢或驗證資料模型。",
  inputSchema: PostgresSchemaInputSchema,
  handler: async (input) => {
    try {
      let query: string;

      if (input.tableName) {
        // 查詢特定表的欄位
        query = `
          SELECT
            column_name as name,
            data_type as type,
            is_nullable = 'YES' as nullable
          FROM information_schema.columns
          WHERE table_name = '${input.tableName}'
            AND table_schema = 'public'
          ORDER BY ordinal_position
        `;
      } else {
        // 列出所有表
        query = `
          SELECT table_name as name
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `;
      }

      const result = await db.execute(sql.raw(query));

      if (input.tableName) {
        return {
          tables: [
            {
              name: input.tableName,
              columns: result.rows as {
                name: string;
                type: string;
                nullable: boolean;
              }[],
            },
          ],
        };
      }

      return {
        tables: (result.rows as { name: string }[]).map((row) => ({
          name: row.name,
        })),
      };
    } catch (error) {
      throw new Error(
        `Schema inspection failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};
