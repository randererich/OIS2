import { Router } from "express";
import {
  getCategoryBuyers,
  getCategoryTotals,
  getHighestCredits,
  getHighestDebts,
  getMonthTopProducts,
  getMonthTopSpenders,
  getProductBuyers,
  getTugevaimCoetus,
  getTopItemCounts,
  getTopProductsByQuantity,
  getTopProductsByRevenue,
  getTopSpenders
} from "../controllers/stats.controller.js";

const router = Router();

router.get("/top-spenders", getTopSpenders);
router.get("/top-item-counts", getTopItemCounts);
router.get("/top-products-by-quantity", getTopProductsByQuantity);
router.get("/top-products-by-revenue", getTopProductsByRevenue);
router.get("/category-totals", getCategoryTotals);
router.get("/tugevaim-coetus", getTugevaimCoetus);
router.get("/product/:id/buyers", getProductBuyers);
router.get("/category/:id/buyers", getCategoryBuyers);
router.get("/month/top-spenders", getMonthTopSpenders);
router.get("/month/top-products", getMonthTopProducts);
router.get("/highest-debts", getHighestDebts);
router.get("/highest-credits", getHighestCredits);

export default router;
