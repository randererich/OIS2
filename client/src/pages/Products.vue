<template>
  <section class="page">
    <h2>Tooted (Admin)</h2>

    <form class="form-grid" @submit.prevent="saveProduct">
      <label>
        Kategooria
        <select v-model="form.category_id">
          <option value="">--</option>
          <option v-for="category in categories" :key="category.id" :value="String(category.id)">
            {{ category.name }}
          </option>
        </select>
      </label>

      <label>
        Nimi
        <input v-model="form.name" required />
      </label>

      <label>
        Hind
        <input v-model="form.price" type="number" step="0.01" required />
      </label>

      <label>
        Laos
        <input v-model="form.stock_quantity" type="number" step="1" required />
      </label>

      <label>
        Ühik
        <select v-model="form.unit" required>
          <option value="tk">tk</option>
          <option value="cl">cl</option>
        </select>
      </label>

      <label>
        <input v-model="form.is_visible" type="checkbox" /> Nahtav
      </label>

      <label>
        <input v-model="form.is_inventory_tracked" type="checkbox" /> Jalgi laoseisu
      </label>

      <div class="actions" style="align-items: end">
        <button type="submit">Salvesta</button>
        <button type="button" @click="resetForm">Puhasta</button>
      </div>
    </form>

    <p v-if="error" class="error">{{ error }}</p>

    <table>
      <thead>
        <tr>
          <th>Nimi</th>
          <th>Kategooria</th>
          <th>Hind</th>
          <th>Laos</th>
          <th>Ühik</th>
          <th>Nahtav</th>
          <th>Jalgitav</th>
          <th>Jarjekord</th>
          <th>Tegevus</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="product in products" :key="product.id">
          <td>{{ product.name }}</td>
          <td>{{ product.category_name || '-' }}</td>
          <td>{{ money(product.price) }}</td>
          <td>{{ product.stock_quantity }}</td>
          <td>{{ product.unit || 'tk' }}</td>
          <td>{{ product.is_visible ? 'Jah' : 'Ei' }}</td>
          <td>{{ product.is_inventory_tracked ? 'Jah' : 'Ei' }}</td>
          <td>{{ product.sort_order }}</td>
          <td>
            <div class="actions">
              <button type="button" @click="editProduct(product)">Edit</button>
              <button type="button" @click="deleteProduct(product)">Delete</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { apiFetchAdmin } from "../api/client";

const products = ref([]);
const categories = ref([]);
const error = ref("");

const initialForm = () => ({
  id: null,
  category_id: "",
  name: "",
  price: "0.00",
  stock_quantity: "0",
  unit: "tk",
  is_visible: true,
  is_inventory_tracked: true
});

const form = reactive(initialForm());

function money(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function resetForm() {
  Object.assign(form, initialForm());
}

async function loadData() {
  error.value = "";
  try {
    const [productsData, categoriesData] = await Promise.all([
      apiFetchAdmin("/admin/products"),
      apiFetchAdmin("/admin/categories")
    ]);
    products.value = productsData;
    categories.value = categoriesData;
  } catch (err) {
    error.value = err.message;
  }
}

function editProduct(product) {
  form.id = product.id;
  form.category_id = product.category_id ? String(product.category_id) : "";
  form.name = product.name;
  form.price = String(product.price);
  form.stock_quantity = String(product.stock_quantity);
  form.unit = product.unit || "tk";
  form.is_visible = product.is_visible;
  form.is_inventory_tracked = product.is_inventory_tracked;
}

async function saveProduct() {
  error.value = "";
  const payload = {
    category_id: form.category_id ? Number(form.category_id) : null,
    name: form.name,
    price: Number(form.price),
    stock_quantity: Number(form.stock_quantity),
    unit: form.unit,
    is_visible: Boolean(form.is_visible),
    is_inventory_tracked: Boolean(form.is_inventory_tracked)
  };

  try {
    if (form.id) {
      await apiFetchAdmin(`/admin/products/${form.id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
    } else {
      await apiFetchAdmin("/admin/products", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    resetForm();
    await loadData();
  } catch (err) {
    error.value = err.message;
  }
}

async function deleteProduct(product) {
  if (!window.confirm(`Kustutan toote ${product.name}?`)) {
    return;
  }

  try {
    await apiFetchAdmin(`/admin/products/${product.id}`, { method: "DELETE" });
    await loadData();
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(loadData);
</script>
