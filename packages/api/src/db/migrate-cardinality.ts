/**
 * One-time migration script: Convert old target_cardinality format to dual-end cardinality.
 *
 * Old format: target_cardinality values were "1:1", "1:N", "N:1", "N:M", or "*" (DB default)
 * New format: source_cardinality + target_cardinality in mathematical interval format
 *
 * Mapping:
 * - "1:1" → sourceCardinality="1", targetCardinality="1"
 * - "1:N" → sourceCardinality="1", targetCardinality="*"
 * - "N:1" → sourceCardinality="*", targetCardinality="1"
 * - "N:M" → sourceCardinality="*", targetCardinality="*"
 * - "*"   → sourceCardinality="1", targetCardinality="*"
 */
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function migrate() {
  console.log('Starting cardinality migration...');

  // "1:N" and "*" both map to source="1", target="*"
  const r1 = await sql`UPDATE entity_relations SET source_cardinality = '1', target_cardinality = '*' WHERE target_cardinality IN ('1:N', '*')`;
  console.log(`Updated ${r1.count} rows: '1:N'/'*' → source='1', target='*'`);

  const r2 = await sql`UPDATE entity_relations SET source_cardinality = '1', target_cardinality = '1' WHERE target_cardinality = '1:1'`;
  console.log(`Updated ${r2.count} rows: '1:1' → source='1', target='1'`);

  const r3 = await sql`UPDATE entity_relations SET source_cardinality = '*', target_cardinality = '1' WHERE target_cardinality = 'N:1'`;
  console.log(`Updated ${r3.count} rows: 'N:1' → source='*', target='1'`);

  const r4 = await sql`UPDATE entity_relations SET source_cardinality = '*', target_cardinality = '*' WHERE target_cardinality = 'N:M'`;
  console.log(`Updated ${r4.count} rows: 'N:M' → source='*', target='*'`);

  // Verify no old-format values remain
  const remaining = await sql`SELECT id, target_cardinality FROM entity_relations WHERE target_cardinality IN ('1:1', '1:N', 'N:1', 'N:M')`;
  if (remaining.length > 0) {
    console.error(`WARNING: ${remaining.length} rows still have old-format cardinality!`);
    console.error(remaining);
  } else {
    console.log('Migration complete. No old-format values remain.');
  }

  await sql.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
