<template>
  <div class="number-pad">
    <button v-for="key in numberKeys" :key="key" type="button" @click="$emit('input', key)">
      {{ key }}
    </button>
    <button type="button" class="number-pad-sign" @click="$emit('toggle-sign')">+/-</button>
    <button type="button" @click="$emit('input', '0')">0</button>
    <button type="button" @click="$emit('backspace')">←</button>
  </div>
</template>

<script setup>
defineEmits(["input", "backspace", "toggle-sign"]);

const numberKeys = ["7", "8", "9", "4", "5", "6", "1", "2", "3"];
</script>
