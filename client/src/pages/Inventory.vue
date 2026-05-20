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
        Eeldatav kokku: <strong>{{ quantity(summary.totalExpected) }}</strong>
        | Loetud kokku: <strong>{{ quantity(summary.totalCounted) }}</strong>
        | Erinevus: <strong>{{ signedQuantity(summary.difference) }}</strong>
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
          <th>Ühik</th>
          <th>Loetud seis</th>
          <th>Kommentaar</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="product in products" :key="product.id" :class="rowClass(product)">
          <td>{{ product.category_name || '-' }}</td>
          <td>{{ product.name }}</td>
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

    <section class="panel" style="margin-top: 2rem;">
      <h3>Sularaha inventuur</h3>
      <div class="cash-count-grid">
        <label v-for="denomination in cashDenominations" :key="denomination.cents">
          <span>{{ denomination.label }}</span>
          <input
            v-model="cashCounts[denomination.cents]"
            type="number"
            inputmode="numeric"
            min="0"
            step="1"
            required
          />
        </label>
      </div>
      <p>
        Arvete järgi: <strong>{{ cashBalanceFormatted }}</strong> €
        | Loetud: <strong>{{ cashCountedFormatted }}</strong> €
        | Erinevus: <strong :class="cashDifference >= 0 ? 'cash-ok' : 'cash-low'">{{ cashDifferenceFormatted }}</strong> €
      </p>
    </section>

    <div class="actions" style="justify-content: center;">
      <button type="button" @click="saveReport">Salvesta inventuur</button>
    </div>

    <p v-if="message" class="success">{{ message }}</p>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { apiFetch } from "../api/client";
import { quantity, signedQuantity } from "../utils/format";

const products = ref([]);
const loadingProducts = ref(false);
const error = ref("");
const message = ref("");
const valvevarv = ref("");
const reportComment = ref("");
const counted = reactive({});
const comments = reactive({});
const cashDenominations = [
  { cents: 10000, label: "100 €" },
  { cents: 5000, label: "50 €" },
  { cents: 2000, label: "20 €" },
  { cents: 1000, label: "10 €" },
  { cents: 500, label: "5 €" },
  { cents: 200, label: "2 €" },
  { cents: 100, label: "1 €" },
  { cents: 50, label: "0.5 €" },
  { cents: 20, label: "0.2 €" },
  { cents: 10, label: "0.1 €" }
];
const cashCounts = reactive(
  Object.fromEntries(cashDenominations.map((denomination) => [denomination.cents, "0"]))
);
const cashBalance = ref(0);

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

  return {
    status: "Puudujääk",
    className: "status-yellow",
    lossPercent: (Math.abs(difference) / expected) * 100,
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

const cashCountedCents = computed(() => {
  return cashDenominations.reduce((sum, denomination) => {
    const count = Number(cashCounts[denomination.cents] || 0);
    return Number.isInteger(count) && count >= 0 ? sum + denomination.cents * count : sum;
  }, 0);
});

const cashCounted = computed(() => cashCountedCents.value / 100);

const cashDifference = computed(() => {
  return cashCounted.value - Number(cashBalance.value || 0);
});

const cashBalanceFormatted = computed(() => Number(cashBalance.value || 0).toFixed(2));
const cashCountedFormatted = computed(() => cashCounted.value.toFixed(2));
const cashDifferenceFormatted = computed(() => cashDifference.value.toFixed(2));

async function loadCountProducts() {
  loadingProducts.value = true;
  error.value = "";

  try {
    products.value = await apiFetch("/inventory/count-products");
    for (const product of products.value) {
      counted[product.id] = "0";
      comments[product.id] = "";
    }
    
    // Load cash balance from the system
    const cashData = await apiFetch("/inventory/cash-balance");
    cashBalance.value = Number(cashData.balance || 0);
    resetCashCounts();
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
  return countedValue >= expected ? "inventory-row-ok" : "inventory-row-low";
}

function resetCashCounts() {
  for (const denomination of cashDenominations) {
    cashCounts[denomination.cents] = "0";
  }
}

function validateCashCounts() {
  for (const denomination of cashDenominations) {
    const rawValue = cashCounts[denomination.cents];
    const value = Number(rawValue);

    if (rawValue === "" || !Number.isInteger(value) || value < 0) {
      return `${denomination.label} kogus peab olema 0 või positiivne täisarv.`;
    }
  }

  return "";
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

  const cashError = validateCashCounts();
  if (cashError) {
    error.value = cashError;
    return;
  }

  try {
    const result = await apiFetch("/inventory/reports", {
      method: "POST",
      body: JSON.stringify({
        valvevarv: valvevarv.value.trim(),
        comment: reportComment.value || null,
        counts,
        cash_counted: cashCounted.value
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

.inventory-row-ok {
  background: #e5f6e5;
}

.inventory-row-low {
  background: #fde8e8;
}

.cash-ok {
  color: var(--ok);
  font-weight: 600;
}

.cash-low {
  color: #d32f2f;
  font-weight: 600;
}

.cash-count-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
}

.cash-count-grid label {
  display: grid;
  gap: 0.35rem;
}

.cash-count-grid span {
  font-weight: 600;
}

[data-theme="dark"] .inventory-row-ok {
  background: #173a20;
}

[data-theme="dark"] .status-yellow {
  background: #937c3e;
}

[data-theme="dark"] .inventory-row-low {
  background: #3d1d1d;
}
</style>
