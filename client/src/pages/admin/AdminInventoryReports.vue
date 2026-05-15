<template>
  <section class="page">
    <h2>Inventuur</h2>

    <h3>Viimased inventuurid ülevaade</h3>

    <div class="inventory-overview-grid">
      <section class="panel monthly-overview">
        <div class="monthly-overview-header">
          <h3>Perioodi ülevaade</h3>
          <div class="date-range-picker">
            <label>
              Algus
              <input v-model="dateFrom" type="date" @change="loadMonthlyOverview" />
            </label>
            <label>
              Lõpp
              <input v-model="dateTo" type="date" @change="loadMonthlyOverview" />
            </label>
          </div>
        </div>

        <p v-if="monthlyLoading">Laen kuu ülevaadet...</p>
        <p v-else-if="monthlyError" class="error">{{ monthlyError }}</p>

        <template v-else>
          <div class="overview-tabs" role="tablist" aria-label="Perioodi ülevaate vaated">
            <button
              type="button"
              :class="{ active: overviewTab === 'loss' }"
              @click="overviewTab = 'loss'"
            >
              Kaotus
            </button>
            <button
              type="button"
              :class="{ active: overviewTab === 'value' }"
              @click="overviewTab = 'value'"
            >
              Väärtus
            </button>
          </div>

          <div class="overview-cards">
            <article>
              <span>Inventuure</span>
              <strong>{{ monthlySummary.reports_count }}</strong>
            </article>
            <article>
              <span>Loetud päevi</span>
              <strong>{{ monthlySummary.counted_days }}</strong>
            </article>
            <article>
              <span>Kaotatud varu</span>
              <strong class="balance-debt">{{ quantity(monthlySummary.lost_quantity) }}</strong>
            </article>
            <article>
              <span>Ülejääk</span>
              <strong class="balance-credit">{{ quantity(monthlySummary.overage_quantity) }}</strong>
            </article>
            <article>
              <span>Netovahe</span>
              <strong :class="differenceClass(monthlySummary.net_difference)">
                {{ signedQuantity(monthlySummary.net_difference) }}
              </strong>
            </article>
          </div>

          <template v-if="overviewTab === 'value'">
            <div class="overview-cards value-cards">
              <article>
                <span>Müügis oleva varu väärtus</span>
                <strong>{{ money(valueSummary.total_stock_value) }}</strong>
              </article>
              <article>
                <span>Perioodi kao väärtus</span>
                <strong class="balance-debt">{{ money(valueSummary.lost_value) }}</strong>
              </article>
              <article>
                <span>Kadu varu väärtusest</span>
                <strong class="balance-debt">{{ quantity(valueSummary.loss_percent) }}%</strong>
              </article>
            </div>

            <h4>Kao väärtus toodete kaupa</h4>
            <div class="monthly-product-tools">
              <label>
                Otsi toodet
                <input v-model="productSearch" placeholder="Toote nimi" />
              </label>
              <label>
                Kategooria
                <select v-model="selectedCategory">
                  <option value="">Kõik kategooriad</option>
                  <option v-for="category in monthlyCategories" :key="category" :value="category">
                    {{ category }}
                  </option>
                </select>
              </label>
              <label class="checkbox-label">
                <input v-model="hideZeroStock" type="checkbox" />
                Peida 0-seisuga tooted
              </label>
            </div>
            <table class="compact-table">
              <thead>
                <tr>
                  <th>Toode</th>
                  <th>Kategooria</th>
                  <th>Kao kogus</th>
                  <th>Kao väärtus</th>
                  <th>Seis</th>
                  <th>Ühik</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!filteredMonthlyProducts.length">
                  <td colspan="6">Tooteid ei leitud.</td>
                </tr>
                <tr v-for="product in filteredMonthlyProducts" :key="`value-${product.product_id}`">
                  <td>{{ product.product_name }}</td>
                  <td>{{ product.category_name || '-' }}</td>
                  <td class="balance-debt">{{ quantity(product.lost_quantity) }}</td>
                  <td class="balance-debt">{{ money(product.lost_value) }}</td>
                  <td>{{ quantity(product.stock_quantity) }}</td>
                  <td>{{ product.unit || 'tk' }}</td>
                </tr>
              </tbody>
            </table>
          </template>

          <template v-else>
            <h4>Inventuurid valitud perioodis</h4>
          <table class="compact-table">
            <thead>
              <tr>
                <th>Aeg</th>
                <th>Valvevärv</th>
                <th>Kaotus</th>
                <th>Netovahe</th>
                <th>Tegevus</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!monthlyReports.length">
                <td colspan="5">Selle perioodi inventuure ei leitud.</td>
              </tr>
              <tr v-for="report in monthlyReports" :key="`month-report-${report.id}`">
                <td>{{ formatDate(report.created_at) }}</td>
                <td>{{ report.valvevarv }}</td>
                <td class="balance-debt">{{ quantity(report.lost_quantity) }}</td>
                <td :class="differenceClass(report.net_difference)">{{ signedQuantity(report.net_difference) }}</td>
                <td>
                  <button type="button" @click="loadDetail(report.id)">Ava</button>
                </td>
              </tr>
            </tbody>
          </table>

            <div class="section-tools">
              <h4>Sularaha raportid</h4>
              <label class="checkbox-label">
                <input v-model="hideZeroCash" type="checkbox" />
                Peida null sularaha
              </label>
            </div>
          <table class="compact-table">
            <thead>
              <tr>
                <th>Aeg</th>
                <th>Valvevärv</th>
                <th>Loetud sularaha</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filteredMonthlyCashReports.length">
                <td colspan="3">Sularaha ridu ei ole.</td>
              </tr>
              <tr v-for="report in filteredMonthlyCashReports" :key="`cash-${report.id}`">
                <td>{{ formatDate(report.created_at) }}</td>
                <td>{{ report.valvevarv }}</td>
                <td>{{ money(report.cash_counted) }}</td>
              </tr>
            </tbody>
          </table>

          <div class="monthly-product-tools">
            <label>
              Otsi toodet
              <input v-model="productSearch" placeholder="Toote nimi" />
            </label>
            <label>
              Kategooria
              <select v-model="selectedCategory">
                <option value="">Kõik kategooriad</option>
                <option v-for="category in monthlyCategories" :key="category" :value="category">
                  {{ category }}
                </option>
              </select>
            </label>
            <label class="checkbox-label">
              <input v-model="hideZeroLoss" type="checkbox" />
              Peida kaotuseta tooted
            </label>
            <label class="checkbox-label">
              <input v-model="hideZeroStock" type="checkbox" />
              Peida 0-seisuga tooted
            </label>
          </div>

          <h4>Toodete kaotus</h4>
          <table class="compact-table">
            <thead>
              <tr>
                <th>Toode</th>
                <th>Kategooria</th>
                <th>Kaotus</th>
                <th>Netovahe</th>
                <th>Puudujääke</th>
                <th>Ühik</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filteredMonthlyProducts.length">
                <td colspan="6">Tooteid ei leitud.</td>
              </tr>
              <tr v-for="product in filteredMonthlyProducts" :key="product.product_id">
                <td>{{ product.product_name }}</td>
                <td>{{ product.category_name || '-' }}</td>
                <td class="balance-debt">{{ quantity(product.lost_quantity) }}</td>
                <td :class="differenceClass(product.net_difference)">{{ signedQuantity(product.net_difference) }}</td>
                <td>{{ product.shortage_count }}</td>
                <td>{{ product.unit || 'tk' }}</td>
              </tr>
            </tbody>
          </table>
          </template>
        </template>
      </section>

      <section class="panel latest-reports">
        <h3>Viimased inventuurid</h3>
        <p v-if="error" class="error">{{ error }}</p>
        <table class="compact-table latest-reports-table">
          <thead>
            <tr>
              <th>Aeg</th>
              <th>Valvevärv</th>
              <th>Tooteid</th>
              <th>Erinevus</th>
              <th>Sularaha</th>
              <th>Staatus</th>
              <th>Tegevus</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!reports.length">
              <td colspan="7">Inventuuri raporteid ei ole.</td>
            </tr>
            <tr v-for="report in reports" :key="report.id">
              <td>{{ formatShortDate(report.created_at) }}</td>
              <td>{{ report.valvevarv }}</td>
              <td>{{ report.counted_products }}</td>
              <td>{{ quantity(report.total_absolute_difference) }}</td>
              <td>{{ money(report.cash_counted) }}</td>
              <td :class="statusClass(report.status_color)">{{ report.status }}</td>
              <td>
                <button type="button" @click="loadDetail(report.id)">Ava</button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <div v-if="detail" class="modal-backdrop" @click.self="detail = null">
      <section class="modal-panel">
        <div class="actions" style="justify-content: space-between; align-items: center;">
          <h3 style="margin: 0;">Inventuuri raport</h3>
          <button type="button" @click="detail = null">Sulge</button>
        </div>

        <p>
          {{ formatDate(detail.report.created_at) }} |
          Valvevärv: <strong>{{ detail.report.valvevarv }}</strong> |
          Sularaha: <strong>{{ money(detail.report.cash_counted) }}</strong> |
          {{ detail.report.comment || '-' }}
        </p>
        <p :class="statusClass(detail.report.status_color)"><strong>{{ detail.report.status }}</strong></p>

        <label class="checkbox-label detail-filter">
          <input v-model="detailLossOnly" type="checkbox" />
          Näita ainult puudujääke
        </label>

        <table>
          <thead>
            <tr>
              <th>Kategooria</th>
              <th>Toode</th>
              <th>Eeldatav</th>
              <th>Loetud</th>
              <th>Erinevus</th>
              <th>Ühik</th>
              <th>Kommentaar</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!filteredDetailRows.length">
              <td colspan="7">Ridu ei leitud.</td>
            </tr>
            <tr v-for="row in filteredDetailRows" :key="row.id">
              <td>{{ row.category_name || '-' }}</td>
              <td>{{ row.product_name }}</td>
              <td>{{ quantity(row.expected_quantity) }}</td>
              <td>{{ quantity(row.counted_quantity) }}</td>
              <td>{{ signedQuantity(row.difference) }}</td>
              <td>{{ row.unit || 'tk' }}</td>
              <td>{{ row.comment || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { apiFetchAdmin } from "../../api/client";
import { quantity, signedQuantity } from "../../utils/format";

const reports = ref([]);
const detail = ref(null);
const error = ref("");
const today = new Date();
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
const dateFrom = ref(formatInputDate(monthStart));
const dateTo = ref(formatInputDate(today));
const monthlyLoading = ref(false);
const monthlyError = ref("");
const monthlyOverview = ref(null);
const overviewTab = ref("loss");
const productSearch = ref("");
const selectedCategory = ref("");
const hideZeroLoss = ref(true);
const hideZeroStock = ref(false);
const hideZeroCash = ref(true);
const detailLossOnly = ref(true);

const emptyMonthlySummary = {
  reports_count: 0,
  counted_days: 0,
  lost_quantity: 0,
  overage_quantity: 0,
  net_difference: 0
};

function formatInputDate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const monthlySummary = computed(() => monthlyOverview.value?.summary || emptyMonthlySummary);
const monthlyReports = computed(() => monthlyOverview.value?.reports || []);
const monthlyCashReports = computed(() => monthlyOverview.value?.cash_reports || []);
const monthlyProducts = computed(() => monthlyOverview.value?.products || []);
const valueSummary = computed(() => monthlyOverview.value?.value_summary || {
  total_stock_value: 0,
  lost_value: 0,
  loss_percent: 0
});
const monthlyCategories = computed(() => {
  return [...new Set(monthlyProducts.value.map((product) => product.category_name).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "et"));
});
const filteredMonthlyCashReports = computed(() => {
  return monthlyCashReports.value.filter((report) => {
    return !hideZeroCash.value || Number(report.cash_counted || 0) !== 0;
  });
});
const filteredMonthlyProducts = computed(() => {
  const q = productSearch.value.trim().toLowerCase();

  return monthlyProducts.value.filter((product) => {
    if (hideZeroLoss.value && Number(product.lost_quantity || 0) === 0) {
      return false;
    }

    if (hideZeroStock.value && Number(product.stock_quantity || 0) === 0) {
      return false;
    }

    if (selectedCategory.value && product.category_name !== selectedCategory.value) {
      return false;
    }

    if (q && !String(product.product_name || "").toLowerCase().includes(q)) {
      return false;
    }

    return true;
  });
});
const filteredDetailRows = computed(() => {
  const rows = detail.value?.rows || [];
  if (!detailLossOnly.value) {
    return rows;
  }

  return rows.filter((row) => Number(row.difference || 0) < 0);
});

function formatDate(value) {
  return new Date(value).toLocaleString("et-EE");
}

function formatShortDate(value) {
  return new Date(value).toLocaleString("et-EE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function money(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function differenceClass(value) {
  const n = Number(value || 0);
  if (n < 0) {
    return "balance-debt";
  }
  if (n > 0) {
    return "balance-credit";
  }
  return "";
}

function statusClass(color) {
  if (color === "red") {
    return "balance-debt";
  }
  if (color === "yellow") {
    return "status-yellow";
  }
  return "balance-credit";
}

async function loadReports() {
  error.value = "";
  try {
    reports.value = await apiFetchAdmin("/admin/inventory/reports?limit=14");
  } catch (err) {
    error.value = err.message;
  }
}

async function loadMonthlyOverview() {
  monthlyLoading.value = true;
  monthlyError.value = "";

  try {
    const params = new URLSearchParams({
      date_from: dateFrom.value,
      date_to: dateTo.value
    });
    monthlyOverview.value = await apiFetchAdmin(`/admin/inventory/monthly-overview?${params.toString()}`);
  } catch (err) {
    monthlyError.value = err.message;
  } finally {
    monthlyLoading.value = false;
  }
}

async function loadDetail(id) {
  error.value = "";
  try {
    detail.value = await apiFetchAdmin(`/admin/inventory/reports/${id}`);
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(async () => {
  await Promise.all([loadReports(), loadMonthlyOverview()]);
});
</script>

<style scoped>
h4 {
  margin: 12px 0 6px;
}

.inventory-overview-grid {
  align-items: start;
  align-self: center;
  display: grid;
  gap: 14px;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  max-width: 1580px;
  width: min(98vw, 1580px);
}

.inventory-overview-grid .panel {
  min-width: 0;
}

.monthly-overview {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.monthly-overview-header {
  align-items: end;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
}

.monthly-overview-header h3 {
  margin: 0;
}

.date-range-picker {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(140px, 1fr));
}

.overview-cards {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
}

.overview-cards article {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 10px;
}

.overview-cards span {
  display: block;
  font-size: 0.92rem;
  margin-bottom: 6px;
}

.overview-cards strong {
  font-size: 1.35rem;
}

.overview-tabs {
  display: flex;
  gap: 8px;
}

.overview-tabs button {
  flex: 1;
}

.overview-tabs button.active {
  background: var(--surface-alt);
  font-weight: bold;
}

.section-tools {
  align-items: end;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: space-between;
}

.section-tools h4 {
  margin-bottom: 0;
}

.monthly-product-tools {
  align-items: end;
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(150px, 1fr) minmax(150px, 1fr) minmax(130px, auto);
}

.checkbox-label {
  align-items: center;
  display: flex;
  gap: 8px;
  min-height: 42px;
}

.checkbox-label input {
  width: auto;
}

.compact-table {
  table-layout: fixed;
}

.compact-table th,
.compact-table td {
  font-size: 0.95rem;
  overflow-wrap: anywhere;
  padding: 7px 7px;
}

.latest-reports-table th:nth-child(1),
.latest-reports-table td:nth-child(1) {
  width: 88px;
}

.latest-reports-table th:nth-child(2),
.latest-reports-table td:nth-child(2) {
  width: 120px;
}

.latest-reports-table th:nth-child(3),
.latest-reports-table td:nth-child(3) {
  width: 62px;
}

.latest-reports-table th:nth-child(4),
.latest-reports-table td:nth-child(4) {
  width: 86px;
}

.latest-reports-table th:nth-child(5),
.latest-reports-table td:nth-child(5) {
  width: 90px;
}

.latest-reports-table th:nth-child(6),
.latest-reports-table td:nth-child(6) {
  width: 86px;
}

.latest-reports-table th:nth-child(7),
.latest-reports-table td:nth-child(7) {
  width: 74px;
}

.latest-reports-table button {
  padding: 5px 9px;
}

.detail-filter {
  margin: 8px 0;
}

.status-yellow {
  color: #9a7300;
}

@media (max-width: 980px) {
  .inventory-overview-grid {
    grid-template-columns: 1fr;
  }

  .monthly-product-tools {
    grid-template-columns: 1fr;
  }
}
</style>
