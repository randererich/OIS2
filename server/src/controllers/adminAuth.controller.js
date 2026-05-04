import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const envFilePath = fileURLToPath(new URL("../../.env", import.meta.url));

function hasInvalidEnvChars(value) {
  return /[\r\n]/.test(value);
}

function upsertEnvValue(content, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${escapedKey}=.*$`, "m");

  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }

  if (!content.trim()) {
    return `${line}\n`;
  }

  return content.endsWith("\n")
    ? `${content}${line}\n`
    : `${content}\n${line}\n`;
}

export async function changeAdminPassword(req, res, next) {
  try {
    const { current_password, new_password, confirm_password } = req.body || {};

    if (!String(current_password || "")) {
      return res.status(400).json({ error: "current_password is required" });
    }

    if (!String(new_password || "")) {
      return res.status(400).json({ error: "new_password is required" });
    }

    if (String(new_password) !== String(confirm_password || "")) {
      return res.status(400).json({ error: "new_password and confirm_password must match" });
    }

    const expectedPassword = process.env.ADMIN_PASSWORD || "";
    if (String(current_password) !== expectedPassword) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    if (String(new_password) === expectedPassword) {
      return res.status(400).json({ error: "New password must be different" });
    }

    if (hasInvalidEnvChars(String(new_password))) {
      return res.status(400).json({ error: "new_password contains invalid characters" });
    }

    let existing = "";
    try {
      existing = await readFile(envFilePath, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
    const updated = upsertEnvValue(existing, "ADMIN_PASSWORD", String(new_password));
    await writeFile(envFilePath, updated, "utf8");

    process.env.ADMIN_PASSWORD = String(new_password);

    res.json({ ok: true, message: "Admin password updated" });
  } catch (error) {
    next(error);
  }
}