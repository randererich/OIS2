<template>
  <section class="page">
    <h2>Statistika</h2>

    <div class="form-grid">
      <label>
        Statistika liik
        <select v-model="statType" @change="loadStats">
          <option value="top-spenders">Top 20 kulutajad</option>
          <option value="top-item-counts">Top 20 ostjad koguse jargi</option>
          <option value="top-products-by-quantity">Top 20 enim ostetud tooted</option>
          <option value="top-products-by-revenue">Top 20 toodet kaibe jargi</option>
          <option value="product-buyers">Top 20 valitud toote ostjad</option>
          <option value="category-buyers">Top 20 valitud kategooria ostjad</option>
          <option value="month-top-spenders">Top 20 kulutajad kuus</option>
          <option value="month-top-products">Top 20 tooted kuus</option>
          <option value="highest-debts">Top 20 koige suurem volg</option>
          <option value="highest-credits">Top 20 koige suurem krediit</option>
        </select>
      </label>

      <label v-if="needsProduct">
        Toode
        <select v-model="selectedProductId" @change="loadStats">
          <option value="">Vali toode</option>
          <option v-for="product in products" :key="product.id" :value="String(product.id)">
            {{ product.name }}
          </option>
        </select>
      </label>

      <label v-if="needsCategory">
        Kategooria
        <select v-model="selectedCategoryId" @change="loadStats">
          <option value="">Vali kategooria</option>
          <option v-for="category in categories" :key="category.id" :value="String(category.id)">
            {{ category.name }}
          </option>
        </select>
      </label>

      <label v-if="needsMonth">
        Kuu
        <input type="month" v-model="selectedMonth" @change="loadStats" />
      </label>

      <label v-if="supportsDateRange">
        Alates
        <input type="date" v-model="dateFrom" @change="loadStats" />
      </label>

      <label v-if="supportsDateRange">
        Kuni
        <input type="date" v-model="dateTo" @change="loadStats" />
      </label>
    </div>

    <p><strong>Valitud: {{ statLabel }}</strong></p>

    <p v-if="loading">Laen statistikat...</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <table v-else>
      <thead>
        <tr>
          <th v-for="column in columns" :key="column">{{ prettyHeader(column) }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="row.id || index">
          <td v-for="column in columns" :key="column">{{ formatCell(column, row[column]) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { apiFetch } from "../api/client";

const statType = ref("top-spenders");
const selectedProductId = ref("");
const selectedCategoryId = ref("");
const selectedMonth = ref(new Date().toISOString().slice(0, 7));
const dateFrom = ref("");
const dateTo = ref("");

const loading = ref(false);
const error = ref("");
const rows = ref([]);
const products = ref([]);
const categories = ref([]);

const needsProduct = computed(() => statType.value === "product-buyers");
const needsCategory = computed(() => statType.value === "category-buyers");
const needsMonth = computed(() => statType.value === "month-top-spenders" || statType.value === "month-top-products");
const supportsDateRange = computed(
  () => !needsMonth.value && statType.value !== "highest-debts" && statType.value !== "highest-credits"
);

const labels = {
  "top-spenders": "Top 20 kulutajad",
  "top-item-counts": "Top 20 ostjad koguse jargi",
  "top-products-by-quantity": "Top 20 enim ostetud tooted",
  "top-products-by-revenue": "Top 20 toodet kaibe jargi",
  "product-buyers": "Top 20 valitud toote ostjad",
  "category-buyers": "Top 20 valitud kategooria ostjad",
  "month-top-spenders": "Top 20 kulutajad valitud kuus",
  "month-top-products": "Top 20 tooted valitud kuus",
  "highest-debts": "Top 20 koige suurem volg",
  "highest-credits": "Top 20 koige suurem krediit"
};

const statLabel = computed(() => labels[statType.value]);
const columns = computed(() => {
  if (!rows.value.length) {
    return ["info"];
  }
  return Object.keys(rows.value[0]).filter((key) => key !== "id" && !key.endsWith("_id"));
});

function money(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function prettyHeader(header) {
  return header.replaceAll("_", " ");
}

function formatCell(column, value) {
  if (column === "info") {
    return "Andmed puuduvad";
  }

  if (["total_spent", "total_sum", "total_revenue", "debt", "balance", "credit_amount"].includes(column)) {
    return money(value);
  }

  return value;
}

function buildEndpoint() {
  const limit = "20";
  const rangeParams = new URLSearchParams();

  if (dateFrom.value) {
    rangeParams.set("date_from", dateFrom.value);
  }
  if (dateTo.value) {
    rangeParams.set("date_to", dateTo.value);
  }

  function withRange(path) {
    if (!supportsDateRange.value || !rangeParams.toString()) {
      return path;
    }
    return `${path}&${rangeParams.toString()}`;
  }

  if (statType.value === "top-spenders") {
    return withRange(`/stats/top-spenders?limit=${limit}`);
  }
  if (statType.value === "top-item-counts") {
    return withRange(`/stats/top-item-counts?limit=${limit}`);
  }
  if (statType.value === "top-products-by-quantity") {
    return withRange(`/stats/top-products-by-quantity?limit=${limit}`);
  }
  if (statType.value === "top-products-by-revenue") {
    return withRange(`/stats/top-products-by-revenue?limit=${limit}`);
  }
  if (statType.value === "product-buyers") {
    if (!selectedProductId.value) {
      return null;
    }
    return withRange(`/stats/product/${selectedProductId.value}/buyers?limit=${limit}`);
  }
  if (statType.value === "category-buyers") {
    if (!selectedCategoryId.value) {
      return null;
    }
    return withRange(`/stats/category/${selectedCategoryId.value}/buyers?limit=${limit}`);
  }
  if (statType.value === "month-top-spenders") {
    return `/stats/month/top-spenders?month=${selectedMonth.value}&limit=${limit}`;
  }
  if (statType.value === "month-top-products") {
    return `/stats/month/top-products?month=${selectedMonth.value}&limit=${limit}`;
  }
  if (statType.value === "highest-debts") {
    return `/stats/highest-debts?limit=${limit}`;
  }
  return `/stats/highest-credits?limit=${limit}`;
}

async function loadStats() {
  const endpoint = buildEndpoint();
  rows.value = [];
  error.value = "";

  if (!endpoint) {
    return;
  }

  loading.value = true;
  try {
    rows.value = await apiFetch(endpoint);
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function loadFilters() {
  try {
    const [productsData, categoriesData] = await Promise.all([
      apiFetch("/products"),
      apiFetch("/categories")
    ]);
    products.value = productsData;
    categories.value = categoriesData;
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(async () => {
  await loadFilters();
  await loadStats();
});
</script>
