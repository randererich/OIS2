import { Client } from 'pg';

(async () => {
  try {
    const client = new Client({
      connectionString: 'postgresql://konvent:konvent@localhost:5433/konvent_pos'
    });
    await client.connect();

    const res = await client.query(
      `SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
       FROM information_schema.columns
       WHERE table_schema='public' AND table_name IN ('products','purchases','inventory_movements','inventory_counts')
       ORDER BY table_name, ordinal_position`
    );

    console.log(JSON.stringify(res.rows, null, 2));
    await client.end();
  } catch (err) {
    console.error('ERROR', err);
    process.exit(1);
  }
})();
