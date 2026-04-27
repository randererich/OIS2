<template>
  <section class="page pos-quantity-page">
    <h2 class="pos-quantity-title">Sisesta kogus</h2>

    <p class="inline-summary pos-quantity-summary">
      {{ posStore.product?.name }} - {{ money(posStore.product?.price) }}. Sisesta kogus.
    </p>

    <div class="actions pos-quantity-actions-top">
      <button class="pos-quantity-big-button" type="button" @click="router.push('/')">Tagasi</button>
    </div>

    <label class="pos-quantity-input-wrap">
      Kogus
      <input ref="quantityInput" class="pos-quantity-input" v-model="inputValue" inputmode="text" />
    </label>

    <NumberPad
      class="pos-quantity-pad"
      @input="append"
      @backspace="backspace"
      @toggle-sign="toggleSign"
    />

    <div class="actions pos-quantity-actions-bottom">
      <button class="pos-quantity-big-button" type="button" @click="nextStep">Edasi</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
  </section>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import NumberPad from "../components/NumberPad.vue";
import { usePosStore } from "../stores/posStore";

const router = useRouter();
const posStore = usePosStore();
const inputValue = ref("1");
const quantityInput = ref(null);
const isDefaultEntry = ref(true);
const error = ref("");

function sanitizeRawInput(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return "";
  }

  const negative = trimmed.startsWith("-");
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) {
    return negative ? "-" : "";
  }

  const normalized = String(Number.parseInt(digits, 10));
  return negative ? `-${normalized}` : normalized;
}

function resetDefaultEntry() {
  posStore.setQuantity(1);
  inputValue.value = "1";
  isDefaultEntry.value = true;
  error.value = "";
}

function money(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function append(char) {
  if (!/^\d$/.test(char)) {
    return;
  }

  if (isDefaultEntry.value) {
    inputValue.value = char;
    isDefaultEntry.value = false;
    return;
  }

  inputValue.value = inputValue.value === "0" ? char : inputValue.value + char;
}

function toggleSign() {
  if (isDefaultEntry.value) {
    inputValue.value = "-1";
    isDefaultEntry.value = false;
    return;
  }

  const normalized = sanitizeRawInput(inputValue.value);
  if (!normalized || normalized === "0") {
    inputValue.value = "1";
    isDefaultEntry.value = true;
    return;
  }

  inputValue.value = normalized.startsWith("-")
    ? normalized.slice(1)
    : `-${normalized}`;
}

function backspace() {
  if (isDefaultEntry.value) {
    inputValue.value = "1";
    return;
  }

  inputValue.value = inputValue.value.slice(0, -1);
  if (!inputValue.value || inputValue.value === "-") {
    inputValue.value = "1";
    isDefaultEntry.value = true;
  }
}

function nextStep() {
  error.value = "";
  const quantity = Number.parseInt(sanitizeRawInput(inputValue.value), 10);
  if (!Number.isInteger(quantity) || quantity === 0) {
    error.value = "Palun sisesta korrektne kogus (mitte 0).";
    return;
  }

  posStore.setQuantity(quantity);
  router.push("/person");
}

function goBack() {
  router.push("/");
}

function handleKeydown(event) {
  if (event.isComposing) {
    return;
  }

  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (/^\d$/.test(event.key)) {
    event.preventDefault();
    append(event.key);
    return;
  }

  if (event.key === "Backspace") {
    event.preventDefault();
    backspace();
    return;
  }

  if (event.key === "-") {
    event.preventDefault();
    toggleSign();
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    goBack();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    nextStep();
  }
}

onMounted(() => {
  if (!posStore.product) {
    router.replace("/");
    return;
  }

  resetDefaultEntry();

  nextTick(() => {
    quantityInput.value?.focus();
    quantityInput.value?.select();
  });

  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});

// Normalize manual keyboard edits and preserve the "replace first number" behavior.
function handleManualInput() {
  const normalized = sanitizeRawInput(inputValue.value);
  if (!normalized || normalized === "-") {
    inputValue.value = "1";
    isDefaultEntry.value = true;
    return;
  }

  inputValue.value = normalized;
  isDefaultEntry.value = normalized === "1";
}

watch(inputValue, () => {
  if (document.activeElement?.classList?.contains("pos-quantity-input")) {
    handleManualInput();
  }
});
</script>

<style scoped>
.pos-quantity-page {
  align-items: center;
}

.pos-quantity-title {
  font-size: 2.35rem;
}

.pos-quantity-summary {
  font-size: 1.55rem;
}

.pos-quantity-actions-top,
.pos-quantity-actions-bottom {
  justify-content: center;
  width: 100%;
}

.pos-quantity-input-wrap {
  width: 100%;
  max-width: 440px;
  font-size: 1.45rem;
}

.pos-quantity-input {
  text-align: center;
  font-size: 2.7rem;
  padding: 16px;
}

.pos-quantity-pad {
  width: 100%;
  max-width: 520px;
}

.pos-quantity-pad :deep(.number-pad) {
  max-width: 520px;
  margin: 0 auto;
}

.pos-quantity-pad :deep(.number-pad button) {
  font-size: 2rem;
  padding: 22px;
}

.pos-quantity-big-button {
  font-size: 1.75rem;
  padding: 16px 30px;
  min-width: 280px;
}
</style>
