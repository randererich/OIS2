<template>
  <section class="page">
    <h2>Kinnita ost</h2>

    <template v-if="successBalance">
      <p class="success confirm-success-title">Ost salvestatud.</p>
      <p class="confirm-balance">
        {{ successBalance.first_name }} {{ successBalance.last_name }} -
        <strong>{{ balanceMessage(successBalance.balance) }}</strong>
      </p>
      <button class="confirm-home-button" type="button" @click="goHome">Tagasi avalehele</button>
    </template>

    <template v-else>
      <div class="actions">
        <button type="button" @click="router.push('/person')">Tagasi</button>
      </div>

      <label>
        Kommentaar:
        <textarea ref="commentInput" v-model="comment" rows="3" />
      </label>

      <p class="inline-summary">
        <template v-if="isCashOperation">
          <strong>{{ productName }}:</strong>
          {{ money(Math.abs(Number(posStore.quantity || 0))) }},
          {{ posStore.person?.first_name }} {{ posStore.person?.last_name }}.
        </template>
        <template v-else-if="isCorrection">
          <strong>Parandus:</strong>
          {{ posStore.quantity }} {{ posStore.product?.unit || 'tk' }} x {{ productName }} = {{ money(posStore.total) }},
          {{ posStore.person?.first_name }} {{ posStore.person?.last_name }}.
        </template>
        <template v-else>
          {{ posStore.quantity }} {{ posStore.product?.unit || 'tk' }} x {{ productName }} = {{ money(posStore.total) }},
          {{ posStore.person?.first_name }} {{ posStore.person?.last_name }}.
        </template>
      </p>

      <div class="actions confirm-actions">
        <button type="button" :disabled="saving" @click="submit(false)">
          {{ saving ? 'Salvestan...' : 'Kinnita' }}
        </button>
        <button v-if="canPayWithCash" type="button" :disabled="saving" @click="submit(true)">
          {{ saving ? 'Salvestan...' : 'Kinnita sularahas' }}
        </button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </template>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { apiFetch } from "../api/client";
import { usePosStore } from "../stores/posStore";

const router = useRouter();
const posStore = usePosStore();

const comment = ref("");
const commentInput = ref(null);
const saving = ref(false);
const error = ref("");
const successBalance = ref(null);
const isCorrection = computed(() => Number(posStore.quantity || 0) < 0);
const isCashOperation = computed(() => Boolean(posStore.product?.cash_operation));
const canPayWithCash = computed(() => !isCashOperation.value && !isCorrection.value);
const productName = computed(() => {
  if (posStore.product?.unit === "cl" && !posStore.product?.cash_operation) {
    return `${posStore.product.name} (1 cl)`;
  }
  return posStore.product?.name || "";
});

function money(value) {
  return `${Number(value || 0).toFixed(2)} €`;
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

function goHome() {
  successBalance.value = null;
  router.push("/");
}

async function submit(paidWithCash = false) {
  if (!posStore.product || !posStore.person) {
    return;
  }

  saving.value = true;
  error.value = "";

  try {
    const personId = posStore.person.id;

    await apiFetch("/purchases", {
      method: "POST",
      body: JSON.stringify({
        person_id: personId,
        product_id: posStore.product.id,
        quantity: posStore.quantity,
        comment: comment.value.trim() || null,
        paid_with_cash: paidWithCash
      })
    });

    successBalance.value = await apiFetch(`/people/${personId}/balance`);
    posStore.reset();
  } catch (err) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
}

function goBack() {
  if (successBalance.value) {
    goHome();
    return;
  }
  router.push("/person");
}

function handleEnter() {
  if (successBalance.value) {
    goHome();
    return;
  }
  if (!saving.value) {
    submit(false);
  }
}

function handleKeydown(event) {
  if (event.isComposing) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    goBack();
    return;
  }

  if (event.key === "Enter") {
    if (event.target instanceof HTMLTextAreaElement && event.shiftKey) {
      return;
    }
    event.preventDefault();
    handleEnter();
  }
}

onMounted(() => {
  if (!posStore.product || !posStore.person) {
    router.replace("/");
    return;
  }

  window.addEventListener("keydown", handleKeydown);

  nextTick(() => {
    commentInput.value?.focus();
  });
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<style scoped>
.confirm-success-title {
  font-size: 1.7rem;
  text-align: center;
}

.confirm-balance {
  color: var(--text);
  font-size: 1.2rem;
  text-align: center;
}

:global([data-theme="dark"]) .confirm-balance,
:global([data-theme="dark"]) .confirm-balance strong {
  color: #ffffff;
}

.confirm-home-button {
  align-self: center;
  font-size: 1.3rem;
  padding: 12px 20px;
}

.confirm-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 280px));
  gap: 18px 72px;
  justify-content: center;
  margin: 10px auto 0;
  width: 100%;
  max-width: 680px;
}

.confirm-actions button {
  width: 100%;
  min-height: 64px;
  padding: 16px 24px;
  font-size: 1.25rem;
  font-weight: 700;
}

</style>
