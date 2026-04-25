const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000/api";

const REGULAR_AUTH_KEY = "konvent-pos-auth";
const ADMIN_AUTH_KEY = "konvent-pos-admin-auth";

function readOrPromptAuth(authKey, usernamePrompt, passwordPrompt) {
  let auth = localStorage.getItem(authKey);

  if (!auth) {
    const username = window.prompt(usernamePrompt, "");
    const password = window.prompt(passwordPrompt, "");

    if (!username || !password) {
      throw new Error("Username and password are required");
    }

    auth = `Basic ${btoa(`${username}:${password}`)}`;
    localStorage.setItem(authKey, auth);
  }

  return auth;
}

async function doFetch(path, options = {}, authKey, prompts) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: readOrPromptAuth(authKey, prompts.user, prompts.pass),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    localStorage.removeItem(authKey);
    throw new Error("Authentication failed. Please try again.");
  }

  if (response.status === 204) {
    return null;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

export function apiFetch(path, options = {}) {
  return doFetch(path, options, REGULAR_AUTH_KEY, {
    user: "Konvent POS kasutajanimi:",
    pass: "Konvent POS parool:"
  });
}

export function apiFetchAdmin(path, options = {}) {
  return doFetch(path, options, ADMIN_AUTH_KEY, {
    user: "Admin kasutajanimi:",
    pass: "Admin parool:"
  });
}

export async function ensureAdminAuth() {
  await apiFetchAdmin("/admin/health");
}

export function clearAdminAuth() {
  localStorage.removeItem(ADMIN_AUTH_KEY);
}
