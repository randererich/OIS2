<template>
  <table>
    <thead>
      <tr>
        <th colspan="2">{{ category.emoji || "" }} {{ category.name }} {{ category.emoji || "" }}</th>
      </tr>
      <tr>
        <th :colspan="isCashCategory ? 2 : 1">Toode</th>
        <th v-if="!isCashCategory">Hind</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="product in category.products"
        :key="product.id"
        class="clickable"
        @click="$emit('select', product)"
      >
        <td :colspan="product.cash_operation ? 2 : 1">{{ product.name }}</td>
        <td v-if="!product.cash_operation">{{ money(product.price) }}</td>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  category: {
    type: Object,
    required: true
  }
});

defineEmits(["select"]);

const isCashCategory = computed(() =>
  props.category.products.some((product) => product.cash_operation)
);

function money(value) {
  return `${Number(value).toFixed(2)} €`;
}
</script>

<style scoped>
table {
  background: rgba(255, 255, 255, 0.8);
}

th {
  background: rgba(239, 239, 239, 0.82);
}

td {
  background: rgba(255, 255, 255, 0.62);
}
</style>
