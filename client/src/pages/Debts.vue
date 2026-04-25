<template>
  <section class="page debts-page">
    <h2>Võlad</h2>

    <form class="form-grid" @submit.prevent="submitPayment">
      <label>
        Inimene
        <select v-model="form.person_id" required>
          <option value="">Vali inimene</option>
          <option v-for="person in people" :key="person.id" :value="String(person.id)">
            {{ person.first_name }} {{ person.last_name }}
          </option>
        </select>
      </label>

      <label>
        Summa
        <input v-model="form.amount" type="number" min="0.01" step="0.01" required />
      </label>

      <label>
        Kommentaar
        <input v-model="form.comment" />
      </label>

      <div class="actions" style="align-items: end">
        <button type="submit" :disabled="saving">Lisa makse</button>
      </div>
    </form>

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
          <tr v-for="debt in filteredDebts" :key="debt.id" class="clickable" @click="openDetail(debt)">
            <td>{{ debt.first_name }} {{ debt.last_name }}</td>
            <td>{{ debt.coetus || '-' }}</td>
            <td>{{ debt.konvent || '-' }}</td>
            <td :class="balanceClass(debt.debt)">{{ balanceMessage(debt.debt) }}</td>
          </tr>
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
              <td>{{ item.total_quantity }}</td>
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
              <th>Ühiku hind</th>
              <th>Kokku</th>
              <th>Kommentaar</th>
              <th>Tühistatud</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="purchase in monthlyPurchases" :key="purchase.id" :class="{ cancelled: purchase.is_cancelled }">
              <td>{{ formatDate(purchase.created_at) }}</td>
              <td>{{ purchase.product_name }}</td>
              <td>{{ purchase.quantity }}</td>
              <td>{{ money(purchase.unit_price) }}</td>
              <td>{{ money(purchase.total_price) }}</td>
              <td>{{ purchase.comment || '-' }}</td>
              <td>{{ purchase.is_cancelled ? 'Jah' : 'Ei' }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { apiFetch } from "../api/client";

const debts = ref([]);
const people = ref([]);
const error = ref("");
const saving = ref(false);
const search = ref("");

const selectedPerson = ref(null);
const selectedMonth = ref(new Date().toISOString().slice(0, 7));
const includeCancelled = ref(false);
const monthlySummary = ref([]);
const monthlyPurchases = ref([]);

const form = reactive({
  person_id: "",
  amount: "",
  comment: ""
});

function money(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function formatDate(value) {
  return new Date(value).toLocaleString("et-EE");
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

async function loadData() {
  error.value = "";
  try {
    const [debtsData, peopleData] = await Promise.all([
      apiFetch("/payments/debts"),
      apiFetch("/people")
    ]);
    debts.value = debtsData;
    people.value = peopleData;
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

async function submitPayment() {
  saving.value = true;
  error.value = "";
  try {
    await apiFetch("/payments", {
      method: "POST",
      body: JSON.stringify({
        person_id: Number(form.person_id),
        amount: Number(form.amount),
        comment: form.comment || null
      })
    });

    form.person_id = "";
    form.amount = "";
    form.comment = "";
    await loadData();
    if (selectedPerson.value) {
      await loadMonthlyDetails();
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
}

onMounted(loadData);
</script>
