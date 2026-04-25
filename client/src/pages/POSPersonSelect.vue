<template>
  <section class="page">
    <h2>Kommentaar</h2>

    <p class="inline-summary">
      {{ posStore.quantity }} x {{ posStore.product?.name }} = {{ money(posStore.total) }}. Kellele kirja?
    </p>

    <div class="actions">
      <button type="button" @click="router.push('/quantity')">Tagasi</button>
    </div>

    <label>
      Otsi nime
      <input v-model="search" placeholder="Sisesta nimi" />
    </label>

    <p v-if="loading">Laen inimesi...</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <table v-else>
      <thead>
        <tr>
          <th>Nimi</th>
          <th>Konvent</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="group in groupedPeople" :key="group.coetus">
          <tr>
            <th colspan="2">{{ group.coetus || 'Määramata' }}</th>
          </tr>
          <tr
            v-for="person in group.people"
            :key="person.id"
            class="clickable"
            @click="selectPerson(person)"
          >
            <td style="text-align: center">{{ person.first_name }} {{ person.last_name }}</td>
            <td style="text-align: center">{{ person.konvent || '-' }}</td>
          </tr>
        </template>
      </tbody>
    </table>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { apiFetch } from "../api/client";
import { usePosStore } from "../stores/posStore";

const router = useRouter();
const posStore = usePosStore();

const search = ref("");
const people = ref([]);
const loading = ref(false);
const error = ref("");

function money(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

const filteredPeople = computed(() => {
  const term = search.value.trim().toLowerCase();
  if (!term) {
    return people.value;
  }

  return people.value.filter((person) => {
    const fullName = `${person.first_name} ${person.last_name}`.toLowerCase();
    return fullName.includes(term);
  });
});

const groupedPeople = computed(() => {
  const groups = [];
  const map = new Map();

  for (const person of filteredPeople.value) {
    const key = person.coetus || "Määramata";
    if (!map.has(key)) {
      const group = { coetus: key, people: [] };
      map.set(key, group);
      groups.push(group);
    }
    map.get(key).people.push(person);
  }

  return groups;
});

async function loadPeople() {
  loading.value = true;
  error.value = "";
  try {
    people.value = await apiFetch("/people/visible");
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function selectPerson(person) {
  posStore.selectPerson(person);
  router.push("/confirm");
}

onMounted(() => {
  if (!posStore.product) {
    router.replace("/");
    return;
  }
  loadPeople();
});
</script>
