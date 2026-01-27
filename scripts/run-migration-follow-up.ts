import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log('Adding follow_up_status and follow_up_set_at columns to conversations...');

  await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS follow_up_status text`;
  await sql`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS follow_up_set_at timestamp`;

  console.log('Migration completed successfully');

  // Verify
  const result = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'conversations'
    AND column_name IN ('follow_up_status', 'follow_up_set_at')
  `;
  console.log('Verified columns:', result);
}

main();
