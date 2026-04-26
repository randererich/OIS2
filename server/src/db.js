import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

const columnExistsCache = new Map();

export async function hasTableColumn(tableName, columnName) {
  const key = `${tableName}.${columnName}`;
  if (columnExistsCache.has(key)) {
    return columnExistsCache.get(key);
  }

  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS exists`,
    [tableName, columnName]
  );

  const exists = Boolean(result.rows[0]?.exists);
  columnExistsCache.set(key, exists);
  return exists;
}

export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
