<template>
  <section class="page">
    <h2>Kirjed (Admin)</h2>

    <div class="form-grid">
      <label>
        Otsing
        <input v-model="search" @input="loadPurchases" />
      </label>
      <label>
        <input v-model="includeCancelled" type="checkbox" @change="loadPurchases" />
        Naita tuhistatud kirjeid
      </label>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <table>
      <thead>
        <tr>
          <th>Aeg</th>
          <th>Inimene</th>
          <th>Toode</th>
          <th>Kogus</th>
          <th>Kokku</th>
          <th>Kommentaar</th>
          <th>Staatus</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="purchase in purchases" :key="purchase.id" :class="{ cancelled: purchase.is_cancelled }">
          <td>{{ formatDate(purchase.created_at) }}</td>
          <td>{{ purchase.first_name }} {{ purchase.last_name }}</td>
          <td>{{ purchase.product_name }}</td>
          <td>{{ quantity(purchase.quantity) }} {{ purchase.product_unit || 'tk' }}</td>
          <td>{{ money(purchase.total_price) }}</td>
          <td>{{ purchase.comment || '-' }}</td>
          <td>{{ purchaseStatus(purchase) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { apiFetchAdmin } from "../../api/client";
import { formatDisplayDateTime } from "../../utils/date";
import { quantity } from "../../utils/format";

const purchases = ref([]);
const error = ref("");
const search = ref("");
const includeCancelled = ref(true);

function money(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function purchaseStatus(purchase) {
  if (purchase.is_cancelled) {
    return "Tühistatud";
  }
  if (Number(purchase.quantity || 0) < 0) {
    return "Parandus";
  }
  if (purchase.cash_operation === "cash_deposit") {
    return "Sissemakse";
  }
  if (purchase.cash_operation === "cash_withdrawal") {
    return "Väljamakse";
  }
  if (purchase.paid_with_cash) {
    return "Sularahas";
  }
  return "-";
}

function formatDate(value) {
  return formatDisplayDateTime(value);
}

async function loadPurchases() {
  error.value = "";
  try {
    const params = new URLSearchParams({
      include_cancelled: includeCancelled.value ? "true" : "false"
    });
    if (search.value.trim()) {
      params.set("q", search.value.trim());
    }
    purchases.value = await apiFetchAdmin(`/admin/purchases?${params.toString()}`);
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(loadPurchases);
</script>
