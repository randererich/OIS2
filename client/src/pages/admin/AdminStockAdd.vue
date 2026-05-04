<template>
  <section class="page">
    <h2>Varu lisamine</h2>

    <form class="form-grid" @submit.prevent="submit">
      <label>
        Toode
        <select v-model="form.product_id" required>
          <option value="">Vali toode</option>
          <option v-for="product in products" :key="product.id" :value="String(product.id)">
            {{ product.name }}
          </option>
        </select>
      </label>

      <label>
        Lisatav kogus
        <input v-model="form.quantity_change" type="number" step="1" required />
      </label>

      <label>
        Kommentaar
        <input v-model="form.comment" />
      </label>

      <button type="submit">Lisa varu</button>
    </form>

    <p v-if="message" class="success">{{ message }}</p>
    <p v-if="error" class="error">{{ error }}</p>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { apiFetchAdmin } from "../../api/client";

const products = ref([]);
const message = ref("");
const error = ref("");

const form = reactive({
  product_id: "",
  quantity_change: "",
  comment: ""
});

async function loadProducts() {
  try {
    products.value = await apiFetchAdmin("/admin/products");
  } catch (err) {
    error.value = err.message;
  }
}

async function submit() {
  message.value = "";
  error.value = "";

  try {
    await apiFetchAdmin("/admin/inventory/movement", {
      method: "POST",
      body: JSON.stringify({
        product_id: Number(form.product_id),
        quantity_change: Number(form.quantity_change),
        reason: "stock_add",
        comment: form.comment || null
      })
    });

    form.quantity_change = "";
    form.comment = "";
    message.value = "Varu liikumine salvestatud.";
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(loadProducts);
</script>
