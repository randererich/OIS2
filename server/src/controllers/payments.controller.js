import { query } from "../db.js";

export async function getPayments(req, res, next) {
  try {
    const result = await query(
      `SELECT pa.*, pe.first_name, pe.last_name
       FROM payments pa
       JOIN people pe ON pe.id = pa.person_id
       ORDER BY pa.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createPayment(req, res, next) {
  try {
    const { person_id, amount, comment } = req.body;

    if (!person_id || Number(amount) <= 0) {
      return res.status(400).json({ error: "person_id and positive amount are required" });
    }

    const personResult = await query("SELECT id FROM people WHERE id = $1", [Number(person_id)]);
    if (personResult.rowCount === 0) {
      return res.status(404).json({ error: "Person not found" });
    }

    const result = await query(
      `INSERT INTO payments (person_id, amount, comment)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [Number(person_id), Number(amount), comment || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function getDebts(req, res, next) {
  try {
    const q = (req.query.q || "").trim();

    if (q) {
      const result = await query(
        `SELECT *
         FROM person_debts
         WHERE CONCAT(first_name, ' ', last_name) ILIKE $1
            OR COALESCE(coetus, '') ILIKE $1
            OR COALESCE(konvent, '') ILIKE $1
         ORDER BY debt DESC, last_name ASC, first_name ASC
         LIMIT 300`,
        [`%${q}%`]
      );
      return res.json(result.rows);
    }

    const result = await query(
      `SELECT *
       FROM person_debts
       ORDER BY debt DESC, last_name ASC, first_name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}
