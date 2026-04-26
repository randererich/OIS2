import { Router } from "express";
import {
  getPeople,
  getPersonBalance,
  getPersonMonthlyPurchases,
  getRecentBuyers,
  getVisiblePeople
} from "../controllers/people.controller.js";

const router = Router();

router.get("/", getPeople);
router.get("/visible", getVisiblePeople);
router.get("/recent-buyers", getRecentBuyers);
router.get("/:id/balance", getPersonBalance);
router.get("/:id/monthly-purchases", getPersonMonthlyPurchases);

export default router;
