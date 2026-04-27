<template>
  <section class="page">
    <h2>Statistika</h2>

    <div class="form-grid">
      <label>
        Statistika liik
        <select v-model="statType" @change="loadStats">
          <option value="category-buyers">Top 20 ostjat kategoorias</option>
          <option value="product-buyers">Top 20 ostjat toote kaupa</option>
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
          <td v-for="column in columns" :key="column">{{ formatCell(column, row[column], row) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { apiFetch } from "../api/client";

const statType = ref("category-buyers");
const selectedProductId = ref("");
const selectedCategoryId = ref("");

const loading = ref(false);
const error = ref("");
const rows = ref([]);
const products = ref([]);
const categories = ref([]);

const needsProduct = computed(() => statType.value === "product-buyers");
const needsCategory = computed(() => statType.value === "category-buyers");

const labels = {
  "category-buyers": "Top 20 ostjat valitud kategoorias",
  "product-buyers": "Top 20 ostjat valitud tootel"
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

function rowUnit(row) {
  return row.unit || row.product_unit || null;
}

function formatCell(column, value, row) {
  if (column === "info") {
    return "Andmed puuduvad";
  }

  if (["total_spent", "total_sum", "total_revenue", "debt", "balance", "credit_amount"].includes(column)) {
    return money(value);
  }

  if (["quantity", "total_quantity", "total_items", "items_count"].includes(column)) {
    const unit = rowUnit(row);
    return unit ? `${value} ${unit}` : value;
  }

  return value;
}

function buildEndpoint() {
  const limit = "20";

  if (statType.value === "product-buyers") {
    if (!selectedProductId.value) {
      return null;
    }
    return `/stats/product/${selectedProductId.value}/buyers?limit=${limit}`;
  }

  if (statType.value === "category-buyers") {
    if (!selectedCategoryId.value) {
      return null;
    }
    return `/stats/category/${selectedCategoryId.value}/buyers?limit=${limit}`;
  }

  return null;
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
