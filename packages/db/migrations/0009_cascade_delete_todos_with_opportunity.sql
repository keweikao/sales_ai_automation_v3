-- Migration: Cascade delete todos when opportunity is deleted
-- Description: 修改 sales_todos.opportunity_id 外鍵約束，從 SET NULL 改為 CASCADE
--              當刪除 opportunity 時，連帶刪除所有關聯的 todos

-- Step 1: 刪除舊的外鍵約束
ALTER TABLE "sales_todos"
  DROP CONSTRAINT IF EXISTS "sales_todos_opportunity_id_opportunities_id_fk";

-- Step 2: 新增 CASCADE 外鍵約束
ALTER TABLE "sales_todos"
  ADD CONSTRAINT "sales_todos_opportunity_id_opportunities_id_fk"
  FOREIGN KEY ("opportunity_id")
  REFERENCES "opportunities"("id")
  ON DELETE CASCADE;
