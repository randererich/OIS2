<template>
  <section class="page">
    <h2>Vali inimene</h2>

    <p class="inline-summary">
      {{ posStore.quantity }} {{ posStore.product?.unit || 'tk' }} x {{ productName }} = {{ money(posStore.total) }}.
    </p>

    <div class="actions">
      <button type="button" @click="router.push('/quantity')">Tagasi</button>
    </div>

    <label>
      Otsi nime
      <input ref="searchInput" v-model="search" placeholder="Sisesta nimi" autofocus />
    </label>

    <p v-if="loading">Laen inimesi...</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <section v-else>
      <section v-if="recentBuyers.length" class="panel">
        <h3>Viimase 20 minuti ostjad</h3>
        <table>
          <thead>
            <tr>
              <th>Nimi</th>
              <th>Konvent</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="person in recentBuyers"
              :key="`recent-${person.id}`"
              class="clickable"
              @click="selectPerson(person)"
            >
              <td style="text-align: center">{{ person.first_name }} {{ person.last_name }}</td>
              <td style="text-align: center">{{ person.konvent || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <h3>Kõik inimesed</h3>
      <table>
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
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { apiFetch } from "../api/client";
import { usePosStore } from "../stores/posStore";

const router = useRouter();
const posStore = usePosStore();

const search = ref("");
const searchInput = ref(null);
const people = ref([]);
const recentBuyers = ref([]);
const loading = ref(false);
const error = ref("");
const productName = computed(() => {
  if (posStore.product?.unit === "cl" && !posStore.product?.cash_operation) {
    return `${posStore.product.name} (1 cl)`;
  }
  return posStore.product?.name || "";
});

function money(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function parseCoetusParts(coetus) {
  const raw = String(coetus || "");
  const match = raw.match(/^(\d{4})\/(I|II)$/);
  if (!match) {
    return { valid: false, year: 0, sem: 0 };
  }

  return {
    valid: true,
    year: Number.parseInt(match[1], 10),
    sem: match[2] === "II" ? 2 : 1
  };
}

function compareCoetusDesc(a, b) {
  const pa = parseCoetusParts(a);
  const pb = parseCoetusParts(b);

  if (pa.valid !== pb.valid) {
    return pa.valid ? -1 : 1;
  }
  if (pa.year !== pb.year) {
    return pb.year - pa.year;
  }
  if (pa.sem !== pb.sem) {
    return pb.sem - pa.sem;
  }
  return String(a || "").localeCompare(String(b || ""), "et");
}

const filteredPeople = computed(() => {
  const term = search.value.trim().toLowerCase();
  if (!term) {
    return people.value;
  }

  return people.value.filter((person) => {
    const firstName = String(person.first_name || "").toLowerCase();
    const lastName = String(person.last_name || "").toLowerCase();
    const fullName = `${person.first_name} ${person.last_name}`.toLowerCase();
    return (
      firstName.includes(term) ||
      lastName.includes(term) ||
      fullName.includes(term) ||
      String(person.coetus || "").toLowerCase().includes(term) ||
      String(person.konvent || "").toLowerCase().includes(term)
    );
  });
});

const groupedPeople = computed(() => {
  const sorted = [...filteredPeople.value].sort((a, b) => {
    const coetusCmp = compareCoetusDesc(a.coetus, b.coetus);
    if (coetusCmp !== 0) {
      return coetusCmp;
    }

    const aSort = Number(a.sort_order || 0);
    const bSort = Number(b.sort_order || 0);
    if (aSort !== bSort) {
      return aSort - bSort;
    }

    return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, "et");
  });

  const map = new Map();
  for (const person of sorted) {
    const key = person.coetus || "Määramata";
    if (!map.has(key)) {
      map.set(key, { coetus: key, people: [] });
    }
    map.get(key).people.push(person);
  }

  return Array.from(map.values());
});

async function loadPeople() {
  loading.value = true;
  error.value = "";
  try {
    const [peopleData, recentData] = await Promise.all([
      apiFetch("/people/visible"),
      apiFetch("/people/recent-buyers?minutes=20")
    ]);
    people.value = peopleData;
    recentBuyers.value = recentData;
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

function goBack() {
  router.push("/quantity");
}

function selectFirstFilteredPerson() {
  const first = filteredPeople.value[0];
  if (first) {
    selectPerson(first);
  }
}

function handleKeydown(event) {
  if (event.isComposing) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    goBack();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    selectFirstFilteredPerson();
  }
}

onMounted(() => {
  if (!posStore.product) {
    router.replace("/");
    return;
  }

  nextTick(() => {
    searchInput.value?.focus();
  });

  window.addEventListener("keydown", handleKeydown);
  loadPeople();
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>
