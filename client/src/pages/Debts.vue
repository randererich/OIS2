<template>
  <section class="page debts-page">
    <h2>Võlad</h2>

    <div class="form-grid debts-filters">
      <label>
        Otsi inimest
        <input v-model="search" placeholder="Nimi / coetus / konvent" />
      </label>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="debts-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Inimene</th>
            <th>Coetus</th>
            <th>Konvent</th>
            <th>Saldo</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in groupedDebts" :key="group.coetus">
            <tr>
              <th colspan="4">{{ group.coetus || 'Määramata' }}</th>
            </tr>
            <tr v-for="debt in group.people" :key="debt.id" class="clickable" @click="openDetail(debt)">
              <td>{{ debt.first_name }} {{ debt.last_name }}</td>
              <td>{{ debt.coetus || '-' }}</td>
              <td>{{ debt.konvent || '-' }}</td>
              <td :class="balanceClass(debt.debt)">{{ balanceMessage(debt.debt) }}</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div v-if="selectedPerson" class="modal-backdrop" @click.self="closeDetail">
      <section class="modal-panel">
        <div class="actions" style="justify-content: space-between; align-items: center;">
          <h3 style="margin: 0;">
            {{ selectedPerson.first_name }} {{ selectedPerson.last_name }}
          </h3>
          <button type="button" @click="closeDetail">Sulge</button>
        </div>

        <p :class="balanceClass(selectedPerson.balance)"><strong>{{ balanceMessage(selectedPerson.balance) }}</strong></p>

        <div class="form-grid">
          <label>
            Kuu
            <input type="month" v-model="selectedMonth" @change="loadMonthlyDetails" />
          </label>
          <label>
            <input type="checkbox" v-model="includeCancelled" @change="loadMonthlyDetails" />
            Näita tühistatud kirjeid
          </label>
        </div>

        <h4>Kokkuvõte toodete kaupa</h4>
        <table>
          <thead>
            <tr>
              <th>Toode</th>
              <th>Kogus</th>
              <th>Summa</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in monthlySummary" :key="item.product_id">
              <td>{{ item.product_name }}</td>
              <td>{{ quantity(item.total_quantity) }}</td>
              <td>{{ money(item.total_sum) }}</td>
            </tr>
          </tbody>
        </table>

        <h4>Toored osturead</h4>
        <table>
          <thead>
            <tr>
              <th>Aeg</th>
              <th>Toode</th>
              <th>Kogus</th>
              <th>Kokku</th>
              <th>Kommentaar</th>
              <th>Staatus</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="purchase in monthlyPurchases" :key="purchase.id" :class="{ cancelled: purchase.is_cancelled }">
              <td>{{ formatDate(purchase.created_at) }}</td>
              <td>{{ purchase.product_name }}</td>
              <td>{{ purchaseQuantity(purchase) }}</td>
              <td>{{ money(purchase.total_price) }}</td>
              <td>{{ purchase.comment || '-' }}</td>
              <td>{{ purchaseStatus(purchase) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { apiFetch } from "../api/client";
import { formatDisplayDateTime } from "../utils/date";
import { quantity } from "../utils/format";

const debts = ref([]);
const error = ref("");
const search = ref("");

const selectedPerson = ref(null);
const selectedMonth = ref(new Date().toISOString().slice(0, 7));
const includeCancelled = ref(false);
const monthlySummary = ref([]);
const monthlyPurchases = ref([]);

function money(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function formatDate(value) {
  return formatDisplayDateTime(value);
}

function balanceClass(balance) {
  const n = Number(balance || 0);
  if (n > 0) {
    return "balance-debt";
  }
  if (n < 0) {
    return "balance-credit";
  }
  return "balance-zero";
}

function balanceMessage(balance) {
  const n = Number(balance || 0);
  if (n > 0) {
    return `Praegune võlg: ${money(n)}`;
  }
  if (n === 0) {
    return "Võlg puudub";
  }
  return `Kontol üle: ${money(Math.abs(n))}`;
}

const filteredDebts = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) {
    return debts.value;
  }

  return debts.value.filter((row) => {
    const name = `${row.first_name} ${row.last_name}`.toLowerCase();
    return (
      name.includes(q) ||
      String(row.coetus || "").toLowerCase().includes(q) ||
      String(row.konvent || "").toLowerCase().includes(q)
    );
  });
});

function parseCoetusParts(coetus) {
  const raw = String(coetus || "");
  const match = raw.match(/^(\d{4})\/(I|II)$/);
  if (!match) {
    return { valid: false, year: 0, sem: 0 };
  }
  return {
    valid: true,
    year: Number.parseInt(match[1], 10),
    sem: match[2] === "II" ? 2 : 1
  };
}

function compareCoetusDesc(a, b) {
  const pa = parseCoetusParts(a);
  const pb = parseCoetusParts(b);
  if (pa.valid !== pb.valid) {
    return pa.valid ? -1 : 1;
  }
  if (pa.year !== pb.year) {
    return pb.year - pa.year;
  }
  if (pa.sem !== pb.sem) {
    return pb.sem - pa.sem;
  }
  return String(a || "").localeCompare(String(b || ""), "et");
}

const groupedDebts = computed(() => {
  const sorted = [...filteredDebts.value].sort((a, b) => {
    const coetusCmp = compareCoetusDesc(a.coetus, b.coetus);
    if (coetusCmp !== 0) {
      return coetusCmp;
    }
    const debtCmp = Number(b.debt || 0) - Number(a.debt || 0);
    if (debtCmp !== 0) {
      return debtCmp;
    }
    return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, "et");
  });

  const map = new Map();
  for (const person of sorted) {
    const key = person.coetus || "Määramata";
    if (!map.has(key)) {
      map.set(key, { coetus: key, people: [] });
    }
    map.get(key).people.push(person);
  }
  return Array.from(map.values());
});

function purchaseStatus(purchase) {
  if (purchase.is_cancelled) {
    return "Tühistatud";
  }
  if (purchase.debt_adjustment_operation === "debt_zero") {
    return "vōla nullimine";
  }
  if (purchase.debt_adjustment_operation === "debt_add") {
    return "Võla lisamine";
  }
  if (purchase.debt_adjustment_operation === "debt_remove") {
    return "Võla vähendamine";
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

function purchaseQuantity(purchase) {
  if (purchase.debt_adjustment_operation) {
    return "-";
  }
  return `${quantity(purchase.quantity)} ${purchase.unit || "tk"}`;
}

async function loadData() {
  error.value = "";
  try {
    debts.value = await apiFetch("/payments/debts");
  } catch (err) {
    error.value = err.message;
  }
}

function closeDetail() {
  selectedPerson.value = null;
  monthlySummary.value = [];
  monthlyPurchases.value = [];
}

async function openDetail(person) {
  selectedPerson.value = {
    id: person.id,
    first_name: person.first_name,
    last_name: person.last_name,
    balance: person.debt
  };
  await loadMonthlyDetails();
}

async function loadMonthlyDetails() {
  if (!selectedPerson.value) {
    return;
  }

  try {
    const params = new URLSearchParams({
      month: selectedMonth.value,
      include_cancelled: includeCancelled.value ? "true" : "false"
    });
    const data = await apiFetch(
      `/people/${selectedPerson.value.id}/monthly-purchases?${params.toString()}`
    );
    selectedPerson.value = data.person;
    monthlySummary.value = data.summary_by_product;
    monthlyPurchases.value = data.purchases;
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(loadData);
</script>
