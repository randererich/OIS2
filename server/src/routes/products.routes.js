import { Router } from "express";
import { getProductMenu, getProducts } from "../controllers/products.controller.js";

const router = Router();

router.get("/", getProducts);
router.get("/menu", getProductMenu);

export default router;
