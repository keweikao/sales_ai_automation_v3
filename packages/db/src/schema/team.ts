import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * 團隊成員關係表
 * 用於建立經理-業務的管理關係
 *
 * 設計考量：
 * - 支援一對多：一個經理管理多個業務
 * - 支援多對多：一個業務可被多個經理管理（矩陣組織）
 * - 支援層級結構：經理也可以管理經理
 */
export const teamMembers = pgTable(
  "team_members",
  {
    id: text("id").primaryKey(),

    // 經理 ID（管理者）
    managerId: text("manager_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // 成員 ID（被管理者）
    memberId: text("member_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // 關係類型（未來擴展用）
    relationshipType: text("relationship_type").default("direct"), // direct, dotted-line, mentor

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // 確保同一對經理-成員關係不重複
    unique("team_members_manager_member_unique").on(
      table.managerId,
      table.memberId
    ),
    // 索引優化查詢
    index("team_members_manager_id_idx").on(table.managerId),
    index("team_members_member_id_idx").on(table.memberId),
  ]
);

// Relations
export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  manager: one(user, {
    fields: [teamMembers.managerId],
    references: [user.id],
    relationName: "managerRelation",
  }),
  member: one(user, {
    fields: [teamMembers.memberId],
    references: [user.id],
    relationName: "memberRelation",
  }),
}));

export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
