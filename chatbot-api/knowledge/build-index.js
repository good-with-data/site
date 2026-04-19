/**
 * build-index.js
 *
 * Reads GWD content files, splits them into chunks, calls the MistralAI
 * embeddings API, and writes the result to knowledge/content.json.
 *
 * Run this whenever site content changes:
 *   node knowledge/build-index.js
 */

import "dotenv/config";
import { Mistral } from "@mistralai/mistralai";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

// ── Content sources ─────────────────────────────────────────────────────────
// Paths are relative to the repo root (site/)
const CONTENT_FILES = [
  { path: "../../content/who_we_are.md", label: "About Good With Data CIC" },
  { path: "../../content/what_we_do.md", label: "Our Projects & Partners" },
  { path: "../../content/_index.md",     label: "Homepage" },
];

// Optional: add a hidden FAQ file for chatbot-only knowledge
// { path: "../content/chatbot-faq.md", label: "FAQ" },

// ── Chunking ─────────────────────────────────────────────────────────────────
// Split text into overlapping chunks of ~500 characters.
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 80;

function stripFrontmatter(text) {
  return text.replace(/^---[\s\S]*?---\s*/m, "").trim();
}

function chunkText(text, label) {
  const clean = stripFrontmatter(text);
  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_SIZE, clean.length);
    const chunk = clean.slice(start, end).trim();
    if (chunk.length > 20) {
      chunks.push({ text: chunk, source: label });
    }
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function buildIndex() {
  if (!process.env.MISTRAL_API_KEY) {
    console.error("ERROR: MISTRAL_API_KEY is not set in .env");
    process.exit(1);
  }

  console.log("Reading content files...");
  const allChunks = [];

  for (const { path, label } of CONTENT_FILES) {
    const fullPath = join(__dirname, path);
    let text;
    try {
      text = readFileSync(fullPath, "utf-8");
    } catch {
      console.warn(`WARN: Could not read ${fullPath} — skipping`);
      continue;
    }
    const chunks = chunkText(text, label);
    console.log(`  ${label}: ${chunks.length} chunks`);
    allChunks.push(...chunks);
  }

  console.log(`\nEmbedding ${allChunks.length} chunks via MistralAI...`);

  // Embed in batches of 10 to stay within API limits
  const BATCH_SIZE = 10;
  const results = [];

  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    const response = await client.embeddings.create({
      model: "mistral-embed",
      inputs: batch.map((c) => c.text),
    });
    for (let j = 0; j < batch.length; j++) {
      results.push({
        text: batch[j].text,
        source: batch[j].source,
        embedding: response.data[j].embedding,
      });
    }
    console.log(`  Embedded ${Math.min(i + BATCH_SIZE, allChunks.length)}/${allChunks.length}`);
  }

  const outPath = join(__dirname, "content.json");
  writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nDone. Wrote ${results.length} chunks to knowledge/content.json`);
}

buildIndex().catch((err) => {
  console.error("Build failed:", err.message);
  process.exit(1);
});
