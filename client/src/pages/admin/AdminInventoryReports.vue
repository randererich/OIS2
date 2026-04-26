<template>
  <section class="page">
    <h2>Varud / Inventuur</h2>

    <h3>Varude ülevaade</h3>
    <table>
      <thead>
        <tr>
          <th>Kategooria</th>
          <th>Toode</th>
          <th>Seis</th>
          <th>Ühik</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in inventoryRows" :key="`stock-${row.id}`">
          <td>{{ row.category_name || '-' }}</td>
          <td>{{ row.name }}</td>
          <td>{{ row.stock_quantity }}</td>
          <td>{{ row.unit || 'tk' }}</td>
        </tr>
      </tbody>
    </table>

    <h3>Varu lisamine</h3>
    <form class="form-grid" @submit.prevent="submitStockAdd">
      <label>
        Toode
        <select v-model="stockAdd.product_id" required>
          <option value="">Vali toode</option>
          <option v-for="product in inventoryRows" :key="`pick-${product.id}`" :value="String(product.id)">
            {{ product.name }}
          </option>
        </select>
      </label>

      <label>
        Lisatav kogus
        <input v-model="stockAdd.quantity_change" type="number" step="1" required />
      </label>

      <label>
        Kommentaar
        <input v-model="stockAdd.comment" />
      </label>

      <div class="actions" style="align-items: end">
        <button type="submit">Lisa varu</button>
      </div>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="message" class="success">{{ message }}</p>

    <h3>Viimased inventuuri raportid</h3>

    <table>
      <thead>
        <tr>
          <th>Aeg</th>
          <th>Valvevärv</th>
          <th>Kommentaar</th>
          <th>Tooteid</th>
          <th>Koguerinevus (abs)</th>
          <th>Staatus</th>
          <th>Tegevus</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="report in reports" :key="report.id">
          <td>{{ formatDate(report.created_at) }}</td>
          <td>{{ report.valvevarv }}</td>
          <td>{{ report.comment || '-' }}</td>
          <td>{{ report.counted_products }}</td>
          <td>{{ report.total_absolute_difference }}</td>
          <td :class="statusClass(report.status_color)">{{ report.status }}</td>
          <td>
            <button type="button" @click="loadDetail(report.id)">Ava</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="detail" class="modal-backdrop" @click.self="detail = null">
      <section class="modal-panel">
        <div class="actions" style="justify-content: space-between; align-items: center;">
          <h3 style="margin: 0;">Inventuuri raport</h3>
          <button type="button" @click="detail = null">Sulge</button>
        </div>

        <p>
          {{ formatDate(detail.report.created_at) }} |
          Valvevärv: <strong>{{ detail.report.valvevarv }}</strong> |
          {{ detail.report.comment || '-' }}
        </p>
        <p :class="statusClass(detail.report.status_color)"><strong>{{ detail.report.status }}</strong></p>

        <table>
          <thead>
            <tr>
              <th>Kategooria</th>
              <th>Toode</th>
              <th>Eeldatav</th>
              <th>Loetud</th>
              <th>Erinevus</th>
              <th>Ühik</th>
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
              <td>{{ row.unit || 'tk' }}</td>
              <td>{{ row.comment || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { apiFetchAdmin } from "../../api/client";

const reports = ref([]);
const inventoryRows = ref([]);
const detail = ref(null);
const error = ref("");
const message = ref("");

const stockAdd = ref({
  product_id: "",
  quantity_change: "",
  comment: ""
});

function formatDate(value) {
  return new Date(value).toLocaleString("et-EE");
}

function statusClass(color) {
  if (color === "red") {
    return "balance-debt";
  }
  if (color === "yellow") {
    return "status-yellow";
  }
  return "balance-credit";
}

async function loadInventory() {
  inventoryRows.value = await apiFetchAdmin("/admin/inventory");
}

async function loadReports() {
  error.value = "";
  try {
    reports.value = await apiFetchAdmin("/admin/inventory/reports?limit=14");
  } catch (err) {
    error.value = err.message;
  }
}

async function submitStockAdd() {
  error.value = "";
  message.value = "";

  try {
    await apiFetchAdmin("/admin/inventory/movement", {
      method: "POST",
      body: JSON.stringify({
        product_id: Number(stockAdd.value.product_id),
        quantity_change: Number.parseInt(stockAdd.value.quantity_change, 10),
        reason: "stock_add",
        comment: stockAdd.value.comment || null
      })
    });

    stockAdd.value.quantity_change = "";
    stockAdd.value.comment = "";
    message.value = "Varu liikumine salvestatud.";
    await loadInventory();
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

onMounted(async () => {
  await Promise.all([loadInventory(), loadReports()]);
});
</script>

<style scoped>
.status-yellow {
  color: #9a7300;
}
</style>
