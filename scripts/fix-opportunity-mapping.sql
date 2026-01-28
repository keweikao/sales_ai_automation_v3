-- =====================================================
-- 診斷和修復商機關聯錯誤的案件
-- =====================================================
-- 可以在 Neon Dashboard SQL Editor 中執行

-- 步驟 1: 診斷 - 列出所有關聯可能錯誤的案件
-- (title 中的客戶名稱與 opportunity 的 company_name 不匹配)
SELECT
    c.case_number,
    c.title,
    -- 從 title 提取預期的客戶名稱
    CASE
        WHEN c.title LIKE '% - Slack 上傳'
        THEN REPLACE(c.title, ' - Slack 上傳', '')
        WHEN c.title LIKE 'Slack 上傳: % - %'
        THEN SPLIT_PART(REPLACE(c.title, 'Slack 上傳: ', ''), ' - ', 1)
        ELSE NULL
    END as expected_customer,
    o.company_name as current_opportunity,
    c.opportunity_id,
    c.id as conversation_id
FROM conversations c
LEFT JOIN opportunities o ON c.opportunity_id = o.id
WHERE c.case_number LIKE '202601-IC%'
ORDER BY c.case_number;

-- =====================================================
-- 步驟 2: 找出不匹配的案件
-- =====================================================
WITH extracted AS (
    SELECT
        c.id as conversation_id,
        c.case_number,
        c.title,
        c.opportunity_id,
        o.company_name as current_opportunity,
        CASE
            WHEN c.title LIKE '% - Slack 上傳'
            THEN TRIM(REPLACE(c.title, ' - Slack 上傳', ''))
            WHEN c.title LIKE 'Slack 上傳: % - %'
            THEN TRIM(SPLIT_PART(REPLACE(c.title, 'Slack 上傳: ', ''), ' - ', 1))
            ELSE NULL
        END as expected_customer
    FROM conversations c
    LEFT JOIN opportunities o ON c.opportunity_id = o.id
    WHERE c.case_number LIKE '202601-IC%'
)
SELECT
    case_number,
    title,
    expected_customer,
    current_opportunity,
    conversation_id,
    opportunity_id
FROM extracted
WHERE expected_customer IS NOT NULL
  AND expected_customer != ''
  AND LOWER(current_opportunity) NOT LIKE '%' || LOWER(expected_customer) || '%'
  AND LOWER(expected_customer) NOT LIKE '%' || LOWER(current_opportunity) || '%'
ORDER BY case_number;

-- =====================================================
-- 步驟 3: 修復 - 為每個不匹配的案件建立正確的商機
-- (請根據步驟 2 的結果，針對每個案件執行以下操作)
-- =====================================================

-- 範例：修復案件 202601-IC006 (花蓮便當)
-- 1. 先檢查是否已有「花蓮便當」商機
SELECT id, company_name FROM opportunities WHERE company_name LIKE '%花蓮便當%';

-- 2a. 如果有，更新 conversation 關聯
-- UPDATE conversations
-- SET opportunity_id = '找到的商機ID'
-- WHERE case_number = '202601-IC006';

-- 2b. 如果沒有，建立新商機並關聯
-- INSERT INTO opportunities (id, user_id, customer_number, company_name, source, status, product_line, notes, created_at, updated_at)
-- VALUES (
--     gen_random_uuid(),
--     'service-account',
--     '202601-' || LPAD(EXTRACT(EPOCH FROM NOW())::text, 6, '0'),
--     '花蓮便當',
--     'slack',
--     'new',
--     'ichef',
--     '由修復腳本建立',
--     NOW(),
--     NOW()
-- )
-- RETURNING id;
--
-- 然後更新 conversation:
-- UPDATE conversations
-- SET opportunity_id = '新建立的商機ID'
-- WHERE case_number = '202601-IC006';
