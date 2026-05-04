<template>
  <div class="app">
    <header>
      <div class="header-top">
        <button class="dark-toggle" :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggleDark">
          {{ isDark ? '☀️' : '🌙' }}
        </button>
      </div>

      <nav v-if="!isAdminRoute">
        <RouterLink to="/">Pane kirja</RouterLink>
        <RouterLink to="/debts">Võlad</RouterLink>
        <RouterLink to="/purchases">Kirjed</RouterLink>
        <RouterLink to="/stats">Statistika</RouterLink>
        <RouterLink to="/inventory">Inventuur</RouterLink>
        <RouterLink to="/admin">Admin</RouterLink>
      </nav>

      <nav v-else>
        <RouterLink to="/">Tagasi tavavaatesse</RouterLink>
        <RouterLink to="/admin/products">Tooted</RouterLink>
        <RouterLink to="/admin/categories">Kategooriad</RouterLink>
        <RouterLink to="/admin/people">Inimesed</RouterLink>
        <RouterLink to="/admin/inventory">Varud / Inventuur</RouterLink>
        <RouterLink to="/admin/purchases">Kirjed (admin)</RouterLink>
        <RouterLink to="/admin/password">Vaheta parooli</RouterLink>
      </nav>
    </header>

    <main>
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { RouterLink, RouterView } from "vue-router";

const route = useRoute();
const isAdminRoute = computed(() => route.path.startsWith("/admin"));

const isDark = ref(false);

function applyTheme(dark) {
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

function toggleDark() {
  isDark.value = !isDark.value;
  localStorage.setItem("theme", isDark.value ? "dark" : "light");
  applyTheme(isDark.value);
}

onMounted(() => {
  const saved = localStorage.getItem("theme");
  isDark.value = saved === "dark";
  applyTheme(isDark.value);
});
</script>

<style scoped>
.header-top {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.dark-toggle {
  position: absolute;
  top: 4px;
  right: 0;
  font-size: 1.3rem;
  padding: 4px 8px;
  border: 1px solid var(--btn-border);
  background: var(--btn-bg);
  cursor: pointer;
  line-height: 1;
}
</style>
