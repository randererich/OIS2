<template>
  <section class="page">
    <h2>Kategooriad (Admin)</h2>

    <form class="form-grid" @submit.prevent="saveCategory">
      <label>
        Nimi
        <input v-model="form.name" required />
      </label>

      <label>
        Emoji
        <input v-model="form.emoji" />
      </label>

      <label>
        <input v-model="form.is_visible" type="checkbox" /> Nahtav
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
          <th>Emoji</th>
          <th>Jarjekord</th>
          <th>Nahtav</th>
          <th>Tegevus</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="category in categories" :key="category.id">
          <td>{{ category.name }}</td>
          <td>{{ category.emoji || '-' }}</td>
          <td>{{ category.sort_order }}</td>
          <td>{{ category.is_visible ? 'Jah' : 'Ei' }}</td>
          <td>
            <div class="actions">
              <button type="button" @click="editCategory(category)">Edit</button>
              <button type="button" @click="deleteCategory(category)">Delete</button>
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

const categories = ref([]);
const error = ref("");

const initialForm = () => ({
  id: null,
  name: "",
  emoji: "",
  is_visible: true
});

const form = reactive(initialForm());

function resetForm() {
  Object.assign(form, initialForm());
}

async function loadCategories() {
  error.value = "";
  try {
    categories.value = await apiFetchAdmin("/admin/categories");
  } catch (err) {
    error.value = err.message;
  }
}

function editCategory(category) {
  form.id = category.id;
  form.name = category.name;
  form.emoji = category.emoji || "";
  form.is_visible = category.is_visible;
}

async function saveCategory() {
  error.value = "";
  const payload = {
    name: form.name,
    emoji: form.emoji || null,
    is_visible: Boolean(form.is_visible)
  };

  try {
    if (form.id) {
      await apiFetchAdmin(`/admin/categories/${form.id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
    } else {
      await apiFetchAdmin("/admin/categories", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    resetForm();
    await loadCategories();
  } catch (err) {
    error.value = err.message;
  }
}

async function deleteCategory(category) {
  if (!window.confirm(`Kustutan kategooria ${category.name}?`)) {
    return;
  }

  try {
    await apiFetchAdmin(`/admin/categories/${category.id}`, { method: "DELETE" });
    await loadCategories();
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(loadCategories);
</script>
