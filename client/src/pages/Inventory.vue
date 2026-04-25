<template>
  <section class="page">
    <h2>Inventuur</h2>

    <label>
      Raporti kommentaar
      <input v-model="reportComment" placeholder="Soovi korral lisa raporti kommentaar" />
    </label>

    <p v-if="loadingProducts">Laen inventuuri tooteid...</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <table v-else>
      <thead>
        <tr>
          <th>Kategooria</th>
          <th>Toode</th>
          <th>Eeldatav seis</th>
          <th>Loetud seis</th>
          <th>Kommentaar</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="product in products" :key="product.id">
          <td>{{ product.category_name || '-' }}</td>
          <td>{{ product.name }}</td>
          <td>{{ product.expected_quantity }}</td>
          <td>
            <input v-model="counted[product.id]" type="number" step="1" />
          </td>
          <td>
            <input v-model="comments[product.id]" />
          </td>
        </tr>
      </tbody>
    </table>

    <div class="actions" style="justify-content: center;">
      <button type="button" @click="saveReport">Salvesta inventuuri raport</button>
    </div>

    <p v-if="message" class="success">{{ message }}</p>

    <h3>Inventuuri raportite logi</h3>
    <div class="form-grid filters-row">
      <label>
        Raportid alates
        <input type="date" v-model="reportsFrom" @change="loadReports" />
      </label>
      <label>
        Raportid kuni
        <input type="date" v-model="reportsTo" @change="loadReports" />
      </label>
    </div>

    <table>
      <thead>
        <tr>
          <th>Aeg</th>
          <th>Kommentaar</th>
          <th>Loetud tooteid</th>
          <th>Koguerinevus (abs)</th>
          <th>Tegevus</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="report in reports" :key="report.id">
          <td>{{ formatDate(report.created_at) }}</td>
          <td>{{ report.comment || '-' }}</td>
          <td>{{ report.counted_products }}</td>
          <td>{{ report.total_absolute_difference }}</td>
          <td>
            <button type="button" @click="openReport(report.id)">Ava</button>
          </td>
        </tr>
      </tbody>
    </table>

    <section v-if="selectedReport" class="panel">
      <div class="actions" style="justify-content: space-between; align-items: center;">
        <h3 style="margin: 0;">Inventuuri raport</h3>
        <button type="button" @click="selectedReport = null">Sulge</button>
      </div>

      <p>
        {{ formatDate(selectedReport.report.created_at) }}
        | {{ selectedReport.report.comment || '-' }}
      </p>

      <table>
        <thead>
          <tr>
            <th>Kategooria</th>
            <th>Toode</th>
            <th>Eeldatav</th>
            <th>Loetud</th>
            <th>Erinevus</th>
            <th>Kommentaar</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in selectedReport.rows" :key="row.id">
            <td>{{ row.category_name || '-' }}</td>
            <td>{{ row.product_name }}</td>
            <td>{{ row.expected_quantity }}</td>
            <td>{{ row.counted_quantity }}</td>
            <td>{{ row.difference }}</td>
            <td>{{ row.comment || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { apiFetch } from "../api/client";

const products = ref([]);
const reports = ref([]);
const selectedReport = ref(null);
const loadingProducts = ref(false);
const error = ref("");
const message = ref("");
const reportComment = ref("");
const reportsFrom = ref("");
const reportsTo = ref("");
const counted = reactive({});
const comments = reactive({});

function formatDate(value) {
  return new Date(value).toLocaleString("et-EE");
}

async function loadCountProducts() {
  loadingProducts.value = true;
  error.value = "";

  try {
    products.value = await apiFetch("/inventory/count-products");
    for (const product of products.value) {
      counted[product.id] = String(product.expected_quantity);
      comments[product.id] = "";
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    loadingProducts.value = false;
  }
}

async function loadReports() {
  try {
    const params = new URLSearchParams();
    if (reportsFrom.value) {
      params.set("date_from", reportsFrom.value);
    }
    if (reportsTo.value) {
      params.set("date_to", reportsTo.value);
    }

    const suffix = params.toString() ? `?${params.toString()}` : "";
    reports.value = await apiFetch(`/inventory/reports${suffix}`);
  } catch (err) {
    error.value = err.message;
  }
}

async function saveReport() {
  error.value = "";
  message.value = "";

  const counts = [];

  for (const product of products.value) {
    const value = Number.parseInt(counted[product.id], 10);
    if (!Number.isInteger(value)) {
      error.value = `Loetud seis peab olema täisarv (${product.name})`;
      return;
    }

    counts.push({
      product_id: product.id,
      counted_quantity: value,
      comment: comments[product.id] || null
    });
  }

  try {
    const result = await apiFetch("/inventory/reports", {
      method: "POST",
      body: JSON.stringify({
        comment: reportComment.value || null,
        counts
      })
    });

    message.value = `Inventuuri raport salvestatud (${formatDate(result.created_at)}).`;
    reportComment.value = "";
    await loadCountProducts();
    await loadReports();
  } catch (err) {
    error.value = err.message;
  }
}

async function openReport(id) {
  error.value = "";
  try {
    selectedReport.value = await apiFetch(`/inventory/reports/${id}`);
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(async () => {
  await loadCountProducts();
  await loadReports();
});
</script>
