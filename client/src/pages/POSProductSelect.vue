<template>
  <section class="page">
    <h2>Vali toode</h2>

    <p v-if="loading">Laen tooteid...</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <div v-else class="menu-columns">
      <div>
        <ProductCategoryTable
          v-for="category in leftColumn"
          :key="category.id"
          :category="category"
          @select="selectProduct"
        />
      </div>
      <div>
        <ProductCategoryTable
          v-for="category in rightColumn"
          :key="category.id"
          :category="category"
          @select="selectProduct"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { apiFetch } from "../api/client";
import ProductCategoryTable from "../components/ProductCategoryTable.vue";
import { usePosStore } from "../stores/posStore";

const router = useRouter();
const posStore = usePosStore();

const loading = ref(false);
const error = ref("");
const categories = ref([]);

const leftColumn = computed(() => categories.value.filter((_, index) => index % 2 === 0));
const rightColumn = computed(() => categories.value.filter((_, index) => index % 2 === 1));

async function loadMenu() {
  loading.value = true;
  error.value = "";
  try {
    categories.value = await apiFetch("/products/menu");
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function selectProduct(product) {
  posStore.selectProduct(product);
  router.push("/quantity");
}

onMounted(loadMenu);
</script>
