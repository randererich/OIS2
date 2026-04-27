<template>
  <div class="app">
    <header>
      <h1>Konvent POS</h1>

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
import { computed } from "vue";
import { useRoute } from "vue-router";
import { RouterLink, RouterView } from "vue-router";

const route = useRoute();
const isAdminRoute = computed(() => route.path.startsWith("/admin"));
</script>
