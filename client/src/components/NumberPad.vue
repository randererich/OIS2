<template>
  <div class="number-pad">
    <button v-for="key in keys" :key="key" type="button" @click="$emit('input', key)">
      {{ key }}
    </button>
    <button type="button" @click="$emit('backspace')">←</button>
  </div>
</template>

<script setup>
defineEmits(["input", "backspace"]);

const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ",", "."];
</script>
