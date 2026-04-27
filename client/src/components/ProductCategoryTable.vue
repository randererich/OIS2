<template>
  <table>
    <thead>
      <tr>
        <th colspan="2">{{ category.emoji || "" }} {{ category.name }} {{ category.emoji || "" }}</th>
      </tr>
      <tr>
        <th>Toode</th>
        <th>Hind</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="product in category.products"
        :key="product.id"
        class="clickable"
        @click="$emit('select', product)"
      >
        <td>{{ product.name }}</td>
        <td>{{ money(product.price) }}</td>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
defineProps({
  category: {
    type: Object,
    required: true
  }
});

defineEmits(["select"]);

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
