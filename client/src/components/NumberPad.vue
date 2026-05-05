<template>
  <div class="number-pad" role="group" aria-label="Numpad">
    <button v-for="key in numberKeys" :key="key" class="number-pad-key number-pad-digit" type="button" @click="$emit('input', key)">
      {{ key }}
    </button>
    <button type="button" class="number-pad-key number-pad-sign" @click="$emit('toggle-sign')">+/-</button>
    <button type="button" class="number-pad-key number-pad-zero" @click="$emit('input', '0')">0</button>
    <button type="button" class="number-pad-key number-pad-decimal" @click="$emit('input', '.')">.</button>
    <button type="button" class="number-pad-key number-pad-backspace" @click="$emit('backspace')">←</button>
  </div>
</template>

<script setup>
defineEmits(["input", "backspace", "toggle-sign"]);

const numberKeys = ["7", "8", "9", "4", "5", "6", "1", "2", "3"];
</script>

<style scoped>
.number-pad {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.9rem;
  padding: 1rem;
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(240, 244, 248, 0.92));
  border: 1px solid rgba(13, 31, 48, 0.12);
  box-shadow:
    0 24px 48px rgba(13, 31, 48, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.number-pad-key {
  appearance: none;
  border: 0;
  border-radius: 20px;
  min-height: 72px;
  padding: 0.9rem 1rem;
  font: inherit;
  font-size: 1.8rem;
  font-weight: 700;
  color: #0d1f30;
  background: linear-gradient(180deg, #ffffff, #e9eef4);
  box-shadow:
    0 10px 18px rgba(13, 31, 48, 0.10),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
  cursor: pointer;
  transition:
    transform 120ms ease,
    box-shadow 120ms ease,
    background 120ms ease;
}

.number-pad-key:hover {
  transform: translateY(-1px);
  box-shadow:
    0 14px 22px rgba(13, 31, 48, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
}

.number-pad-key:active {
  transform: translateY(1px);
  box-shadow:
    0 7px 14px rgba(13, 31, 48, 0.10),
    inset 0 2px 6px rgba(13, 31, 48, 0.10);
}

.number-pad-key:focus-visible {
  outline: 3px solid rgba(35, 115, 196, 0.32);
  outline-offset: 2px;
}

.number-pad-sign {
  color: #ffffff;
  background: linear-gradient(180deg, #3e5874, #2b415a);
}

.number-pad-zero {
  font-size: 1.95rem;
}

.number-pad-decimal {
  font-size: 2rem;
}

.number-pad-backspace {
  grid-column: 1 / -1;
  min-height: 64px;
  color: #ffffff;
  background: linear-gradient(180deg, #bc5d43, #8f3f2b);
}
</style>
