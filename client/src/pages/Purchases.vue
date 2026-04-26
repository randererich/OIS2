<template>
  <section class="page">
    <h2>Ostukirjed</h2>

    <div class="form-grid filters-row">
      <label>
        Otsing (inimene/toode/kommentaar)
        <input v-model="search" />
      </label>

      <label>
        Alates
        <input v-model="dateFrom" type="date" />
      </label>

      <label>
        Kuni
        <input v-model="dateTo" type="date" />
      </label>

      <label>
        <input v-model="includeCancelled" type="checkbox" />
        Näita tühistatud kirjeid
      </label>

      <div class="actions" style="align-items: end;">
        <button type="button" @click="applyFilters">Rakenda filtrid</button>
      </div>
    </div>

    <p v-if="loading">Laen kirjeid...</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <table v-else>
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
          <td>{{ purchase.quantity }} {{ purchase.product_unit || 'tk' }}</td>
          <td :class="purchase.total_price < 0 ? 'balance-credit' : ''">{{ money(purchase.total_price) }}</td>
          <td>{{ purchase.comment || '-' }}</td>
          <td>{{ statusLabel(purchase) }}</td>
        </tr>
      </tbody>
    </table>

    <div class="actions" style="justify-content: center;">
      <button type="button" :disabled="loadingOlder" @click="loadOlder">Näita vanemaid</button>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { apiFetch } from "../api/client";

const purchases = ref([]);
const loading = ref(false);
const loadingOlder = ref(false);
const error = ref("");
const search = ref("");
const includeCancelled = ref(false);
const dateFrom = ref("");
const dateTo = ref("");
const offset = ref(0);
const limit = 100;

function money(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function formatDate(value) {
  return new Date(value).toLocaleString("et-EE");
}

function statusLabel(purchase) {
  if (purchase.is_cancelled) {
    return "Tühistatud";
  }
  if (Number(purchase.quantity || 0) < 0) {
    return "Parandus";
  }
  return "-";
}

function buildParams(currentOffset) {
  const params = new URLSearchParams({
    include_cancelled: includeCancelled.value ? "true" : "false",
    limit: String(limit),
    offset: String(currentOffset)
  });

  if (search.value.trim()) {
    params.set("search", search.value.trim());
  }
  if (dateFrom.value) {
    params.set("date_from", dateFrom.value);
  }
  if (dateTo.value) {
    params.set("date_to", dateTo.value);
  }

  return params;
}

async function loadPurchases(reset = true) {
  if (reset) {
    loading.value = true;
    offset.value = 0;
  }
  error.value = "";

  try {
    const params = buildParams(offset.value);
    const data = await apiFetch(`/purchases?${params.toString()}`);

    if (reset) {
      purchases.value = data;
    } else {
      purchases.value = purchases.value.concat(data);
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
    loadingOlder.value = false;
  }
}

function applyFilters() {
  loadPurchases(true);
}

async function loadOlder() {
  loadingOlder.value = true;
  offset.value += limit;
  await loadPurchases(false);
}

onMounted(() => {
  loadPurchases(true);
});
</script>
