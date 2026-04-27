<template>
  <section class="page">
    <h2>Vaheta parooli</h2>
    <p>Muuda admin parooli siin.</p>

    <section class="panel">
      <h3>Admin parool</h3>

      <form class="form-grid" @submit.prevent="submitPasswordChange">
        <label>
          Praegune parool
          <input v-model="form.current_password" type="password" required />
        </label>

        <label>
          Uus parool
          <input v-model="form.new_password" type="password" required />
        </label>

        <label>
          Korda uut parooli
          <input v-model="form.confirm_password" type="password" required />
        </label>

        <div class="actions" style="align-items: end;">
          <button type="submit" :disabled="saving">
            {{ saving ? "Salvestan..." : "Muuda parool" }}
          </button>
        </div>
      </form>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="message" class="success">{{ message }}</p>
    </section>
  </section>
</template>

<script setup>
import { reactive, ref } from "vue";
import { apiFetchAdmin, updateAdminAuthPassword } from "../../api/client";

const saving = ref(false);
const error = ref("");
const message = ref("");

const form = reactive({
  current_password: "",
  new_password: "",
  confirm_password: ""
});

async function submitPasswordChange() {
  error.value = "";
  message.value = "";

  if (form.new_password !== form.confirm_password) {
    error.value = "Uus parool ja kordus ei kattu.";
    return;
  }

  saving.value = true;
  try {
    await apiFetchAdmin("/admin/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        current_password: form.current_password,
        new_password: form.new_password,
        confirm_password: form.confirm_password
      })
    });

    updateAdminAuthPassword(form.new_password);
    form.current_password = "";
    form.new_password = "";
    form.confirm_password = "";
    message.value = "Admin parool uuendatud.";
  } catch (err) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
}
</script>
