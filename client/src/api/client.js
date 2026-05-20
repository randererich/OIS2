const API_BASE = import.meta.env.VITE_API_BASE || "/api";

const REGULAR_AUTH_COOKIE = "konvent_pos_auth";
const REGULAR_AUTH_TTL_SECONDS = 30 * 60;
let adminAuth = null;

function getCookie(name) {
  const prefix = `${name}=`;
  const parts = document.cookie.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(prefix));
  if (!match) {
    return "";
  }
  return decodeURIComponent(match.slice(prefix.length));
}

function setCookie(name, value, maxAgeSeconds) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

function clearCookie(name) {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function requestCredentials({ title, usernameLabel, passwordLabel, passwordOnly = false }) {
  return new Promise((resolve) => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = isDark ? "rgba(0, 0, 0, 0.68)" : "rgba(0, 0, 0, 0.45)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999";

    const panel = document.createElement("form");
    panel.style.background = isDark ? "var(--panel-bg)" : "#fff";
    panel.style.color = isDark ? "var(--text)" : "#1b1b1b";
    panel.style.border = isDark ? "1px solid var(--border)" : "none";
    panel.style.padding = "20px";
    panel.style.borderRadius = "10px";
    panel.style.minWidth = "320px";
    panel.style.maxWidth = "92vw";
    panel.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.2)";
    panel.style.display = "flex";
    panel.style.flexDirection = "column";
    panel.style.gap = "10px";

    const heading = document.createElement("h3");
    heading.textContent = title;
    heading.style.margin = "0 0 6px 0";
    heading.style.fontSize = "1.1rem";
    panel.appendChild(heading);

    const usernameInput = document.createElement("input");
    if (!passwordOnly) {
      const usernameText = document.createElement("label");
      usernameText.textContent = usernameLabel;
      usernameText.style.fontSize = "0.9rem";
      panel.appendChild(usernameText);

      usernameInput.type = "text";
      usernameInput.required = true;
      usernameInput.autocomplete = "username";
      panel.appendChild(usernameInput);
    }

    const passwordText = document.createElement("label");
    passwordText.textContent = passwordLabel;
    passwordText.style.fontSize = "0.9rem";
    panel.appendChild(passwordText);

    const passwordInput = document.createElement("input");
    passwordInput.type = "password";
    passwordInput.required = true;
    passwordInput.autocomplete = passwordOnly ? "current-password" : "off";
    panel.appendChild(passwordInput);

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";
    actions.style.gap = "8px";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Katkesta";

    const submitButton = document.createElement("button");
    submitButton.type = "submit";
    submitButton.textContent = "Sisene";

    actions.appendChild(cancelButton);
    actions.appendChild(submitButton);
    panel.appendChild(actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const cleanup = () => {
      overlay.remove();
    };

    cancelButton.addEventListener("click", () => {
      cleanup();
      resolve(null);
    });

    panel.addEventListener("submit", (event) => {
      event.preventDefault();
      cleanup();
      resolve({
        username: passwordOnly ? "" : usernameInput.value.trim(),
        password: passwordInput.value
      });
    });

    queueMicrotask(() => {
      if (passwordOnly) {
        passwordInput.focus();
      } else {
        usernameInput.focus();
      }
    });
  });
}

async function readOrPromptRegularAuth(usernamePrompt, passwordPrompt) {
  let auth = getCookie(REGULAR_AUTH_COOKIE);

  if (!auth) {
    const creds = await requestCredentials({
      title: "Konvent ÕIS autentimine",
      usernameLabel: usernamePrompt,
      passwordLabel: passwordPrompt,
      passwordOnly: false
    });

    if (!creds?.username || !creds?.password) {
      throw new Error("Username and password are required");
    }

    auth = `Basic ${btoa(`${creds.username}:${creds.password}`)}`;
    setCookie(REGULAR_AUTH_COOKIE, auth, REGULAR_AUTH_TTL_SECONDS);
  }

  return auth;
}

async function readOrPromptAdminAuth() {
  if (adminAuth) {
    return adminAuth;
  }

  const creds = await requestCredentials({
    title: "Admin autentimine",
    usernameLabel: "",
    passwordLabel: "Admin parool:",
    passwordOnly: true
  });

  if (!creds?.password) {
    throw new Error("Password is required");
  }

  adminAuth = `Basic ${btoa(`admin:${creds.password}`)}`;
  return adminAuth;
}

async function doFetch(path, options = {}, getAuth, onUnauthorized) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const headers = {
      "Content-Type": "application/json",
      Authorization: await getAuth(),
      ...(options.headers || {})
    };

    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers
      });
    } catch {
      throw new Error("Serveriga ei saa ühendust. Kontrolli, et API server töötab.");
    }

    if (response.status === 401) {
      onUnauthorized();
      if (attempt === 0) {
        continue;
      }
      throw new Error("Authentication failed. Please try again.");
    }

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    const rawBody = await response.text();

    let data = null;
    if (rawBody) {
      if (contentType.includes("application/json") || rawBody.startsWith("{") || rawBody.startsWith("[")) {
        try {
          data = JSON.parse(rawBody);
        } catch {
          data = rawBody;
        }
      } else {
        data = rawBody;
      }
    }

    if (!response.ok) {
      if (data && typeof data === "object" && data.error) {
        throw new Error(data.error);
      }

      if (typeof data === "string" && data.trim()) {
        if (data.trim().startsWith("<")) {
          throw new Error(`API server ei vasta korralikult (${response.status}). Kontrolli serveri ja nginx'i seadistust.`);
        }
        throw new Error(data.trim());
      }

      throw new Error(`Request failed (${response.status})`);
    }

    return data;
  }
}

export function apiFetch(path, options = {}) {
  return doFetch(
    path,
    options,
    () => readOrPromptRegularAuth("Konvent ÕIS kasutajanimi:", "Konvent ÕIS parool:"),
    () => {
      clearCookie(REGULAR_AUTH_COOKIE);
    }
  );
}

export function apiFetchAdmin(path, options = {}) {
  return doFetch(
    path,
    options,
    readOrPromptAdminAuth,
    () => {
      adminAuth = null;
    }
  );
}

export async function ensureAdminAuth() {
  await apiFetchAdmin("/admin/health");
}

export function clearAdminAuth() {
  adminAuth = null;
}

export function updateAdminAuthPassword(newPassword) {
  if (!newPassword) {
    return;
  }
  adminAuth = `Basic ${btoa(`admin:${newPassword}`)}`;
}
