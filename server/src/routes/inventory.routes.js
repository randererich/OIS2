import { Router } from "express";
import {
	createInventoryReportController,
	getInventory,
	getInventoryCountProducts,
	getCashBalance
} from "../controllers/inventory.controller.js";

const router = Router();

router.get("/", getInventory);
router.get("/count-products", getInventoryCountProducts);
router.get("/cash-balance", getCashBalance);
router.post("/reports", createInventoryReportController);

export default router;
