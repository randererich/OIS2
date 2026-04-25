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
          <th>Uhiku hind</th>
          <th>Kokku</th>
          <th>Kommentaar</th>
          <th>Tuhistatud</th>
          <th>Tegevus</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="purchase in purchases" :key="purchase.id" :class="{ cancelled: purchase.is_cancelled }">
          <td>{{ formatDate(purchase.created_at) }}</td>
          <td>{{ purchase.first_name }} {{ purchase.last_name }}</td>
          <td>{{ purchase.product_name }}</td>
          <td>{{ purchase.quantity }}</td>
          <td>{{ money(purchase.unit_price) }}</td>
          <td>{{ money(purchase.total_price) }}</td>
          <td>{{ purchase.comment || '-' }}</td>
          <td>{{ purchase.is_cancelled ? 'Jah' : 'Ei' }}</td>
          <td>
            <button v-if="!purchase.is_cancelled" type="button" @click="cancelPurchase(purchase)">Tuhista</button>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { apiFetchAdmin } from "../../api/client";

const purchases = ref([]);
const error = ref("");
const search = ref("");
const includeCancelled = ref(true);

function money(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function formatDate(value) {
  return new Date(value).toLocaleString("et-EE");
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

async function cancelPurchase(purchase) {
  const reason = window.prompt("Tuhistamise pohjus:", "vale isik");
  if (!reason) {
    return;
  }

  try {
    await apiFetchAdmin(`/admin/purchases/${purchase.id}/cancel`, {
      method: "PATCH",
      body: JSON.stringify({ cancellation_reason: reason })
    });
    await loadPurchases();
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(loadPurchases);
</script>
