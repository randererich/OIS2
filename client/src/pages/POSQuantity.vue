<template>
  <section class="page pos-quantity-page">
    <h2 class="pos-quantity-title">Sisesta {{ isCashOperation ? 'summa' : 'kogus' }}</h2>

    <p class="inline-summary pos-quantity-summary">
      {{ posStore.product?.name }}<template v-if="!isCashOperation"> - {{ money(posStore.product?.price) }}</template>.
      Sisesta {{ isCashOperation ? 'summa' : 'kogus' }}.
    </p>

    <div class="actions pos-quantity-actions-top">
      <button class="pos-quantity-big-button" type="button" @click="router.push('/')">Tagasi</button>
    </div>

    <label class="pos-quantity-input-wrap">
      {{ isCashOperation ? 'Summa' : 'Kogus' }}
      <input ref="quantityInput" class="pos-quantity-input" v-model="inputValue" inputmode="decimal" autocomplete="off" spellcheck="false" />
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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import NumberPad from "../components/NumberPad.vue";
import { usePosStore } from "../stores/posStore";

const router = useRouter();
const posStore = usePosStore();
const inputValue = ref("1");
const quantityInput = ref(null);
const isDefaultEntry = ref(true);
const error = ref("");
const MAX_PURCHASE_QUANTITY = 100;
const isCashOperation = computed(() => Boolean(posStore.product?.cash_operation));

function sanitizeRawInput(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return "";
  }

  const negative = trimmed.startsWith("-");
  const cleaned = trimmed.replace(/^-/, "").replace(/[^\d.]/g, "");

  if (!cleaned) {
    return negative ? "-" : "";
  }

  const [integerPartRaw, ...fractionParts] = cleaned.split(".");
  const integerPart = integerPartRaw.replace(/^0+(?=\d)/, "") || "0";
  const fractionPart = fractionParts.join("").replace(/\./g, "");
  const hasDecimalPoint = cleaned.includes(".");
  const normalized = hasDecimalPoint ? `${integerPart}.${fractionPart}` : integerPart;

  if (normalized === "0" && !hasDecimalPoint && integerPartRaw === "") {
    return negative ? "-" : "";
  }

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
  // Allow digits and decimal point
  if (!/^[\d.]$/.test(char)) {
    return;
  }

  // Don't allow decimal point if already present
  if (char === "." && inputValue.value.includes(".")) {
    return;
  }

  if (isDefaultEntry.value) {
    inputValue.value = char === "." ? "0." : char;
    isDefaultEntry.value = false;
    return;
  }

  // If trying to add decimal after a minus sign or at start, add 0 first
  if (char === "." && (inputValue.value === "-" || inputValue.value === "")) {
    inputValue.value = inputValue.value + "0.";
    return;
  }

  inputValue.value = inputValue.value === "0" && char !== "." ? char : inputValue.value + char;
}

function toggleSign() {
  if (isDefaultEntry.value) {
    inputValue.value = "-1";
    isDefaultEntry.value = false;
    return;
  }

  const normalized = sanitizeRawInput(inputValue.value);
  if (!normalized || Number(normalized) === 0) {
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
    inputValue.value = "";
    isDefaultEntry.value = false;
    return;
  }

  inputValue.value = inputValue.value.slice(0, -1);
  if (inputValue.value === "-") {
    inputValue.value = "";
    isDefaultEntry.value = false;
  }
}

function nextStep() {
  error.value = "";
  const quantity = Number(sanitizeRawInput(inputValue.value));
  if (!Number.isFinite(quantity) || quantity === 0) {
    error.value = `Palun sisesta korrektne ${isCashOperation.value ? 'summa' : 'kogus'} (mitte 0).`;
    return;
  }

  if (isCashOperation.value && quantity < 0) {
    error.value = "Summa peab olema positiivne.";
    return;
  }

  if (!isCashOperation.value && Math.abs(quantity) > MAX_PURCHASE_QUANTITY) {
    error.value = `Korraga saab kirja panna kuni ${MAX_PURCHASE_QUANTITY} toodet.`;
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

  if (event.key === ".") {
    event.preventDefault();
    append(".");
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
  if (normalized === "") {
    isDefaultEntry.value = false;
    return;
  }

  if (normalized === "-") {
    inputValue.value = "";
    isDefaultEntry.value = false;
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
  gap: 1.2rem;
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
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 440px;
  font-size: 1.45rem;
  gap: 0.6rem;
}

.pos-quantity-input {
  text-align: center;
  font-size: 2.7rem;
  padding: 16px;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
  border-radius: 20px;
  border: 1px solid rgba(13, 31, 48, 0.16);
  box-shadow: 0 10px 24px rgba(13, 31, 48, 0.08);
}

.pos-quantity-pad {
  width: 100%;
  max-width: 520px;
}

.pos-quantity-pad :deep(.number-pad) {
  max-width: 520px;
  margin: 0 auto;
}

.pos-quantity-big-button {
  font-size: 1.75rem;
  padding: 16px 30px;
  min-width: 280px;
}
</style>
