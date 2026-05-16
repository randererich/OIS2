import "dotenv/config";
import { query, transaction } from "../src/db.js";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || !args.has("--yes");

async function ensureCompatibility(client) {
  await client.query(
    "ALTER TABLE purchases ADD COLUMN IF NOT EXISTS affects_debt BOOLEAN NOT NULL DEFAULT TRUE"
  );
  await client.query(
    "ALTER TABLE purchases ADD COLUMN IF NOT EXISTS paid_with_cash BOOLEAN NOT NULL DEFAULT FALSE"
  );
  await client.query(
    "ALTER TABLE purchases ADD COLUMN IF NOT EXISTS cash_operation TEXT"
  );
  await client.query(
    `CREATE TABLE IF NOT EXISTS debt_adjustments (
       id SERIAL PRIMARY KEY,
       person_id INT NOT NULL REFERENCES people(id),
       amount NUMERIC(10,2) NOT NULL CHECK (amount <> 0),
       operation TEXT NOT NULL,
       comment TEXT,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );
  await client.query(
    "CREATE INDEX IF NOT EXISTS idx_debt_adjustments_person ON debt_adjustments (person_id, created_at)"
  );

  await client.query(
    `CREATE OR REPLACE VIEW person_debts AS
     SELECT
       p.id,
       p.first_name,
       p.last_name,
       p.coetus,
       p.konvent,
       COALESCE(purchases.total, 0) - COALESCE(payments.total, 0) + COALESCE(adjustments.total, 0) AS debt
     FROM people p
     LEFT JOIN (
       SELECT
         person_id,
         SUM(
           CASE
             WHEN cash_operation = 'cash_deposit' THEN -ABS(total_price)
             WHEN cash_operation = 'cash_withdrawal' THEN ABS(total_price)
             WHEN affects_debt = TRUE THEN total_price
             ELSE 0
           END
         ) AS total
       FROM purchases
       WHERE is_cancelled = FALSE
       GROUP BY person_id
     ) purchases ON purchases.person_id = p.id
     LEFT JOIN (
       SELECT person_id, SUM(amount) AS total
       FROM payments
       GROUP BY person_id
     ) payments ON payments.person_id = p.id
     LEFT JOIN (
       SELECT person_id, SUM(amount) AS total
       FROM debt_adjustments
       GROUP BY person_id
     ) adjustments ON adjustments.person_id = p.id`
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
    UNION ALL
    SELECT 'debt_adjustments' AS label, COUNT(*)::INT AS row_count
    FROM debt_adjustments
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
    await client.query(
      `UPDATE purchases
       SET affects_debt = FALSE,
           paid_with_cash = FALSE,
           cash_operation = NULL
       WHERE affects_debt = TRUE
          OR paid_with_cash = TRUE
          OR cash_operation IS NOT NULL`
    );
    await client.query("TRUNCATE TABLE payments RESTART IDENTITY");
    await client.query("TRUNCATE TABLE debt_adjustments RESTART IDENTITY");
  });

  console.log("");
  await printCounts("Fresh start prepared:");
}

main().catch((error) => {
  console.error("Failed to prepare fresh start:");
  console.error(error);
  process.exit(1);
});
