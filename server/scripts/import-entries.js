import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query, transaction } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const replace = args.has("--replace");
const append = args.has("--append");
const affectsDebt = args.has("--affects-debt");
const entriesPathArg = process.argv.find((arg) => arg.startsWith("--entries="))?.split("=")[1];
const productsPathArg = process.argv.find((arg) => arg.startsWith("--products="))?.split("=")[1];
const ENTRIES_CSV_PATH = path.resolve(
  entriesPathArg || process.env.KIRJED_CSV_PATH || path.join(__dirname, "../../database/Kirjed.csv")
);
const PRODUCTS_CSV_PATH = path.resolve(
  productsPathArg || process.env.TOOTED_CSV_PATH || path.join(__dirname, "../../database/Tooted.csv")
);
const batchSizeArg = Number.parseInt(
  process.argv.find((arg) => arg.startsWith("--batch-size="))?.split("=")[1] || "1000",
  10
);
const batchSize = Number.isInteger(batchSizeArg) && batchSizeArg > 0 ? batchSizeArg : 1000;

const PRODUCTS_TO_IMPORT = [
  {
    name: "Pilsner",
    category: "ÕLU",
    unit: "tk",
    aliases: ["Pilsner"],
  },
  {
    name: "Alexander",
    category: "ÕLU",
    unit: "tk",
    aliases: ["Alexander"],
  },
  {
    name: "Premium",
    category: "ÕLU",
    unit: "tk",
    aliases: ["Premium"],
  },
  {
    name: "Premium Purk 0.33L",
    category: "ÕLU",
    unit: "tk",
    aliases: ["Premium Purk 0.33L", "Premium 0.33"],
  },
  {
    name: "Hoggys Yuzu",
    category: "MUU LAHJA",
    unit: "tk",
    aliases: ["Hoggys Yuzu"],
  },
  {
    name: "Longero 0.33",
    category: "MUU LAHJA",
    unit: "tk",
    aliases: ["Longero 0,33"],
  },
  {
    name: "Fassbrause",
    category: "KRAADITA JOOK",
    unit: "tk",
    aliases: ["Fassbrause"],
  },
  {
    name: "Kali",
    category: "KRAADITA JOOK",
    unit: "tk",
    aliases: ["Kali"],
  },
  {
    name: "Limonaad",
    category: "KRAADITA JOOK",
    unit: "tk",
    aliases: ["Limonaad"],
  },
  {
    name: "Kiirnuudlid",
    category: "SÖÖK JA NÄKS",
    unit: "tk",
    aliases: ["Kiirnuudlid"],
  },
  {
    name: "Rumm",
    category: "KANGE ALKOHOL",
    unit: "cl",
    aliases: ["Rumm"],
  },
  {
    name: "Viski",
    category: "KANGE ALKOHOL",
    unit: "cl",
    aliases: ["Viski"],
  },
  {
    name: "Konjak",
    category: "KANGE ALKOHOL",
    unit: "cl",
    aliases: ["Konjak"],
  },
  {
    name: "Viin",
    category: "KANGE ALKOHOL",
    unit: "cl",
    aliases: ["Viin"],
  },
  {
    name: "Liköör",
    category: "KANGE ALKOHOL",
    unit: "cl",
    aliases: ["Koskenkorva liköör"],
  },
  {
    name: "Gin",
    category: "KANGE ALKOHOL",
    unit: "cl",
    aliases: ["Gin"],
  },
];

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
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

function readCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`CSV file not found: ${filePath}`);
    process.exit(1);
  }

  const lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/);
  while (lines.length && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  const headers = parseCSVLine(lines[0]).map((header) => header.trim());
  const headerMap = {};
  headers.forEach((header, index) => {
    headerMap[header] = index;
  });

  return { lines: lines.slice(1), headerMap };
}

function getValue(values, headerMap, header) {
  return values[headerMap[header]]?.trim() || "";
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).trim());
  return Number.isFinite(number) ? number : null;
}

function parseInteger(value) {
  const number = parseNumber(value);
  return Number.isInteger(number) ? number : null;
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("et");
}

function normalizeComment(comment) {
  const trimmed = String(comment || "").trim();
  return trimmed || null;
}

function toTallinnTimestamp(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  return `${trimmed} Europe/Tallinn`;
}

function validateHeaders(headerMap, requiredHeaders, label) {
  for (const header of requiredHeaders) {
    if (!(header in headerMap)) {
      console.error(`Missing required ${label} header: ${header}`);
      process.exit(1);
    }
  }
}

function readLegacyProducts() {
  const { lines, headerMap } = readCSV(PRODUCTS_CSV_PATH);
  validateHeaders(
    headerMap,
    ["toode", "hind", "nimi"],
    "product"
  );

  const productsById = new Map();

  for (const line of lines) {
    if (!line.trim()) continue;
    const values = parseCSVLine(line);
    const id = parseNumber(getValue(values, headerMap, "toode"));
    let name = getValue(values, headerMap, "nimi");
    const price = parseNumber(getValue(values, headerMap, "hind"));

    if (name === "Longero 0" && getValue(values, headerMap, "ostuhind") === "33") {
      name = "Longero 0,33";
    }

    if (Number.isInteger(id) && name) {
      productsById.set(id, {
        id,
        name,
        normalizedName: normalizeName(name),
        price: price ?? 0,
      });
    }
  }

  return productsById;
}

function buildLegacyProductMap(legacyProducts) {
  const aliases = new Map();
  const matchedLegacyProducts = [];

  for (const productConfig of PRODUCTS_TO_IMPORT) {
    for (const alias of productConfig.aliases) {
      aliases.set(normalizeName(alias), productConfig);
    }
  }

  const legacyProductMap = new Map();

  for (const legacyProduct of legacyProducts.values()) {
    const productConfig = aliases.get(legacyProduct.normalizedName);
    if (!productConfig) continue;

    legacyProductMap.set(legacyProduct.id, {
      ...productConfig,
      legacyId: legacyProduct.id,
      legacyName: legacyProduct.name,
      legacyPrice: legacyProduct.price,
    });
    matchedLegacyProducts.push(`${legacyProduct.id}: ${legacyProduct.name} -> ${productConfig.name}`);
  }

  return { legacyProductMap, matchedLegacyProducts };
}

async function readExistingPeople() {
  const result = await query("SELECT id FROM people");
  return new Set(result.rows.map((row) => Number(row.id)));
}

async function hasTableColumn(tableName, columnName) {
  const result = await query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS exists`,
    [tableName, columnName]
  );

  return Boolean(result.rows[0]?.exists);
}

async function ensureProducts() {
  const result = await query(
    `SELECT p.id, p.name
     FROM products p`
  );

  const existingByName = new Map(
    result.rows.map((product) => [normalizeName(product.name), Number(product.id)])
  );
  const productIds = new Map();
  const hasProductUnit = await hasTableColumn("products", "unit");

  await transaction(async (client) => {
    for (let i = 0; i < PRODUCTS_TO_IMPORT.length; i++) {
      const productConfig = PRODUCTS_TO_IMPORT[i];
      const existingId = [
        productConfig.name,
        ...productConfig.aliases,
      ]
        .map((name) => existingByName.get(normalizeName(name)))
        .find(Boolean);

      if (existingId) {
        productIds.set(productConfig.name, existingId);
        continue;
      }

      const categoryResult = await client.query(
        "SELECT id FROM categories WHERE name = $1",
        [productConfig.category]
      );

      const categoryId = categoryResult.rows[0]?.id || null;
      const insertResult = hasProductUnit
        ? await client.query(
            `INSERT INTO products
               (category_id, name, price, stock_quantity, unit, is_visible, is_inventory_tracked, sort_order)
             VALUES ($1, $2, $3, 0, $4, TRUE, FALSE, $5)
             RETURNING id`,
            [
              categoryId,
              productConfig.name,
              0,
              productConfig.unit,
              1000 + i,
            ]
          )
        : await client.query(
            `INSERT INTO products
               (category_id, name, price, stock_quantity, is_visible, is_inventory_tracked, sort_order)
             VALUES ($1, $2, $3, 0, TRUE, FALSE, $4)
             RETURNING id`,
            [
              categoryId,
              productConfig.name,
              0,
              1000 + i,
            ]
          );

      productIds.set(productConfig.name, Number(insertResult.rows[0].id));
    }

    await client.query(
      `SELECT SETVAL(
         'products_id_seq',
         GREATEST((SELECT COALESCE(MAX(id), 0) FROM products), 1),
         (SELECT COUNT(*) > 0 FROM products)
       )`
    );
  });

  return productIds;
}

async function ensurePurchaseSchemaCompatibility() {
  await query(
    "ALTER TABLE purchases ALTER COLUMN quantity TYPE NUMERIC(10,2) USING quantity::numeric"
  );
  await query(
    "ALTER TABLE purchases ADD COLUMN IF NOT EXISTS affects_debt BOOLEAN NOT NULL DEFAULT TRUE"
  );
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function buildInsert(tableName, columns, rows) {
  const params = [];
  const valuesSql = rows.map((row) => {
    const placeholders = row.map((value) => {
      params.push(value);
      return `$${params.length}`;
    });
    return `(${placeholders.join(", ")})`;
  });

  return {
    text: `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES ${valuesSql.join(", ")}`,
    params,
  };
}

async function insertInBatches(client, tableName, columns, rows) {
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const insert = buildInsert(tableName, columns, batch);
    await client.query(insert.text, insert.params);
  }
}

function mapEntries({ productIds, legacyProductMap, peopleIds }) {
  const { lines, headerMap } = readCSV(ENTRIES_CSV_PATH);
  validateHeaders(
    headerMap,
    ["kirje", "aeg", "Tooted_toode", "Isikud_isik", "kogus", "summa", "komment"],
    "entry"
  );

  const purchases = [];
  const perProduct = new Map();
  const stats = {
    parsed: 0,
    importedPurchases: 0,
    skippedNotWhitelisted: 0,
    skippedNonPurchaseRows: 0,
    skippedMissingPerson: 0,
    skippedBadRows: 0,
  };
  const missingPeople = new Set();

  for (const line of lines) {
    if (!line.trim()) continue;

    stats.parsed++;

    const values = parseCSVLine(line);
    const createdAt = toTallinnTimestamp(getValue(values, headerMap, "aeg"));
    const legacyProductId = parseInteger(getValue(values, headerMap, "Tooted_toode"));
    const personId = parseInteger(getValue(values, headerMap, "Isikud_isik"));
    const quantity = parseNumber(getValue(values, headerMap, "kogus"));
    const totalPrice = parseNumber(getValue(values, headerMap, "summa"));
    const comment = normalizeComment(getValue(values, headerMap, "komment"));

    if (
      !createdAt ||
      legacyProductId === null ||
      personId === null ||
      quantity === null ||
      quantity === 0
    ) {
      stats.skippedBadRows++;
      continue;
    }

    if (legacyProductId === 0 || personId === 0) {
      stats.skippedNonPurchaseRows++;
      continue;
    }

    const productConfig = legacyProductMap.get(legacyProductId);
    if (!productConfig) {
      stats.skippedNotWhitelisted++;
      continue;
    }

    if (!peopleIds.has(personId)) {
      missingPeople.add(personId);
      stats.skippedMissingPerson++;
      continue;
    }

    const productId = productIds.get(productConfig.name);
    const resolvedTotalPrice = roundMoney(totalPrice ?? quantity * productConfig.legacyPrice);
    const unitPrice =
      quantity === 0 ? productConfig.legacyPrice : roundMoney(resolvedTotalPrice / quantity);

    purchases.push([
      personId,
      productId,
      quantity,
      unitPrice,
      resolvedTotalPrice,
      comment,
      createdAt,
      false,
      affectsDebt,
    ]);

    const productStats = perProduct.get(productConfig.name) || {
      rows: 0,
      quantity: 0,
      revenue: 0,
    };
    productStats.rows += 1;
    productStats.quantity += quantity;
    productStats.revenue += resolvedTotalPrice;
    perProduct.set(productConfig.name, productStats);
    stats.importedPurchases++;
  }

  return { purchases, perProduct, stats, missingPeople };
}

async function assertCanImport() {
  const result = await query("SELECT COUNT(*)::INT AS row_count FROM purchases");
  const rowCount = Number(result.rows[0].row_count);

  if (rowCount > 0 && !replace && !append) {
    console.error(`Purchases already contains ${rowCount} rows.`);
    console.error("Use --replace to clear purchases first, or --append to add anyway.");
    process.exit(1);
  }
}

function printSummary({ matchedLegacyProducts, mapped }) {
  console.log("");
  console.log("Matched legacy products:");
  for (const match of matchedLegacyProducts) {
    console.log(`- ${match}`);
  }

  console.log("");
  console.log("Stats-only Kirjed mapping:");
  console.log(`- Imported rows affect debts: ${affectsDebt ? "yes" : "no"}`);
  console.log(`- Rows parsed: ${mapped.stats.parsed}`);
  console.log(`- Purchases to import: ${mapped.stats.importedPurchases}`);
  console.log(`- Skipped non-whitelisted product rows: ${mapped.stats.skippedNotWhitelisted}`);
  console.log(`- Skipped non-purchase rows: ${mapped.stats.skippedNonPurchaseRows}`);
  console.log(`- Skipped missing person rows: ${mapped.stats.skippedMissingPerson}`);
  console.log(`- Skipped bad rows: ${mapped.stats.skippedBadRows}`);

  if (mapped.missingPeople.size) {
    console.log(`- Missing people: ${mapped.missingPeople.size}`);
    console.log(`  Sample: ${[...mapped.missingPeople].slice(0, 20).join(", ")}`);
  }

  console.log("");
  console.log("Per-product totals:");
  for (const [name, productStats] of [...mapped.perProduct.entries()].sort()) {
    console.log(
      `- ${name}: ${productStats.rows} rows, quantity ${productStats.quantity.toFixed(2)}, revenue ${productStats.revenue.toFixed(2)}`
    );
  }
}

async function importEntries() {
  console.log(`Reading entries from: ${ENTRIES_CSV_PATH}`);
  console.log(`Reading legacy products from: ${PRODUCTS_CSV_PATH}`);

  const legacyProducts = readLegacyProducts();
  const { legacyProductMap, matchedLegacyProducts } = buildLegacyProductMap(legacyProducts);
  const peopleIds = await readExistingPeople();

  if (!dryRun) {
    await assertCanImport();
    await ensurePurchaseSchemaCompatibility();
  }

  const productIds = dryRun
    ? new Map(PRODUCTS_TO_IMPORT.map((product, index) => [product.name, -(index + 1)]))
    : await ensureProducts();

  const mapped = mapEntries({
    productIds,
    legacyProductMap,
    peopleIds,
  });

  printSummary({ matchedLegacyProducts, mapped });

  if (dryRun) {
    console.log("");
    console.log("Dry-run only. Run without --dry-run to import.");
    return;
  }

  await transaction(async (client) => {
    if (replace) {
      console.log("");
      console.log("Replacing purchases...");
      await client.query("TRUNCATE TABLE purchases RESTART IDENTITY");
    }

    console.log("");
    console.log(`Importing ${mapped.purchases.length} purchase rows...`);
    await insertInBatches(
      client,
      "purchases",
      [
        "person_id",
        "product_id",
        "quantity",
        "unit_price",
        "total_price",
        "comment",
        "created_at",
        "is_cancelled",
        "affects_debt",
      ],
      mapped.purchases
    );

    await client.query(
      `SELECT SETVAL(
         'purchases_id_seq',
         GREATEST((SELECT COALESCE(MAX(id), 0) FROM purchases), 1),
         (SELECT COUNT(*) > 0 FROM purchases)
       )`
    );
  });

  console.log("");
  console.log("Import complete.");
}

importEntries().catch((error) => {
  console.error("");
  console.error("Failed to import legacy entries:");
  console.error(error);
  process.exit(1);
});
