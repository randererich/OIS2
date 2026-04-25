<template>
  <section class="page">
    <h2>Inventuuri raportid</h2>

    <p v-if="error" class="error">{{ error }}</p>

    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Aeg</th>
          <th>Kommentaar</th>
          <th>Tooteid</th>
          <th>Koguerinevus (abs)</th>
          <th>Tegevus</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="report in reports" :key="report.id">
          <td>{{ report.id }}</td>
          <td>{{ formatDate(report.created_at) }}</td>
          <td>{{ report.comment || '-' }}</td>
          <td>{{ report.counted_products }}</td>
          <td>{{ report.total_absolute_difference }}</td>
          <td>
            <button type="button" @click="loadDetail(report.id)">Ava</button>
          </td>
        </tr>
      </tbody>
    </table>

    <section v-if="detail" class="panel">
      <h3>Raport #{{ detail.report.id }}</h3>
      <p>{{ formatDate(detail.report.created_at) }} | {{ detail.report.comment || '-' }}</p>

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
          <tr v-for="row in detail.rows" :key="row.id">
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
import { onMounted, ref } from "vue";
import { apiFetchAdmin } from "../../api/client";

const reports = ref([]);
const detail = ref(null);
const error = ref("");

function formatDate(value) {
  return new Date(value).toLocaleString("et-EE");
}

async function loadReports() {
  error.value = "";
  try {
    reports.value = await apiFetchAdmin("/admin/inventory/reports");
  } catch (err) {
    error.value = err.message;
  }
}

async function loadDetail(id) {
  error.value = "";
  try {
    detail.value = await apiFetchAdmin(`/admin/inventory/reports/${id}`);
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(loadReports);
</script>
