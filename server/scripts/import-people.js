import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query, transaction } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const peoplePathArg = process.argv.find((arg) => arg.startsWith("--people="))?.split("=")[1];
const CSV_PATH = path.resolve(
  peoplePathArg || process.env.ISIKUD_CSV_PATH || path.join(__dirname, "../../database/Isikud.csv")
);

// Simple CSV parser that handles edge cases
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

function normalizeCoetus(coetus) {
  if (!coetus || coetus.trim() === "") return null;
  // Fix malformed coetus: "2003 II" -> "2003/II"
  return coetus.trim().replace(/^(\d{4})\s+(I{1,2})$/, "$1/$2");
}

function normalizeEmail(email) {
  if (!email || email.trim() === "") return null;
  const trimmed = email.trim();
  if (!trimmed) return null;

  // Basic email validation - check for @ and sensible format
  if (!trimmed.includes("@")) {
    console.warn(`  ⚠ Skipped malformed email: ${trimmed}`);
    return null;
  }

  // Fix common issues like comma in domain
  const fixed = trimmed.replace(/,(?=[a-z])/g, ".");
  return fixed;
}

async function importPeople() {
  console.log(`\n📂 Reading CSV from: ${CSV_PATH}`);

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ CSV file not found: ${CSV_PATH}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = fileContent.split("\n");

  console.log(`📄 Total lines in CSV: ${lines.length}`);

  // Skip empty last line
  while (lines.length && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map((h) => h.trim());
  console.log(`📋 Headers: ${headers.join(", ")}`);

  const headerMap = {};
  headers.forEach((header, idx) => {
    headerMap[header] = idx;
  });

  // Validate header
  const requiredHeaders = ["isik", "eesnimi", "perenimi"];
  for (const h of requiredHeaders) {
    if (!(h in headerMap)) {
      console.error(`❌ Missing required header: ${h}`);
      process.exit(1);
    }
  }

  // Parse data rows
  const records = [];
  let parseErrors = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const values = parseCSVLine(line);
      const record = {
        isik: values[headerMap.isik]?.trim(),
        eesnimi: values[headerMap.eesnimi]?.trim(),
        perenimi: values[headerMap.perenimi]?.trim(),
        email: values[headerMap.email]?.trim() || null,
        konvent: values[headerMap.konvent]?.trim() || null,
        coetus: values[headerMap.coetus]?.trim() || null,
      };

      // Basic validation
      if (!record.isik || !record.eesnimi || !record.perenimi) {
        parseErrors++;
        continue;
      }

      records.push(record);
    } catch (e) {
      parseErrors++;
      console.warn(`  ⚠ Failed to parse line ${i}: ${e.message}`);
    }
  }

  console.log(`✅ Parsed ${records.length} valid records (${parseErrors} errors)`);

  // Display sample
  console.log(`\n📊 Sample records:`);
  for (let i = 0; i < Math.min(3, records.length); i++) {
    const r = records[i];
    console.log(
      `  [${r.isik}] ${r.eesnimi} ${r.perenimi} (${r.konvent}/${r.coetus})`
    );
  }

  if (dryRun) {
    console.log(
      `\n⏭️  Dry-run mode: showing stats only. Run again without --dry-run to import.`
    );
    return;
  }

  console.log(`\n⏳ Importing ${records.length} people...`);

  let importedCount = 0;
  let skippedCount = 0;

  try {
    await transaction(async (client) => {
      for (const record of records) {
        const id = Number(record.isik);
        const firstName = record.eesnimi;
        const lastName = record.perenimi;
        const email = normalizeEmail(record.email);
        const konvent = record.konvent || null;
        const coetus = normalizeCoetus(record.coetus);

        if (!Number.isInteger(id) || id <= 0) {
          skippedCount++;
          continue;
        }

        try {
          const result = await client.query(
            `INSERT INTO people (id, first_name, last_name, email, konvent, coetus, is_visible, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, true, $7)
             ON CONFLICT (id) DO UPDATE SET
               first_name = EXCLUDED.first_name,
               last_name = EXCLUDED.last_name,
               email = COALESCE(EXCLUDED.email, people.email),
               konvent = EXCLUDED.konvent,
               coetus = EXCLUDED.coetus
             RETURNING id`,
            [id, firstName, lastName, email, konvent, coetus, id]
          );

          if (result.rowCount > 0) {
            importedCount++;
          }
        } catch (err) {
          console.error(`  ❌ Failed to import [${id}] ${firstName} ${lastName}: ${err.message}`);
          skippedCount++;
        }
      }

      // Update sequence to max(id) + 1
      await client.query(`SELECT SETVAL('people_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM people))`);
    });

    console.log(`\n✅ Import complete!`);
    console.log(`  Imported: ${importedCount}`);
    console.log(`  Skipped: ${skippedCount}`);

    // Verification
    const finalCount = await query(`SELECT COUNT(*) FROM people`);
    console.log(`  Total in DB: ${finalCount.rows[0].count}`);
  } catch (error) {
    console.error(`\n❌ Import failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

importPeople();
