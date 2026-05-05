<template>
  <div class="number-pad" role="group" aria-label="Numpad">
    <button v-for="key in numberKeys" :key="key" class="number-pad-key" type="button" @click="$emit('input', key)">
      {{ key }}
    </button>
    <button type="button" class="number-pad-key number-pad-sign" @click="$emit('toggle-sign')">+/-</button>
    <button type="button" class="number-pad-key" @click="$emit('input', '0')">0</button>
    <button type="button" class="number-pad-key" @click="$emit('input', '.')">.</button>
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
  gap: 0.55rem;
  padding: 0.75rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.24);
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 12px 28px rgba(13, 31, 48, 0.12);
}

.number-pad-key {
  appearance: none;
  border: 1px solid rgba(13, 31, 48, 0.14);
  border-radius: 14px;
  min-height: 64px;
  padding: 0.8rem 1rem;
  font: inherit;
  font-size: 1.6rem;
  font-weight: 700;
  color: #10263d;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(238, 242, 247, 0.96));
  box-shadow:
    0 7px 14px rgba(13, 31, 48, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  cursor: pointer;
  transition:
    transform 120ms ease,
    box-shadow 120ms ease,
    background 120ms ease;
}

.number-pad-key:hover {
  transform: translateY(-1px);
  box-shadow:
    0 10px 18px rgba(13, 31, 48, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.96);
}

.number-pad-key:active {
  transform: translateY(1px);
  box-shadow:
    0 5px 10px rgba(13, 31, 48, 0.10),
    inset 0 2px 6px rgba(13, 31, 48, 0.10);
}

.number-pad-key:focus-visible {
  outline: 3px solid rgba(35, 115, 196, 0.32);
  outline-offset: 2px;
}

.number-pad-sign {
  color: #ffffff;
  background: linear-gradient(180deg, #4b6784, #364d67);
}

.number-pad-backspace {
  grid-column: 1 / -1;
  min-height: 58px;
  color: #ffffff;
  background: linear-gradient(180deg, #b35c44, #94402f);
}
</style>
