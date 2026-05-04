import { query } from "../db.js";

export async function getCategories(req, res, next) {
  try {
    const result = await query(
      `SELECT *
       FROM categories
       ORDER BY sort_order ASC, name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createCategory(req, res, next) {
  try {
    const { name, emoji, sort_order, is_visible = true } = req.body;
    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    let resolvedSortOrder = Number(sort_order);
    if (!Number.isInteger(resolvedSortOrder) || resolvedSortOrder <= 0) {
      const sortResult = await query(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order FROM categories"
      );
      resolvedSortOrder = Number(sortResult.rows[0].next_sort_order);
    }

    const result = await query(
      `INSERT INTO categories (name, emoji, sort_order, is_visible)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, emoji || null, resolvedSortOrder, Boolean(is_visible)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { name, emoji, sort_order, is_visible = true } = req.body;

    if (!Number.isInteger(id) || id <= 0 || !name) {
      return res.status(400).json({ error: "id and name are required" });
    }

    const resolvedSortOrder =
      sort_order === undefined || sort_order === null || sort_order === ""
        ? null
        : Number(sort_order);

    const result = await query(
      `UPDATE categories
       SET name = $1,
           emoji = $2,
           sort_order = COALESCE($3, sort_order),
           is_visible = $4
       WHERE id = $5
       RETURNING *`,
      [name, emoji || null, Number.isInteger(resolvedSortOrder) ? resolvedSortOrder : null, Boolean(is_visible), id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteCategory(req, res, next) {
  try {
    const id = Number(req.params.id);
    const result = await query("DELETE FROM categories WHERE id = $1 RETURNING id", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
