<template>
  <section class="page">
    <h2>Inimesed (Admin)</h2>

    <div class="actions">
      <button type="button" @click="openCreatePerson">Lisa inimene</button>
      <label>
        <input v-model="showHidden" type="checkbox" @change="loadPeople" />
        Näita peidetuid
      </label>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <table>
      <thead>
        <tr>
          <th>Nimi</th>
          <th>Coetus</th>
          <th>Konvent</th>
          <th>Nahtav</th>
          <th>Tegevus</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="person in people" :key="person.id">
          <td>{{ person.first_name }} {{ person.last_name }}</td>
          <td>{{ person.coetus || '-' }}</td>
          <td>{{ person.konvent || '-' }}</td>
          <td>{{ person.is_visible ? 'Jah' : 'Ei' }}</td>
          <td>
            <div class="actions">
              <button type="button" @click="editPerson(person)">Edit</button>
              <button type="button" @click="deletePerson(person)">Delete</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="showForm" class="modal-backdrop" @click.self="closeForm">
      <section class="modal-panel">
        <div class="actions" style="justify-content: space-between; align-items: center;">
          <h3 style="margin: 0;">{{ form.id ? 'Muuda inimest' : 'Lisa inimene' }}</h3>
          <button type="button" @click="closeForm">Sulge</button>
        </div>

        <form class="form-grid" @submit.prevent="savePerson">
          <label>
            Eesnimi
            <input v-model="form.first_name" required />
          </label>

          <label>
            Perenimi
            <input v-model="form.last_name" required />
          </label>

          <label>
            Coetus
            <input v-model="form.coetus" />
          </label>

          <label>
            Konvent
            <input v-model="form.konvent" />
          </label>

          <label>
            <input v-model="form.is_visible" type="checkbox" /> Nahtav
          </label>

          <div class="actions" style="align-items: end">
            <button type="submit">Salvesta</button>
            <button type="button" @click="resetForm">Puhasta</button>
          </div>
        </form>
      </section>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { apiFetchAdmin } from "../api/client";

const people = ref([]);
const error = ref("");
const showForm = ref(false);
const showHidden = ref(false);

const initialForm = () => ({
  id: null,
  first_name: "",
  last_name: "",
  coetus: "",
  konvent: "",
  is_visible: true
});

const form = reactive(initialForm());

function resetForm() {
  Object.assign(form, initialForm());
}

function closeForm() {
  showForm.value = false;
  resetForm();
}

function openCreatePerson() {
  resetForm();
  showForm.value = true;
}

async function loadPeople() {
  error.value = "";
  try {
    const params = new URLSearchParams();
    if (showHidden.value) {
      params.set("include_hidden", "true");
    }

    const query = params.toString();
    people.value = await apiFetchAdmin(`/admin/people${query ? `?${query}` : ""}`);
  } catch (err) {
    error.value = err.message;
  }
}

function editPerson(person) {
  form.id = person.id;
  form.first_name = person.first_name;
  form.last_name = person.last_name;
  form.coetus = person.coetus || "";
  form.konvent = person.konvent || "";
  form.is_visible = person.is_visible;
  showForm.value = true;
}

async function savePerson() {
  error.value = "";
  const payload = {
    first_name: form.first_name,
    last_name: form.last_name,
    coetus: form.coetus || null,
    konvent: form.konvent || null,
    is_visible: Boolean(form.is_visible)
  };

  try {
    if (form.id) {
      await apiFetchAdmin(`/admin/people/${form.id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
    } else {
      await apiFetchAdmin("/admin/people", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    closeForm();
    await loadPeople();
  } catch (err) {
    error.value = err.message;
  }
}

async function deletePerson(person) {
  if (!window.confirm(`Kustutan inimese ${person.first_name} ${person.last_name}?`)) {
    return;
  }

  try {
    await apiFetchAdmin(`/admin/people/${person.id}`, { method: "DELETE" });
    await loadPeople();
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(loadPeople);
</script>
