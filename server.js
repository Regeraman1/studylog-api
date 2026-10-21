// StudyLog API: a small REST API for logging study sessions.
const http = require("node:http");
const { randomUUID } = require("node:crypto");

const PORT = Number(process.env.PORT) || 4000;
const API_KEY = process.env.STUDYLOG_API_KEY || "local-dev-key";
const MAX_MINUTES = 600;

const sessions = new Map();

function send(res, status, body) {
  if (body === undefined) {
    res.writeHead(status);
    return res.end();
  }
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Body must be valid JSON"));
      }
    });
  });
}

// partial = true for PATCH, where every field is optional.
function validate(input, partial = false) {
  const errors = [];
  const has = (k) => input[k] !== undefined;

  if (!partial || has("subject")) {
    if (typeof input.subject !== "string" || input.subject.trim() === "") {
      errors.push("subject must be a non-empty string");
    }
  }
  if (!partial || has("minutes")) {
    if (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > MAX_MINUTES) {
      errors.push(`minutes must be a whole number from 1 to ${MAX_MINUTES}`);
    }
  }
  if (!partial || has("date")) {
    const ok = typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date) &&
      !Number.isNaN(Date.parse(input.date + "T00:00:00Z")) &&
      new Date(input.date + "T00:00:00Z").toISOString().startsWith(input.date);
    if (!ok) errors.push("date must be a real date in YYYY-MM-DD format");
  }
  if (has("notes") && typeof input.notes !== "string") {
    errors.push("notes must be a string");
  }
  return errors;
}

function stats() {
  const bySubject = {};
  let totalMinutes = 0;
  for (const s of sessions.values()) {
    const key = s.subject.toLowerCase();
    bySubject[key] = (bySubject[key] || 0) + s.minutes;
    totalMinutes += s.minutes;
  }
  const top = Object.entries(bySubject).sort((a, b) => b[1] - a[1])[0];
  return {
    totalSessions: sessions.size,
    totalMinutes,
    minutesBySubject: bySubject,
    topSubject: top ? top[0] : null,
  };
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, { status: "ok" });
  }

  if (parts[0] !== "api") return send(res, 404, { error: "Route not found" });

  if (req.headers["x-api-key"] !== API_KEY) {
    return send(res, 401, { error: "Missing or invalid API key" });
  }

  if (parts[1] === "stats" && parts.length === 2 && req.method === "GET") {
    return send(res, 200, stats());
  }

  if (parts[1] !== "sessions" || parts.length > 3) {
    return send(res, 404, { error: "Route not found" });
  }

  const id = parts[2];

  if (!id && req.method === "GET") {
    const subject = url.searchParams.get("subject");
    let list = [...sessions.values()];
    if (subject) list = list.filter((s) => s.subject.toLowerCase() === subject.toLowerCase());
    list.sort((a, b) => b.date.localeCompare(a.date));
    return send(res, 200, list);
  }

  if (!id && req.method === "POST") {
    const body = await readJson(req);
    const errors = validate(body);
    if (errors.length) return send(res, 400, { error: "Validation failed", details: errors });
    const session = {
      id: randomUUID(),
      subject: body.subject.trim(),
      minutes: body.minutes,
      date: body.date,
      notes: body.notes ?? "",
      createdAt: new Date().toISOString(),
    };
    sessions.set(session.id, session);
    res.setHeader("Location", `/api/sessions/${session.id}`);
    return send(res, 201, session);
  }

  if (!id) return send(res, 405, { error: "Method not allowed" });

  const existing = sessions.get(id);
  if (!existing) return send(res, 404, { error: "Session not found" });

  if (req.method === "GET") return send(res, 200, existing);

  if (req.method === "PATCH") {
    const body = await readJson(req);
    const unknown = Object.keys(body).filter((k) => !["subject", "minutes", "date", "notes"].includes(k));
    const errors = validate(body, true);
    if (unknown.length) errors.push(`unknown fields: ${unknown.join(", ")}`);
    if (errors.length) return send(res, 400, { error: "Validation failed", details: errors });
    const updated = { ...existing, ...body };
    if (body.subject) updated.subject = body.subject.trim();
    sessions.set(id, updated);
    return send(res, 200, updated);
  }

  if (req.method === "DELETE") {
    sessions.delete(id);
    return send(res, 204);
  }

  return send(res, 405, { error: "Method not allowed" });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => send(res, 400, { error: err.message }));
});

server.listen(PORT, () => console.log(`StudyLog API listening on http://localhost:${PORT}`));
