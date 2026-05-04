import { query, transaction } from "../src/db.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || !args.has("--yes");

async function main() {
  const countsResult = await query(`
    SELECT 'people' AS table_name, COUNT(*)::INT AS row_count FROM people
    UNION ALL
    SELECT 'purchases' AS table_name, COUNT(*)::INT AS row_count FROM purchases
    UNION ALL
    SELECT 'payments' AS table_name, COUNT(*)::INT AS row_count FROM payments
    ORDER BY table_name
  `);

  console.log("Current row counts:");
  for (const row of countsResult.rows) {
    console.log(`- ${row.table_name}: ${row.row_count}`);
  }

  if (dryRun) {
    console.log("");
    console.log("Dry-run only. Add --yes to actually remove people and dependent rows.");
    console.log("This will truncate people, purchases, and payments, and restart their sequences.");
    return;
  }

  await transaction(async (client) => {
    await client.query("TRUNCATE TABLE people RESTART IDENTITY CASCADE");
  });

  const afterResult = await query(`
    SELECT 'people' AS table_name, COUNT(*)::INT AS row_count FROM people
    UNION ALL
    SELECT 'purchases' AS table_name, COUNT(*)::INT AS row_count FROM purchases
    UNION ALL
    SELECT 'payments' AS table_name, COUNT(*)::INT AS row_count FROM payments
    ORDER BY table_name
  `);

  console.log("");
  console.log("Cleanup complete:");
  for (const row of afterResult.rows) {
    console.log(`- ${row.table_name}: ${row.row_count}`);
  }
}

main().catch((error) => {
  console.error("Failed to reset people data:");
  console.error(error);
  process.exit(1);
});