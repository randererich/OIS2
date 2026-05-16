<template>
  <section class="page admin-debts-page">
    <h2>Võlgade muutmine</h2>

    <div class="form-grid">
      <label>
        Otsi inimest
        <input v-model="search" placeholder="Nimi / coetus / konvent" @input="loadDebts" />
      </label>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="success">{{ success }}</p>

    <div class="admin-debts-layout">
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
          <tr
            v-for="person in debts"
            :key="person.id"
            class="clickable"
            :class="{ selected: selectedPerson?.id === person.id }"
            @click="selectPerson(person)"
          >
            <td>{{ person.first_name }} {{ person.last_name }}</td>
            <td>{{ person.coetus || '-' }}</td>
            <td>{{ person.konvent || '-' }}</td>
            <td :class="balanceClass(person.debt)">{{ balanceMessage(person.debt) }}</td>
          </tr>
        </tbody>
      </table>

      <section class="admin-debt-panel">
        <template v-if="selectedPerson">
          <h3>{{ selectedPerson.first_name }} {{ selectedPerson.last_name }}</h3>
          <p :class="balanceClass(selectedPerson.debt)">
            <strong>{{ balanceMessage(selectedPerson.debt) }}</strong>
          </p>

          <label>
            Summa
            <input v-model="amount" inputmode="decimal" placeholder="10.00" />
          </label>

          <label>
            Kommentaar
            <textarea v-model="comment" rows="3" />
          </label>

          <div class="actions admin-debt-actions">
            <button type="button" :disabled="saving" @click="adjustDebt('add')">Lisa võlga</button>
            <button type="button" :disabled="saving" @click="adjustDebt('remove')">Vähenda võlga</button>
            <button type="button" :disabled="saving || Number(selectedPerson.debt || 0) === 0" @click="zeroDebt">
              Nulli võlg
            </button>
          </div>
        </template>

        <p v-else>Vali inimene, kelle saldot muuta.</p>
      </section>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { apiFetchAdmin } from "../../api/client";

const debts = ref([]);
const selectedPerson = ref(null);
const search = ref("");
const amount = ref("");
const comment = ref("");
const error = ref("");
const success = ref("");
const saving = ref(false);

function money(value) {
  return `${Number(value || 0).toFixed(2)} €`;
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

function selectPerson(person) {
  selectedPerson.value = person;
  error.value = "";
  success.value = "";
}

async function loadDebts() {
  error.value = "";
  const params = new URLSearchParams();
  if (search.value.trim()) {
    params.set("q", search.value.trim());
  }

  try {
    debts.value = await apiFetchAdmin(`/admin/debts?${params.toString()}`);
    if (selectedPerson.value) {
      selectedPerson.value = debts.value.find((person) => person.id === selectedPerson.value.id) || null;
    }
  } catch (err) {
    error.value = err.message;
  }
}

async function sendAdjustment(payload) {
  if (!selectedPerson.value) {
    return;
  }

  saving.value = true;
  error.value = "";
  success.value = "";

  try {
    const result = await apiFetchAdmin("/admin/debts/adjustments", {
      method: "POST",
      body: JSON.stringify({
        person_id: selectedPerson.value.id,
        comment: comment.value.trim() || null,
        ...payload
      })
    });

    selectedPerson.value = result.person;
    amount.value = "";
    comment.value = "";
    success.value = "Saldo muudetud.";
    await loadDebts();
  } catch (err) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
}

async function adjustDebt(operation) {
  const parsedAmount = Number(String(amount.value).replace(",", "."));
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    error.value = "Sisesta positiivne summa.";
    return;
  }

  await sendAdjustment({ operation, amount: parsedAmount });
}

async function zeroDebt() {
  await sendAdjustment({ operation: "zero" });
}

onMounted(loadDebts);
</script>

<style scoped>
.admin-debts-layout {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
  align-items: start;
}

.admin-debt-panel {
  border: 1px solid var(--border);
  padding: 14px;
  background: var(--panel-bg);
}

.admin-debt-panel h3 {
  margin-top: 0;
}

.admin-debt-actions {
  flex-direction: column;
  align-items: stretch;
}

.selected {
  outline: 2px solid var(--btn-bg);
}

@media (max-width: 900px) {
  .admin-debts-layout {
    grid-template-columns: 1fr;
  }
}
</style>
