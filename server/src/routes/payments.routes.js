import { Router } from "express";
import {
  createPayment,
  getDebts,
  getPayments
} from "../controllers/payments.controller.js";

const router = Router();

router.get("/", getPayments);
router.post("/", createPayment);
router.get("/debts", getDebts);

export default router;
