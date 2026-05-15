import { Router } from "express";
import {
  createCategory,
  deleteCategory,
  updateCategory
} from "../controllers/categories.controller.js";
import {
  createInventoryReportController,
  getInventory,
  getInventoryCountProducts,
  getInventoryMonthlyOverview,
  getInventoryReportById,
  getInventoryReports,
  postInventoryMovement,
  getCashBalance
} from "../controllers/inventory.controller.js";
import {
  createPerson,
  deletePerson,
  getPeople,
  updatePerson
} from "../controllers/people.controller.js";
import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct
} from "../controllers/products.controller.js";
import { getCategories } from "../controllers/categories.controller.js";
import { getPurchases } from "../controllers/purchases.controller.js";

const router = Router();

router.get("/health", (req, res) => {
  res.json({ ok: true });
});

router.get("/products", getProducts);
router.post("/products", createProduct);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);

router.get("/categories", getCategories);
router.post("/categories", createCategory);
router.put("/categories/:id", updateCategory);
router.delete("/categories/:id", deleteCategory);

router.get("/people", getPeople);
router.post("/people", createPerson);
router.put("/people/:id", updatePerson);
router.delete("/people/:id", deletePerson);

router.get("/purchases", getPurchases);

router.get("/inventory", getInventory);
router.post("/inventory/movement", postInventoryMovement);
router.get("/inventory/count-products", getInventoryCountProducts);
router.get("/inventory/cash-balance", getCashBalance);
router.get("/inventory/monthly-overview", getInventoryMonthlyOverview);
router.post("/inventory/reports", createInventoryReportController);
router.get("/inventory/reports", getInventoryReports);
router.get("/inventory/reports/:id", getInventoryReportById);

export default router;
