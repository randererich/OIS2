import { Router } from "express";
import { getPurchases, postPurchase } from "../controllers/purchases.controller.js";

const router = Router();

router.get("/", getPurchases);
router.post("/", postPurchase);

export default router;
