import { query } from "../db.js";

export async function getProducts(req, res, next) {
  try {
    const result = await query(
      `SELECT p.*, c.name AS category_name, c.emoji AS category_emoji
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY c.sort_order ASC NULLS LAST, p.sort_order ASC, p.name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getProductMenu(req, res, next) {
  try {
    const result = await query(
      `SELECT
         c.id AS category_id,
         c.name AS category_name,
         c.emoji AS category_emoji,
         c.sort_order AS category_sort_order,
         p.id AS product_id,
         p.name AS product_name,
         p.price,
         p.stock_quantity,
         p.is_inventory_tracked,
         p.sort_order AS product_sort_order
       FROM categories c
       JOIN products p ON p.category_id = c.id
       WHERE c.is_visible = TRUE AND p.is_visible = TRUE
       ORDER BY c.sort_order ASC, p.sort_order ASC, p.name ASC`
    );

    const grouped = [];
    const byCategory = new Map();

    for (const row of result.rows) {
      if (!byCategory.has(row.category_id)) {
        const category = {
          id: row.category_id,
          name: row.category_name,
          emoji: row.category_emoji,
          sort_order: row.category_sort_order,
          products: []
        };
        byCategory.set(row.category_id, category);
        grouped.push(category);
      }

      byCategory.get(row.category_id).products.push({
        id: row.product_id,
        name: row.product_name,
        price: Number(row.price),
        stock_quantity: row.stock_quantity,
        is_inventory_tracked: row.is_inventory_tracked,
        sort_order: row.product_sort_order
      });
    }

    res.json(grouped);
  } catch (error) {
    next(error);
  }
}

export async function createProduct(req, res, next) {
  try {
    const {
      category_id,
      name,
      price,
      stock_quantity = 0,
      is_visible = true,
      is_inventory_tracked = true,
      sort_order
    } = req.body;

    if (!name || price === undefined || price === null) {
      return res.status(400).json({ error: "name and price are required" });
    }

    const resolvedCategoryId = category_id ? Number(category_id) : null;

    let resolvedSortOrder = Number(sort_order);
    if (!Number.isInteger(resolvedSortOrder) || resolvedSortOrder <= 0) {
      const sortResult = await query(
        `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
         FROM products
         WHERE category_id IS NOT DISTINCT FROM $1`,
        [resolvedCategoryId]
      );
      resolvedSortOrder = Number(sortResult.rows[0].next_sort_order);
    }

    const result = await query(
      `INSERT INTO products
         (category_id, name, price, stock_quantity, is_visible, is_inventory_tracked, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        resolvedCategoryId,
        name,
        Number(price),
        Number(stock_quantity) || 0,
        Boolean(is_visible),
        Boolean(is_inventory_tracked),
        resolvedSortOrder
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const id = Number(req.params.id);
    const {
      category_id,
      name,
      price,
      stock_quantity = 0,
      is_visible = true,
      is_inventory_tracked = true,
      sort_order
    } = req.body;

    if (!id || !name || price === undefined || price === null) {
      return res.status(400).json({ error: "id, name and price are required" });
    }

    const resolvedSortOrder =
      sort_order === undefined || sort_order === null || sort_order === ""
        ? null
        : Number(sort_order);

    const result = await query(
      `UPDATE products
       SET category_id = $1,
           name = $2,
           price = $3,
           stock_quantity = $4,
           is_visible = $5,
           is_inventory_tracked = $6,
           sort_order = COALESCE($7, sort_order)
       WHERE id = $8
       RETURNING *`,
      [
        category_id ? Number(category_id) : null,
        name,
        Number(price),
        Number(stock_quantity) || 0,
        Boolean(is_visible),
        Boolean(is_inventory_tracked),
        Number.isInteger(resolvedSortOrder) ? resolvedSortOrder : null,
        id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const id = Number(req.params.id);
    const result = await query("DELETE FROM products WHERE id = $1 RETURNING id", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
