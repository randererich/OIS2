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
import AdminPassword from "./pages/admin/AdminHome.vue";
import AdminInventoryCount from "./pages/admin/AdminInventoryCount.vue";
import AdminInventoryReports from "./pages/admin/AdminInventoryReports.vue";
import AdminPurchases from "./pages/admin/AdminPurchases.vue";
import AdminStockOverview from "./pages/admin/AdminStockOverview.vue";
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
  { path: "/admin", redirect: "/admin/products", meta: { requiresAdmin: true } },
  { path: "/admin/products", component: Products, meta: { requiresAdmin: true } },
  { path: "/admin/categories", component: AdminCategories, meta: { requiresAdmin: true } },
  { path: "/admin/people", component: People, meta: { requiresAdmin: true } },
  { path: "/admin/inventory", component: AdminInventoryReports, meta: { requiresAdmin: true } },
  { path: "/admin/stock-overview", component: AdminStockOverview, meta: { requiresAdmin: true } },
  { path: "/admin/stock-add", redirect: "/admin/stock-overview", meta: { requiresAdmin: true } },
  { path: "/admin/inventory-count", component: AdminInventoryCount, meta: { requiresAdmin: true } },
  { path: "/admin/inventory-reports", redirect: "/admin/inventory", meta: { requiresAdmin: true } },
  { path: "/admin/purchases", component: AdminPurchases, meta: { requiresAdmin: true } },
  { path: "/admin/password", component: AdminPassword, meta: { requiresAdmin: true } }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to, from) => {
  if (from.meta.requiresAdmin && !to.meta.requiresAdmin) {
    clearAdminAuth();
  }

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
