import "dotenv/config";
import { query, transaction } from "../src/db.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || !args.has("--yes");

async function ensureCompatibility(client) {
  await client.query(
    "ALTER TABLE purchases ADD COLUMN IF NOT EXISTS affects_debt BOOLEAN NOT NULL DEFAULT TRUE"
  );

  await client.query(
    `CREATE OR REPLACE VIEW person_debts AS
     SELECT
       p.id,
       p.first_name,
       p.last_name,
       p.coetus,
       p.konvent,
       COALESCE(purchases.total, 0) +
         CASE
           WHEN lower(p.first_name) = lower('Sula')
            AND lower(p.last_name) = lower('Raha')
           THEN COALESCE(payments.total, 0)
           ELSE -COALESCE(payments.total, 0)
         END AS debt
     FROM people p
     LEFT JOIN (
       SELECT person_id, SUM(total_price) AS total
       FROM purchases
       WHERE is_cancelled = FALSE
         AND affects_debt = TRUE
       GROUP BY person_id
     ) purchases ON purchases.person_id = p.id
     LEFT JOIN (
       SELECT person_id, SUM(amount) AS total
       FROM payments
       GROUP BY person_id
     ) payments ON payments.person_id = p.id`
  );
}

async function getCounts() {
  const result = await query(`
    SELECT 'debt_affecting_purchases' AS label, COUNT(*)::INT AS row_count
    FROM purchases
    WHERE is_cancelled = FALSE AND affects_debt = TRUE
    UNION ALL
    SELECT 'stats_only_purchases' AS label, COUNT(*)::INT AS row_count
    FROM purchases
    WHERE affects_debt = FALSE
    UNION ALL
    SELECT 'payments' AS label, COUNT(*)::INT AS row_count
    FROM payments
    ORDER BY label
  `);

  return result.rows;
}

async function printCounts(title) {
  console.log(title);
  for (const row of await getCounts()) {
    console.log(`- ${row.label}: ${row.row_count}`);
  }
}

async function main() {
  await transaction(async (client) => {
    await ensureCompatibility(client);
  });

  await printCounts("Current fresh-start state:");

  if (dryRun) {
    console.log("");
    console.log("Dry-run only. Add --yes to mark all purchases as stats-only and clear payments.");
    console.log("This keeps purchases available for statistics, but starts everyone with zero debt.");
    return;
  }

  await transaction(async (client) => {
    await ensureCompatibility(client);
    await client.query("UPDATE purchases SET affects_debt = FALSE WHERE affects_debt = TRUE");
    await client.query("TRUNCATE TABLE payments RESTART IDENTITY");
  });

  console.log("");
  await printCounts("Fresh start prepared:");
}

main().catch((error) => {
  console.error("Failed to prepare fresh start:");
  console.error(error);
  process.exit(1);
});
