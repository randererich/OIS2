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
      <input class="pos-quantity-input" v-model="inputValue" inputmode="numeric" />
    </label>

    <NumberPad @input="append" @backspace="backspace" class="pos-quantity-pad" />

    <div class="actions pos-quantity-actions-bottom">
      <button class="pos-quantity-big-button" type="button" @click="nextStep">Edasi</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
  </section>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import NumberPad from "../components/NumberPad.vue";
import { usePosStore } from "../stores/posStore";

const router = useRouter();
const posStore = usePosStore();
const inputValue = ref("1");
const isDefaultEntry = ref(true);
const error = ref("");

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
  if (char === "." || char === ",") {
    return;
  }

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

function backspace() {
  if (isDefaultEntry.value) {
    inputValue.value = "1";
    return;
  }

  inputValue.value = inputValue.value.slice(0, -1);
  if (!inputValue.value) {
    inputValue.value = "1";
    isDefaultEntry.value = true;
  }
}

function nextStep() {
  error.value = "";
  const quantity = Number.parseInt(inputValue.value, 10);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    error.value = "Palun sisesta korrektne kogus.";
    return;
  }

  posStore.setQuantity(quantity);
  router.push("/person");
}

onMounted(() => {
  if (!posStore.product) {
    router.replace("/");
    return;
  }

  resetDefaultEntry();
});
</script>

<style scoped>
.pos-quantity-page {
  align-items: center;
}

.pos-quantity-title {
  font-size: 2rem;
}

.pos-quantity-summary {
  font-size: 1.35rem;
}

.pos-quantity-actions-top,
.pos-quantity-actions-bottom {
  justify-content: center;
  width: 100%;
}

.pos-quantity-input-wrap {
  width: 100%;
  max-width: 340px;
  font-size: 1.2rem;
}

.pos-quantity-input {
  text-align: center;
  font-size: 2rem;
  padding: 12px;
}

.pos-quantity-pad {
  width: 100%;
  max-width: 360px;
}

.pos-quantity-pad :deep(.number-pad) {
  max-width: 360px;
  margin: 0 auto;
}

.pos-quantity-pad :deep(.number-pad button) {
  font-size: 1.6rem;
  padding: 16px;
}

.pos-quantity-big-button {
  font-size: 1.35rem;
  padding: 12px 24px;
  min-width: 220px;
}
</style>
