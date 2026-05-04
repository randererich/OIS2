<template>
  <section class="page">
    <h2>Inventuur</h2>

    <div class="form-grid">
      <label>
        Valvevärv
        <input v-model="valvevarv" required placeholder="Sisesta valvevärv" />
      </label>

      <label>
        Üldine kommentaar
        <input v-model="reportComment" placeholder="Soovi korral lisa kommentaar" />
      </label>
    </div>

    <section class="panel" :class="summaryClass">
      <h3>Inventuuri kokkuvõte</h3>
      <p>
        Eeldatav kokku: <strong>{{ summary.totalExpected }}</strong>
        | Loetud kokku: <strong>{{ summary.totalCounted }}</strong>
        | Erinevus: <strong>{{ summary.difference }}</strong>
      </p>
      <p><strong>{{ summary.status }}</strong></p>
    </section>

    <p v-if="loadingProducts">Laen inventuuri tooteid...</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <table v-else>
      <thead>
        <tr>
          <th>Kategooria</th>
          <th>Toode</th>
          <th>Eeldatav seis</th>
          <th>Ühik</th>
          <th>Loetud seis</th>
          <th>Kommentaar</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="product in products" :key="product.id" :class="rowClass(product)">
          <td>{{ product.category_name || '-' }}</td>
          <td>{{ product.name }}</td>
          <td>{{ product.expected_quantity }}</td>
          <td>{{ product.unit || 'tk' }}</td>
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
      <button type="button" @click="saveReport">Salvesta inventuur</button>
    </div>

    <p v-if="message" class="success">{{ message }}</p>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { apiFetch } from "../api/client";

const products = ref([]);
const loadingProducts = ref(false);
const error = ref("");
const message = ref("");
const valvevarv = ref("");
const reportComment = ref("");
const counted = reactive({});
const comments = reactive({});

function statusInfo(totalExpected, totalCounted) {
  const expected = Number(totalExpected || 0);
  const countedValue = Number(totalCounted || 0);
  const difference = countedValue - expected;

  if (countedValue >= expected || expected <= 0) {
    return {
      status: countedValue > expected ? "Ülejääk" : "Korras",
      className: "status-green",
      lossPercent: 0,
      difference
    };
  }

  const lossPercent = (Math.abs(difference) / expected) * 100;
  if (lossPercent <= 5) {
    return {
      status: "Väike puudujääk",
      className: "status-yellow",
      lossPercent,
      difference
    };
  }

  return {
    status: "Suur puudujääk",
    className: "status-red",
    lossPercent,
    difference
  };
}

const summary = computed(() => {
  const totalExpected = products.value.reduce(
    (sum, product) => sum + Number(product.expected_quantity || 0),
    0
  );
  const totalCounted = products.value.reduce(
    (sum, product) => sum + Number(counted[product.id] || "0"),
    0
  );

  const info = statusInfo(totalExpected, Number.isFinite(totalCounted) ? totalCounted : 0);
  return {
    totalExpected,
    totalCounted: Number.isFinite(totalCounted) ? totalCounted : 0,
    difference: info.difference,
    status: info.status,
    className: info.className
  };
});

const summaryClass = computed(() => summary.value.className);

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

function rowClass(product) {
  const expected = Number(product.expected_quantity || 0);
  const countedValue = Number(counted[product.id] || "0");
  if (!Number.isFinite(countedValue)) {
    return "";
  }
  return statusInfo(expected, countedValue).className;
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
    const result = await apiFetch("/inventory/reports", {
      method: "POST",
      body: JSON.stringify({
        valvevarv: valvevarv.value.trim(),
        comment: reportComment.value || null,
        counts
      })
    });

    message.value = "Inventuur salvestatud.";
    valvevarv.value = "";
    reportComment.value = "";
    await loadCountProducts();
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(async () => {
  await loadCountProducts();
});
</script>

<style scoped>
.status-green {
  background: var(--surface);
  border-left: 4px solid var(--ok);
}

.status-yellow {
  background: #fff8df;
}

.status-red {
  background: #fde8e8;
}
</style>
