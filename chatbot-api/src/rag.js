/**
 * rag.js
 *
 * Loads the pre-embedded knowledge base and finds the most relevant
 * chunks for a given user query using cosine similarity.
 */

import { Mistral } from "@mistralai/mistralai";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

// Load knowledge base once at startup
const knowledgePath = join(__dirname, "../knowledge/content.json");
let knowledgeBase = [];

try {
  knowledgeBase = JSON.parse(readFileSync(knowledgePath, "utf-8"));
  console.log(`Loaded ${knowledgeBase.length} knowledge chunks`);
} catch {
  console.error(
    "ERROR: knowledge/content.json not found.\n" +
    "Run `npm run build-index` to generate it."
  );
}

// ── Cosine similarity ─────────────────────────────────────────────────────
function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ── Main export ───────────────────────────────────────────────────────────
/**
 * Finds the top-k most relevant knowledge chunks for a query.
 * Returns them as a single concatenated context string.
 *
 * @param {string} query  - the user's message
 * @param {number} topK   - number of chunks to return (default 3)
 * @returns {string}      - context string to inject into the system prompt
 */
export async function getContext(query, topK = 3) {
  if (knowledgeBase.length === 0) {
    return "";
  }

  // Embed the user's query
  const response = await client.embeddings.create({
    model: "mistral-embed",
    inputs: [query],
  });
  const queryEmbedding = response.data[0].embedding;

  // Score every chunk
  const scored = knowledgeBase.map((chunk) => ({
    text: chunk.text,
    source: chunk.source,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  // Take the top-k
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topK);

  return top.map((c) => `[${c.source}]\n${c.text}`).join("\n\n---\n\n");
}
