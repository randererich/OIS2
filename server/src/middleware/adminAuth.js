function unauthorized(res) {
  res.set("WWW-Authenticate", 'Basic realm="Konvent POS Admin"');
  return res.status(401).json({ error: "Unauthorized" });
}

export function adminAuth(req, res, next) {
  if (req.method === "OPTIONS") {
    return next();
  }

  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return res.status(500).json({ error: "Admin auth is not configured" });
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith("Basic ")) {
    return unauthorized(res);
  }

  const base64 = header.slice(6).trim();
  const decoded = Buffer.from(base64, "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");

  if (separatorIndex === -1) {
    return unauthorized(res);
  }

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  if (username !== expectedUsername || password !== expectedPassword) {
    return unauthorized(res);
  }

  return next();
}
