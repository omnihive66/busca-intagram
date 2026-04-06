import type { Property, ScrapeJob } from "@/types";
import fs from "fs";
import path from "path";

// Importação estática — Next.js exige isso para resolver o módulo no build
// Em dev (sem BLOB_READ_WRITE_TOKEN) as funções do blob nunca são chamadas
import { put, list, del } from "@vercel/blob";

const IS_LOCAL = !process.env.BLOB_READ_WRITE_TOKEN;

async function blobFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
}

// ─── LOCAL FILESYSTEM (dev) ────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), ".local-data");
const CATALOGS_DIR = path.join(DATA_DIR, "catalogs");
const JOBS_DIR = path.join(DATA_DIR, "jobs");

function ensureDirs() {
  [DATA_DIR, CATALOGS_DIR, JOBS_DIR].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

// ─── CATÁLOGOS ─────────────────────────────────────────────────────────────

export async function saveCatalog(instagram: string, properties: Property[]) {
  const catalog = {
    instagram,
    updated_at: new Date().toISOString(),
    total: properties.length,
    properties,
  };
  const json = JSON.stringify(catalog, null, 2);

  if (IS_LOCAL) {
    ensureDirs();
    fs.writeFileSync(path.join(CATALOGS_DIR, `${instagram}.json`), json, "utf-8");
    return;
  }

  return put(`catalogs/${instagram}.json`, json, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    access: "private" as any,
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

export async function loadCatalog(instagram: string): Promise<Property[]> {
  try {
    if (IS_LOCAL) {
      ensureDirs();
      const file = path.join(CATALOGS_DIR, `${instagram}.json`);
      if (!fs.existsSync(file)) return [];
      const data = JSON.parse(fs.readFileSync(file, "utf-8"));
      return data.properties || [];
    }

    const { blobs } = await list({ prefix: `catalogs/${instagram}.json` });
    if (!blobs.length) return [];
    const res = await blobFetch(blobs[0].url);
    const data = await res.json();
    return data.properties || [];
  } catch {
    return [];
  }
}

export async function loadAllCatalogs(): Promise<Property[]> {
  try {
    if (IS_LOCAL) {
      ensureDirs();
      const files = fs.readdirSync(CATALOGS_DIR).filter((f) => f.endsWith(".json"));
      const all: Property[] = [];
      for (const file of files) {
        const data = JSON.parse(fs.readFileSync(path.join(CATALOGS_DIR, file), "utf-8"));
        if (data.properties) all.push(...data.properties);
      }
      return all;
    }

    const { blobs } = await list({ prefix: "catalogs/" });
    const all: Property[] = [];
    for (const blob of blobs) {
      const res = await blobFetch(blob.url);
      const data = await res.json();
      if (data.properties) all.push(...data.properties);
    }
    return all;
  } catch {
    return [];
  }
}

// ─── JOBS ──────────────────────────────────────────────────────────────────

export async function saveJob(job: ScrapeJob) {
  const json = JSON.stringify(job, null, 2);

  if (IS_LOCAL) {
    ensureDirs();
    fs.writeFileSync(path.join(JOBS_DIR, `${job.id}.json`), json, "utf-8");
    return;
  }

  return put(`jobs/${job.id}.json`, json, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    access: "private" as any,
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

export async function loadJob(jobId: string): Promise<ScrapeJob | null> {
  try {
    if (IS_LOCAL) {
      ensureDirs();
      const file = path.join(JOBS_DIR, `${jobId}.json`);
      if (!fs.existsSync(file)) return null;
      return JSON.parse(fs.readFileSync(file, "utf-8"));
    }

    const { blobs } = await list({ prefix: `jobs/${jobId}.json` });
    if (!blobs.length) return null;
    const res = await blobFetch(blobs[0].url);
    return await res.json();
  } catch {
    return null;
  }
}

// ─── CONTAS ────────────────────────────────────────────────────────────────

export async function listInstagramAccounts(): Promise<string[]> {
  if (IS_LOCAL) {
    ensureDirs();
    return fs
      .readdirSync(CATALOGS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  }

  const { blobs } = await list({ prefix: "catalogs/" });
  return blobs
    .map((b) => b.pathname.replace("catalogs/", "").replace(".json", ""))
    .filter(Boolean);
}

export async function deleteAccount(instagram: string) {
  if (IS_LOCAL) {
    ensureDirs();
    const file = path.join(CATALOGS_DIR, `${instagram}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return;
  }

  const { blobs } = await list({ prefix: `catalogs/${instagram}.json` });
  for (const b of blobs) await del(b.url);
}
