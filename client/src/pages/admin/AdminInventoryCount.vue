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
          <th>Loetud seis</th>
          <th>Kommentaar</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="product in products" :key="product.id" :class="rowClass(product)">
          <td>{{ product.category_name || '-' }}</td>
          <td>{{ product.name }}</td>
          <td>
            <input v-model="counted[product.id]" type="number" step="1" />
          </td>
          <td>
            <input v-model="comments[product.id]" />
          </td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top: 2rem; padding: 1rem; border: 1px solid var(--border); border-radius: 8px;">
      <h3>💶 Sularaha inventuur</h3>
      <div style="margin-bottom: 1rem;">
        <label>
          Loetud sularaha (€)
          <input v-model.number="cashCounted" type="number" step="0.01" placeholder="0.00" />
        </label>
      </div>
      <p>
        Arvete järgi: <strong>{{ cashBalance }}</strong> €
        | Loetud: <strong>{{ cashCounted }}</strong> €
        | Erinevus: <strong :class="cashDifference >= 0 ? 'cash-ok' : 'cash-low'">{{ cashDifference }}</strong> €
      </p>
    </div>

    <button type="button" @click="saveReport">Salvesta inventuuri raport</button>

    <p v-if="message" class="success">{{ message }}</p>
    <p v-if="error" class="error">{{ error }}</p>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { apiFetchAdmin } from "../../api/client";

const products = ref([]);
const counted = reactive({});
const comments = reactive({});
const valvevarv = ref("");
const reportComment = ref("");
const message = ref("");
const error = ref("");
const cashCounted = ref(0);
const cashBalance = ref(0);

const cashDifference = computed(() => {
  return (Number(cashCounted.value || 0) - Number(cashBalance.value || 0)).toFixed(2);
});

async function loadProducts() {
  error.value = "";
  try {
    products.value = await apiFetchAdmin("/admin/inventory/count-products");
    for (const product of products.value) {
      counted[product.id] = "0";
      comments[product.id] = "";
    }
    
    // Load cash balance from the system
    const cashData = await apiFetchAdmin("/admin/inventory/cash-balance");
    cashBalance.value = Number(cashData.balance || 0);
    cashCounted.value = 0;
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
        counts,
        cash_counted: Number(cashCounted.value || 0)
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

.cash-ok {
  color: #2e7d32;
  font-weight: 600;
}

.cash-low {
  color: #d32f2f;
  font-weight: 600;
}

[data-theme="dark"] .inventory-row-ok {
  background: #173a20;
}

[data-theme="dark"] .inventory-row-low {
  background: #3d1d1d;
}
</style>
