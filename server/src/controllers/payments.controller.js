import { query, transaction } from "../db.js";

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

function normalizeDebtAdjustment(body) {
  const operation = String(body.operation || "").trim();
  const amount = Math.abs(Number(body.amount || 0));

  if (operation === "add") {
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: "positive amount is required" };
    }
    return { amount, operation: "debt_add" };
  }

  if (operation === "remove") {
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: "positive amount is required" };
    }
    return { amount: -amount, operation: "debt_remove" };
  }

  if (operation === "zero") {
    return { operation: "debt_zero" };
  }

  return { error: "operation must be add, remove or zero" };
}

export async function createDebtAdjustment(req, res, next) {
  try {
    const personId = Number(req.body.person_id);
    if (!personId) {
      return res.status(400).json({ error: "valid person_id is required" });
    }

    const normalized = normalizeDebtAdjustment(req.body);
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const result = await transaction(async (client) => {
      const lockResult = await client.query(
        "SELECT id FROM people WHERE id = $1 FOR UPDATE",
        [personId]
      );

      if (lockResult.rowCount === 0) {
        const error = new Error("Person not found");
        error.status = 404;
        throw error;
      }

      const personResult = await client.query(
        `SELECT id, first_name, last_name, debt
         FROM person_debts
         WHERE id = $1`,
        [personId]
      );

      const currentDebt = Number(personResult.rows[0].debt || 0);
      const amount = normalized.operation === "debt_zero"
        ? Number((-currentDebt).toFixed(2))
        : normalized.amount;

      if (!Number.isFinite(amount) || amount === 0) {
        const error = new Error("debt is already zero");
        error.status = 400;
        throw error;
      }

      const inserted = await client.query(
        `INSERT INTO debt_adjustments (person_id, amount, operation, comment)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          personId,
          amount,
          normalized.operation,
          String(req.body.comment || "").trim() || null
        ]
      );

      const balanceResult = await client.query(
        `SELECT id, first_name, last_name, coetus, konvent, debt
         FROM person_debts
         WHERE id = $1`,
        [personId]
      );

      return {
        adjustment: inserted.rows[0],
        person: balanceResult.rows[0]
      };
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function zeroSelectedDebts(req, res, next) {
  try {
    const personIds = Array.isArray(req.body.person_ids)
      ? [...new Set(req.body.person_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
      : [];

    if (!personIds.length) {
      return res.status(400).json({ error: "person_ids must include at least one valid person id" });
    }

    const result = await transaction(async (client) => {
      const lockResult = await client.query(
        `SELECT id
         FROM people
         WHERE id = ANY($1::INT[])
         ORDER BY id ASC
         FOR UPDATE`,
        [personIds]
      );

      if (lockResult.rowCount !== personIds.length) {
        const error = new Error("One or more people were not found");
        error.status = 404;
        throw error;
      }

      const inserted = await client.query(
        `INSERT INTO debt_adjustments (person_id, amount, operation, comment)
         SELECT id, -debt, 'debt_zero', $2
         FROM person_debts
         WHERE id = ANY($1::INT[])
           AND debt <> 0
         RETURNING *`,
        [personIds, String(req.body.comment || "").trim() || null]
      );

      const peopleResult = await client.query(
        `SELECT id, first_name, last_name, coetus, konvent, debt
         FROM person_debts
         WHERE id = ANY($1::INT[])
         ORDER BY debt DESC, last_name ASC, first_name ASC`,
        [personIds]
      );

      return {
        count: inserted.rowCount,
        adjustments: inserted.rows,
        people: peopleResult.rows
      };
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
