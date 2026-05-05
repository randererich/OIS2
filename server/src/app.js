import "dotenv/config";
import cors from "cors";
import express from "express";
import adminRoutes from "./routes/admin.routes.js";
import categoriesRoutes from "./routes/categories.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";
import peopleRoutes from "./routes/people.routes.js";
import productsRoutes from "./routes/products.routes.js";
import purchasesRoutes from "./routes/purchases.routes.js";
import statsRoutes from "./routes/stats.routes.js";
import { adminAuth } from "./middleware/adminAuth.js";
import { basicAuth } from "./middleware/basicAuth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { ensureCashSetup } from "./services/purchase.service.js";

const app = express();
const port = Number(process.env.PORT) || 3001;
const clientOrigins = (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || clientOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true
  })
);

app.use(express.json());

app.use("/api/admin", adminAuth, adminRoutes);

app.use("/api", basicAuth);

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/categories", categoriesRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/people", peopleRoutes);
app.use("/api/purchases", purchasesRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/stats", statsRoutes);

app.use(errorHandler);

ensureCashSetup()
  .then(() => {
    app.listen(port, () => {
      console.log(`Konvent ÕIS API listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize cash setup:");
    console.error(error);
    process.exit(1);
  });
