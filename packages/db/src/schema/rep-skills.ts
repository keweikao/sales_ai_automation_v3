import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * 業務技能評估表
 * 追蹤業務人員在各項銷售技能的表現與趨勢
 *
 * 技能領域範例：
 * - 異議處理 (Objection Handling)
 * - 價值呈現 (Value Presentation)
 * - 收尾技巧 (Closing Techniques)
 * - 需求探索 (Discovery)
 * - 關係建立 (Relationship Building)
 */
export type SkillTrend = "improving" | "stable" | "declining";

export const repSkills = pgTable(
  "rep_skills",
  {
    id: text("id").primaryKey(),

    // 關聯到業務人員
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // 技能資訊
    skillArea: text("skill_area").notNull(), // "異議處理", "價值呈現", "收尾技巧", "需求探索", "關係建立"
    score: integer("score"), // 1-100 的技能分數
    trend: text("trend").$type<SkillTrend>(), // 趨勢：improving, stable, declining

    // 分析與建議
    weakness: text("weakness"), // 識別出的弱點
    recommendation: text("recommendation"), // AI 提供的改進建議

    // 時間戳
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // 索引優化查詢
    index("rep_skills_user_id_idx").on(table.userId),
    index("rep_skills_skill_area_idx").on(table.skillArea),
    index("rep_skills_user_skill_idx").on(table.userId, table.skillArea),
  ]
);

// Relations
export const repSkillsRelations = relations(repSkills, ({ one }) => ({
  user: one(user, {
    fields: [repSkills.userId],
    references: [user.id],
  }),
}));

export type RepSkill = typeof repSkills.$inferSelect;
export type NewRepSkill = typeof repSkills.$inferInsert;
