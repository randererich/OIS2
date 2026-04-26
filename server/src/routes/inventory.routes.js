import { Router } from "express";
import {
	createInventoryReportController,
	getInventory,
	getInventoryCountProducts
} from "../controllers/inventory.controller.js";

const router = Router();

router.get("/", getInventory);
router.get("/count-products", getInventoryCountProducts);
router.post("/reports", createInventoryReportController);

export default router;
