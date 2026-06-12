// Influencer Factory — Backend
// Upload this to GitHub → deploy on Railway
// Add ANTHROPIC_API_KEY and JWT_SECRET in Railway Variables tab

import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
app.use(express.json());
app.use(cors());

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const JWT_SECRET    = process.env.JWT_SECRET || "change-me";
const PORT          = process.env.PORT || 3001;

// In-memory store — swap for PostgreSQL later if needed
const users    = new Map();
const personas = new Map();
const posts    = new Map();

// ── Signup ────────────────────────────────────────────────────────────────────
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)   return res.status(400).json({ error: "Email and password required" });
  if (password.length < 6)   return res.status(400).json({ error: "Password must be at least 6 characters" });
  if (users.has(email))      return res.status(409).json({ error: "Account already exists" });
  const hash = await bcrypt.hash(password, 10);
  users.set(email, { email, hash });
  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, email });
});

// ── Login ─────────────────────────────────────────────────────────────────────
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = users.get(email);
  if (!user) return res.status(401).json({ error: "No account found with this email" });
  const valid = await bcrypt.compare(password, user.hash);
  if (!valid) return res.status(401).json({ error: "Wrong password" });
  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, email });
});

// ── Auth middleware ───────────────────────────────────────────────────────────
function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: "Not logged in" });
  try { req.user = jwt.verify(h.replace("Bearer ", ""), JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Session expired" }); }
}

// ── Generic Claude proxy — used by all 4 agents ───────────────────────────────
app.post("/api/claude", auth, async (req, res) => {
  const { system, user, maxTokens = 1500 } = req.body;
  if (!system || !user) return res.status(400).json({ error: "system and user required" });
  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }]
    });
    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
    res.json({ text });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Generate tweets — YOUR Anthropic key, clients never see it ────────────────
app.post("/api/generate", auth, async (req, res) => {
  const { personaId } = req.body;
  const persona = personas.get(personaId);
  if (!persona || persona.userEmail !== req.user.email)
    return res.status(404).json({ error: "Persona not found" });

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: "You are a ghostwriter. Output ONLY a JSON array starting with [ and ending with ]. No markdown, no explanation.",
      messages: [{
        role: "user",
        content: `Write 5 tweets for ${persona.name} who posts about ${persona.niche} with a ${persona.tone || "conversational"} tone.${persona.bio ? " Bio: " + persona.bio : ""}
Rules: under 280 chars each, 1-2 hashtags, sound human not AI, punchy and engaging.
Return: [{"text":"tweet content here"}]`
      }]
    });

    const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("");
    const s = raw.indexOf("["), e = raw.lastIndexOf("]");
    if (s === -1 || e === -1) throw new Error("Failed to parse tweets");
    const tweets = JSON.parse(raw.slice(s, e + 1));

    const saved = tweets.map((t, i) => {
      const id = Date.now() + "-" + i;
      const post = {
        id, personaId, personaName: persona.name,
        personaHandle: persona.xHandle || "",
        text: t.text, status: "pending",
        createdAt: new Date().toISOString(),
        userEmail: req.user.email
      };
      posts.set(id, post);
      return post;
    });

    res.json({ posts: saved });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Personas ──────────────────────────────────────────────────────────────────
app.get("/personas", auth, (req, res) => {
  res.json([...personas.values()].filter(p => p.userEmail === req.user.email));
});
app.post("/personas", auth, (req, res) => {
  const id = Date.now().toString();
  const p = { id, userEmail: req.user.email, ...req.body };
  personas.set(id, p);
  res.json(p);
});
app.put("/personas/:id", auth, (req, res) => {
  const p = personas.get(req.params.id);
  if (!p || p.userEmail !== req.user.email) return res.status(404).json({ error: "Not found" });
  const updated = { ...p, ...req.body };
  personas.set(req.params.id, updated);
  res.json(updated);
});
app.delete("/personas/:id", auth, (req, res) => {
  const p = personas.get(req.params.id);
  if (!p || p.userEmail !== req.user.email) return res.status(404).json({ error: "Not found" });
  personas.delete(req.params.id);
  res.json({ ok: true });
});

// ── Posts ─────────────────────────────────────────────────────────────────────
app.get("/posts", auth, (req, res) => {
  const mine = [...posts.values()].filter(p => p.userEmail === req.user.email);
  res.json(mine.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});
app.put("/posts/:id", auth, (req, res) => {
  const post = posts.get(req.params.id);
  if (!post || post.userEmail !== req.user.email) return res.status(404).json({ error: "Not found" });
  const updated = { ...post, ...req.body };
  posts.set(req.params.id, updated);
  res.json(updated);
});
app.delete("/posts/:id", auth, (req, res) => {
  const post = posts.get(req.params.id);
  if (!post || post.userEmail !== req.user.email) return res.status(404).json({ error: "Not found" });
  posts.delete(req.params.id);
  res.json({ ok: true });
});

app.get("/health", (_, res) => res.json({ ok: true, users: users.size }));
app.get("/", (_, res) => res.json({ service: "Influencer Factory API", status: "ok" }));

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Anthropic key: ${ANTHROPIC_KEY ? "OK" : "MISSING — add ANTHROPIC_API_KEY in env"}`);
  });
}

export default app;
