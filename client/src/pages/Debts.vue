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
      <section class="modal-panel person-stats-modal">
        <div class="actions modal-header">
          <div>
            <h3>{{ selectedPerson.first_name }} {{ selectedPerson.last_name }}</h3>
            <p>{{ selectedPerson.coetus || '-' }} / {{ selectedPerson.konvent || '-' }}</p>
          </div>
          <button type="button" @click="closeDetail">Sulge</button>
        </div>

        <p :class="balanceClass(selectedPerson.balance)">
          <strong>{{ balanceMessage(selectedPerson.balance) }}</strong>
        </p>

        <div class="form-grid filters-row">
          <label>
            Alates
            <input v-model="dateFrom" type="date" @change="loadPersonDetails" />
          </label>

          <label>
            Kuni
            <input v-model="dateTo" type="date" @change="loadPersonDetails" />
          </label>

          <label class="checkbox-field">
            <input type="checkbox" v-model="includeCancelled" @change="loadPersonDetails" />
            Näita tühistatud kirjeid
          </label>
        </div>

        <div class="actions">
          <button type="button" @click="applyPreset('week')">Nädal</button>
          <button type="button" @click="applyPreset('month')">Kuu</button>
          <button type="button" @click="applyPreset('semester')">Semester</button>
          <button type="button" @click="applyPreset('all')">Kogu aeg</button>
        </div>

        <p v-if="detailsLoading">Laen ostusid...</p>

        <div v-else class="person-stats-layout">
          <section class="person-overview">
            <h4>Ülevaade</h4>

            <div class="detail-stats">
              <div>
                <span>Kirjeid</span>
                <strong>{{ purchaseEntries.length }}</strong>
              </div>
              <div>
                <span>Tooteid</span>
                <strong>{{ productSummary.length }}</strong>
              </div>
              <div>
                <span>Perioodi summa</span>
                <strong>{{ money(summaryTotal) }}</strong>
              </div>
            </div>

            <h4>Viimased {{ purchaseLimit }} kirjet</h4>
            <div class="table-scroll">
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
                  <tr
                    v-for="purchase in purchaseEntries"
                    :key="purchase.id"
                    :class="{ cancelled: purchase.is_cancelled }"
                  >
                    <td>{{ formatDate(purchase.created_at) }}</td>
                    <td>{{ purchase.product_name }}</td>
                    <td>{{ purchaseQuantity(purchase) }}</td>
                    <td>{{ money(purchase.total_price) }}</td>
                    <td>{{ purchase.comment || '-' }}</td>
                    <td>{{ purchaseStatus(purchase) }}</td>
                  </tr>
                  <tr v-if="!purchaseEntries.length">
                    <td colspan="6" class="empty-state">Kirjeid ei leitud</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="product-summary">
            <h4>Ostetud tooted</h4>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Toode</th>
                    <th>Kordi</th>
                    <th>Kogus</th>
                    <th>Summa</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in productSummary" :key="item.product_id">
                    <td>{{ item.product_name }}</td>
                    <td>{{ item.purchase_count }}</td>
                    <td>{{ quantityWithUnit(item.total_quantity, item.unit) }}</td>
                    <td>{{ money(item.total_sum) }}</td>
                  </tr>
                  <tr v-if="!productSummary.length">
                    <td colspan="4" class="empty-state">Tooteid ei leitud</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { apiFetch } from "../api/client";
import { formatDisplayDateTime, formatDateInput } from "../utils/date";
import { quantity } from "../utils/format";

const purchaseLimit = 50;

const debts = ref([]);
const error = ref("");
const search = ref("");

const selectedPerson = ref(null);
const dateFrom = ref("");
const dateTo = ref("");
const includeCancelled = ref(false);
const detailsLoading = ref(false);
const productSummary = ref([]);
const purchaseEntries = ref([]);

function money(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function formatDate(value) {
  return formatDisplayDateTime(value);
}

function quantityWithUnit(value, unit) {
  const formatted = quantity(value);
  return unit ? `${formatted} ${unit}` : formatted;
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

const summaryTotal = computed(() =>
  productSummary.value.reduce((sum, row) => sum + Number(row.total_sum || 0), 0)
);

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
    return "Võla nullimine";
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
  return quantityWithUnit(purchase.quantity, purchase.unit || "tk");
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
  productSummary.value = [];
  purchaseEntries.value = [];
}

async function openDetail(person) {
  selectedPerson.value = {
    id: person.id,
    first_name: person.first_name,
    last_name: person.last_name,
    coetus: person.coetus,
    konvent: person.konvent,
    balance: person.debt
  };
  await loadPersonDetails();
}

function addDateParams(params) {
  if (dateFrom.value) {
    params.set("date_from", dateFrom.value);
  }
  if (dateTo.value) {
    params.set("date_to", dateTo.value);
  }
}

async function loadPersonDetails() {
  if (!selectedPerson.value) {
    return;
  }

  detailsLoading.value = true;
  error.value = "";

  try {
    const params = new URLSearchParams({
      limit: String(purchaseLimit),
      include_cancelled: includeCancelled.value ? "true" : "false"
    });
    addDateParams(params);
    const data = await apiFetch(
      `/people/${selectedPerson.value.id}/purchases?${params.toString()}`
    );
    selectedPerson.value = data.person;
    productSummary.value = data.summary_by_product;
    purchaseEntries.value = data.purchases;
  } catch (err) {
    error.value = err.message;
  } finally {
    detailsLoading.value = false;
  }
}

function firstThursday(year, monthIndex) {
  const date = new Date(year, monthIndex, 1);
  const offset = (4 - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + offset);
  return date;
}

function semesterRange(today = new Date()) {
  const year = today.getFullYear();
  const springStart = firstThursday(year, 1);
  const springEnd = firstThursday(year, 5);
  const autumnStart = firstThursday(year, 8);
  const autumnEnd = firstThursday(year, 11);

  if (today < springStart) {
    return {
      start: firstThursday(year - 1, 8),
      end: firstThursday(year - 1, 11)
    };
  }

  if (today < autumnStart) {
    return {
      start: springStart,
      end: springEnd
    };
  }

  return {
    start: autumnStart,
    end: autumnEnd
  };
}

async function applyPreset(preset) {
  const today = new Date();

  if (preset === "all") {
    dateFrom.value = "";
    dateTo.value = "";
  }

  if (preset === "week") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    dateFrom.value = formatDateInput(start);
    dateTo.value = formatDateInput(today);
  }

  if (preset === "month") {
    dateFrom.value = formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
    dateTo.value = formatDateInput(today);
  }

  if (preset === "semester") {
    const range = semesterRange(today);
    dateFrom.value = formatDateInput(range.start);
    dateTo.value = formatDateInput(range.end);
  }

  await loadPersonDetails();
}

onMounted(loadData);
</script>

<style scoped>
.modal-header {
  justify-content: space-between;
  align-items: center;
}

.modal-header h3,
.modal-header p {
  margin: 0;
  text-align: left;
}

.checkbox-field {
  align-items: center;
  display: flex;
  gap: 8px;
  min-height: 43px;
}

.checkbox-field input {
  width: auto;
}

.person-stats-modal {
  width: min(1400px, 96vw);
}

.person-stats-layout {
  display: grid;
  gap: 14px;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.55fr);
  align-items: start;
}

.person-stats-layout h4 {
  margin: 0 0 8px;
}

.detail-stats {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 14px;
}

.detail-stats span {
  display: block;
  font-size: 0.9rem;
}

.table-scroll {
  overflow-x: auto;
}

.empty-state {
  text-align: center;
}

@media (max-width: 1000px) {
  .person-stats-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .modal-header,
  .detail-stats {
    grid-template-columns: 1fr;
  }

  .modal-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
