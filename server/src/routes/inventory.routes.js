import { Router } from "express";
import {
	createInventoryReportController,
	getInventory,
	getInventoryCountProducts,
	getInventoryReportById,
	getInventoryReports
} from "../controllers/inventory.controller.js";

const router = Router();

router.get("/", getInventory);
router.get("/count-products", getInventoryCountProducts);
router.post("/reports", createInventoryReportController);
router.get("/reports", getInventoryReports);
router.get("/reports/:id", getInventoryReportById);

export default router;
