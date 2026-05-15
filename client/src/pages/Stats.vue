<template>
  <section class="page">
    <h2>Statistika</h2>

    <div class="form-grid">
      <label>
        Statistika liik
        <select v-model="statType" @change="loadStats">
          <option v-for="stat in statOptions" :key="stat.value" :value="stat.value">
            {{ stat.label }}
          </option>
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

      <label>
        Alates
        <input v-model="dateFrom" type="date" @change="loadStats" />
      </label>

      <label>
        Kuni
        <input v-model="dateTo" type="date" @change="loadStats" />
      </label>
    </div>

    <div class="actions">
      <button type="button" @click="applyPreset('week')">Nädal</button>
      <button type="button" @click="applyPreset('month')">Kuu</button>
      <button type="button" @click="applyPreset('semester')">Semester</button>
      <button type="button" @click="applyPreset('all')">Kogu aeg</button>
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
import { quantity } from "../utils/format";

const statType = ref("category-buyers");
const selectedProductId = ref("");
const selectedCategoryId = ref("");
const dateFrom = ref("");
const dateTo = ref("");

const loading = ref(false);
const error = ref("");
const rows = ref([]);
const products = ref([]);
const categories = ref([]);

const statOptions = [
  { value: "category-buyers", label: "Top 20 ostjat kategoorias", requiresCategory: true },
  { value: "product-buyers", label: "Top 20 ostjat toote kaupa", requiresProduct: true },
  { value: "top-products-by-quantity", label: "Top tooted koguse järgi" },
  { value: "top-products-by-revenue", label: "Top tooted tulu järgi" },
  { value: "category-totals", label: "Kategooriate kokkuvõte" },
  { value: "tugevaim-coetus", label: "Tugevaim coetus" }
];

const currentStat = computed(() => statOptions.find((stat) => stat.value === statType.value) || statOptions[0]);
const needsProduct = computed(() => Boolean(currentStat.value.requiresProduct));
const needsCategory = computed(() => Boolean(currentStat.value.requiresCategory));
const statLabel = computed(() => currentStat.value.label);
const columns = computed(() => {
  if (!rows.value.length) {
    return ["info"];
  }
  return Object.keys(rows.value[0]).filter((key) =>
    key !== "id" &&
    key !== "unit" &&
    key !== "product_unit" &&
    !key.endsWith("_id")
  );
});

function money(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function prettyHeader(header) {
  const labels = {
    category: "kategooria",
    coetus: "coetus",
    first_name: "first name",
    last_name: "last name",
    name: "toode",
    purchase_count: "ostukordi",
    stock_quantity: "laos",
    total_quantity: "kogus",
    total_revenue: "tulu",
    total_spent: "total spent"
  };

  return labels[header] || header.replaceAll("_", " ");
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

  if (["amount", "quantity", "stock_quantity", "total_quantity", "total_items", "items_count"].includes(column)) {
    const unit = rowUnit(row);
    const formatted = quantity(value);
    return unit ? `${formatted} ${unit}` : formatted;
  }

  return value;
}

function buildEndpoint() {
  const limit = "20";
  const params = new URLSearchParams({ limit });

  if (statType.value === "product-buyers") {
    if (!selectedProductId.value) {
      return null;
    }
    addDateParams(params);
    return `/stats/product/${selectedProductId.value}/buyers?${params.toString()}`;
  }

  if (statType.value === "category-buyers") {
    if (!selectedCategoryId.value) {
      return null;
    }
    addDateParams(params);
    return `/stats/category/${selectedCategoryId.value}/buyers?${params.toString()}`;
  }

  const endpoints = {
    "top-products-by-quantity": "/stats/top-products-by-quantity",
    "top-products-by-revenue": "/stats/top-products-by-revenue",
    "category-totals": "/stats/category-totals",
    "tugevaim-coetus": "/stats/tugevaim-coetus"
  };

  const endpoint = endpoints[statType.value];
  if (!endpoint) {
    return null;
  }

  addDateParams(params);
  return `${endpoint}?${params.toString()}`;
}

function addDateParams(params) {
  if (dateFrom.value) {
    params.set("date_from", dateFrom.value);
  }
  if (dateTo.value) {
    params.set("date_to", dateTo.value);
  }
}

function formatInputDate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function firstThursday(year, monthIndex) {
  const date = new Date(year, monthIndex, 1);
  const offset = (4 - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + offset);
  return date;
}

function semesterRange(today = new Date()) {
  const year = today.getFullYear();
  const thisAutumnStart = firstThursday(year, 8);
  const thisJuneEnd = firstThursday(year, 5);

  if (today >= thisAutumnStart) {
    return {
      start: thisAutumnStart,
      end: firstThursday(year + 1, 5)
    };
  }

  return {
    start: firstThursday(year - 1, 8),
    end: thisJuneEnd
  };
}

async function applyPreset(preset) {
  const today = new Date();

  if (preset === "all") {
    dateFrom.value = "";
    dateTo.value = "";
  }

  if (preset === "week") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    dateFrom.value = formatInputDate(start);
    dateTo.value = formatInputDate(today);
  }

  if (preset === "month") {
    dateFrom.value = formatInputDate(new Date(today.getFullYear(), today.getMonth(), 1));
    dateTo.value = formatInputDate(today);
  }

  if (preset === "semester") {
    const range = semesterRange(today);
    dateFrom.value = formatInputDate(range.start);
    dateTo.value = formatInputDate(range.end);
  }

  await loadStats();
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
