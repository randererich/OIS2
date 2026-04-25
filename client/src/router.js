import { createRouter, createWebHistory } from "vue-router";
import { clearAdminAuth, ensureAdminAuth } from "./api/client";
import AdminCategories from "./pages/Categories.vue";
import Debts from "./pages/Debts.vue";
import POSConfirm from "./pages/POSConfirm.vue";
import POSPersonSelect from "./pages/POSPersonSelect.vue";
import POSProductSelect from "./pages/POSProductSelect.vue";
import POSQuantity from "./pages/POSQuantity.vue";
import People from "./pages/People.vue";
import Products from "./pages/Products.vue";
import Purchases from "./pages/Purchases.vue";
import Stats from "./pages/Stats.vue";
import AdminHome from "./pages/admin/AdminHome.vue";
import AdminInventoryCount from "./pages/admin/AdminInventoryCount.vue";
import AdminInventoryReports from "./pages/admin/AdminInventoryReports.vue";
import AdminPurchases from "./pages/admin/AdminPurchases.vue";
import AdminStockAdd from "./pages/admin/AdminStockAdd.vue";
import Inventory from "./pages/Inventory.vue";

const routes = [
  { path: "/", component: POSProductSelect },
  { path: "/quantity", component: POSQuantity },
  { path: "/person", component: POSPersonSelect },
  { path: "/confirm", component: POSConfirm },
  { path: "/inventory", component: Inventory },
  { path: "/purchases", component: Purchases },
  { path: "/debts", component: Debts },
  { path: "/stats", component: Stats },
  { path: "/admin", component: AdminHome, meta: { requiresAdmin: true } },
  { path: "/admin/products", component: Products, meta: { requiresAdmin: true } },
  { path: "/admin/categories", component: AdminCategories, meta: { requiresAdmin: true } },
  { path: "/admin/people", component: People, meta: { requiresAdmin: true } },
  { path: "/admin/stock-overview", component: Inventory, meta: { requiresAdmin: true } },
  { path: "/admin/stock-add", component: AdminStockAdd, meta: { requiresAdmin: true } },
  { path: "/admin/inventory-count", component: AdminInventoryCount, meta: { requiresAdmin: true } },
  { path: "/admin/inventory-reports", component: AdminInventoryReports, meta: { requiresAdmin: true } },
  { path: "/admin/purchases", component: AdminPurchases, meta: { requiresAdmin: true } }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to) => {
  if (!to.meta.requiresAdmin) {
    return true;
  }

  try {
    await ensureAdminAuth();
    return true;
  } catch (error) {
    clearAdminAuth();
    window.alert("Admin autentimine ebaõnnestus.");
    return "/";
  }
});

export default router;
