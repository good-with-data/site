/**
 * index.js
 *
 * Express API server for the GWD chatbot.
 * Routes:
 *   POST /chat    — RAG lookup + MistralAI chat completion
 *   POST /contact — validate input + send contact emails
 */

import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import { Mistral } from "@mistralai/mistralai";
import { getContext } from "./rag.js";
import { sendContactEmails } from "./email.js";

const app = express();
const PORT = process.env.PORT || 3000;

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json({ limit: "16kb" }));

// CORS — only allow the Hugo site and local dev
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:1313")
  .split(",")
  .map((o) => o.trim());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Rate limiting — 20 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in a minute." },
});
app.use(limiter);

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a helpful assistant for Good With Data CIC, a non-profit community interest company established in 2023 that provides data-focused consultancy to NGOs and the charity sector, based in the UK (Brighton, London, Manchester).

Answer questions only using the context provided below. If the answer is not in the context, say you don't know and suggest the user contact the team directly at hello@goodwithdata.org.uk. Do not invent or assume information about the company.

Keep answers concise and friendly.`;

// ── POST /chat ────────────────────────────────────────────────────────────────
app.post("/chat", async (req, res) => {
  const { message, history } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }
  if (message.length > 500) {
    return res.status(400).json({ error: "message too long (max 500 characters)" });
  }
  if (!Array.isArray(history)) {
    return res.status(400).json({ error: "history must be an array" });
  }
  // Cap history to last 10 turns to limit token usage
  const trimmedHistory = history.slice(-10);

  try {
    // RAG: find the most relevant knowledge chunks for this message
    const context = await getContext(message);

    const systemMessage = context
      ? `${SYSTEM_PROMPT}\n\n--- CONTEXT ---\n${context}\n--- END CONTEXT ---`
      : SYSTEM_PROMPT;

    const messages = [
      { role: "system", content: systemMessage },
      ...trimmedHistory,
      { role: "user", content: message },
    ];

    const response = await mistral.chat.complete({
      model: "mistral-small-latest",
      messages,
      temperature: 0.3,
      maxTokens: 512,
    });

    const reply = response.choices[0].message.content;
    res.json({ reply });

  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// ── POST /contact ─────────────────────────────────────────────────────────────
app.post("/contact", async (req, res) => {
  const { name, email, message } = req.body;

  // Validate
  if (!name || typeof name !== "string" || name.trim().length < 1) {
    return res.status(400).json({ error: "name is required" });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "a valid email address is required" });
  }
  if (!message || typeof message !== "string" || message.trim().length < 1) {
    return res.status(400).json({ error: "message is required" });
  }
  if (name.length > 100 || email.length > 200 || message.length > 2000) {
    return res.status(400).json({ error: "input too long" });
  }

  try {
    await sendContactEmails({
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Email error:", err.message);
    res.status(500).json({ error: "Failed to send email. Please try hello@goodwithdata.org.uk directly." });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`GWD chatbot API running on http://localhost:${PORT}`);
  if (!process.env.MISTRAL_API_KEY) {
    console.warn("WARNING: MISTRAL_API_KEY is not set");
  }
});
