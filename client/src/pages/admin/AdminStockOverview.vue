<template>
  <section class="page">
    <h2>Varud</h2>

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
          <td>{{ quantity(row.stock_quantity) }}</td>
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
  </section>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { apiFetchAdmin } from "../../api/client";
import { quantity } from "../../utils/format";

const inventoryRows = ref([]);
const error = ref("");
const message = ref("");

const stockAdd = ref({
  product_id: "",
  quantity_change: "",
  comment: ""
});

async function loadInventory() {
  inventoryRows.value = await apiFetchAdmin("/admin/inventory");
}

async function submitStockAdd() {
  error.value = "";
  message.value = "";

  try {
    await apiFetchAdmin("/admin/inventory/movement", {
      method: "POST",
      body: JSON.stringify({
        product_id: Number(stockAdd.value.product_id),
        quantity_change: Number(stockAdd.value.quantity_change),
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

onMounted(loadInventory);
</script>
