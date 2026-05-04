<template>
  <section class="page">
    <h2>Inventuur</h2>

    <label>
      Valvevärv
      <input v-model="valvevarv" required />
    </label>

    <label>
      Raporti kommentaar
      <input v-model="reportComment" />
    </label>

    <table>
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
        <tr v-for="product in products" :key="product.id" :class="rowClass(product)">
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

    <button type="button" @click="saveReport">Salvesta inventuuri raport</button>

    <p v-if="message" class="success">{{ message }}</p>
    <p v-if="error" class="error">{{ error }}</p>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { apiFetchAdmin } from "../../api/client";

const products = ref([]);
const counted = reactive({});
const comments = reactive({});
const valvevarv = ref("");
const reportComment = ref("");
const message = ref("");
const error = ref("");

async function loadProducts() {
  error.value = "";
  try {
    products.value = await apiFetchAdmin("/admin/inventory/count-products");
    for (const product of products.value) {
      counted[product.id] = String(product.expected_quantity);
      comments[product.id] = "";
    }
  } catch (err) {
    error.value = err.message;
  }
}

function rowClass(product) {
  const expected = Number(product.expected_quantity || 0);
  const countedValue = Number(counted[product.id] || "0");
  if (!Number.isFinite(countedValue)) {
    return "";
  }
  return countedValue >= expected ? "inventory-row-ok" : "inventory-row-low";
}

async function saveReport() {
  error.value = "";
  message.value = "";

  if (!String(valvevarv.value || "").trim()) {
    error.value = "Valvevärv on kohustuslik.";
    return;
  }

  const counts = [];

  for (const product of products.value) {
    const value = Number(counted[product.id]);
    if (!Number.isFinite(value)) {
      error.value = `Loetud seis peab olema number (${product.name})`;
      return;
    }

    counts.push({
      product_id: product.id,
      counted_quantity: value,
      comment: comments[product.id] || null
    });
  }

  try {
    const result = await apiFetchAdmin("/admin/inventory/reports", {
      method: "POST",
      body: JSON.stringify({
        valvevarv: valvevarv.value.trim(),
        comment: reportComment.value || null,
        counts
      })
    });

    message.value = `Raport #${result.report_id} salvestatud (${result.counts_saved} rida).`;
    valvevarv.value = "";
    await loadProducts();
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(loadProducts);
</script>

<style scoped>
.inventory-row-ok {
  background: #e5f6e5;
}

.inventory-row-low {
  background: #fde8e8;
}

[data-theme="dark"] .inventory-row-ok {
  background: #173a20;
}

[data-theme="dark"] .inventory-row-low {
  background: #3d1d1d;
}
</style>
