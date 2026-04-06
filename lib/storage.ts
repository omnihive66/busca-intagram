import type { Property, ScrapeJob } from "@/types";

// Em dev (sem BLOB_READ_WRITE_TOKEN) usa arquivos locais em /data
// Em produção usa Vercel Blob automaticamente
const IS_LOCAL = !process.env.BLOB_READ_WRITE_TOKEN;

// ─── LOCAL FILESYSTEM (dev) ────────────────────────────────────────────────

import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".local-data");
const CATALOGS_DIR = path.join(DATA_DIR, "catalogs");
const JOBS_DIR = path.join(DATA_DIR, "jobs");

function ensureDirs() {
  [DATA_DIR, CATALOGS_DIR, JOBS_DIR].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

// ─── VERCEL BLOB (produção) ────────────────────────────────────────────────

async function blobPut(key: string, data: string) {
  const { put } = await import("@vercel/blob");
  return put(key, data, {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

async function blobList(prefix: string) {
  const { list } = await import("@vercel/blob");
  return list({ prefix });
}

async function blobDel(url: string) {
  const { del } = await import("@vercel/blob");
  return del(url);
}

// ─── API PÚBLICA ───────────────────────────────────────────────────────────

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

  return blobPut(`catalogs/${instagram}.json`, json);
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

    const { blobs } = await blobList(`catalogs/${instagram}.json`);
    if (!blobs.length) return [];
    const res = await fetch(blobs[0].url);
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

    const { blobs } = await blobList("catalogs/");
    const all: Property[] = [];
    for (const blob of blobs) {
      const res = await fetch(blob.url);
      const data = await res.json();
      if (data.properties) all.push(...data.properties);
    }
    return all;
  } catch {
    return [];
  }
}

export async function saveJob(job: ScrapeJob) {
  const json = JSON.stringify(job, null, 2);

  if (IS_LOCAL) {
    ensureDirs();
    fs.writeFileSync(path.join(JOBS_DIR, `${job.id}.json`), json, "utf-8");
    return;
  }

  return blobPut(`jobs/${job.id}.json`, json);
}

export async function loadJob(jobId: string): Promise<ScrapeJob | null> {
  try {
    if (IS_LOCAL) {
      ensureDirs();
      const file = path.join(JOBS_DIR, `${jobId}.json`);
      if (!fs.existsSync(file)) return null;
      return JSON.parse(fs.readFileSync(file, "utf-8"));
    }

    const { blobs } = await blobList(`jobs/${jobId}.json`);
    if (!blobs.length) return null;
    const res = await fetch(blobs[0].url);
    return await res.json();
  } catch {
    return null;
  }
}

export async function listInstagramAccounts(): Promise<string[]> {
  if (IS_LOCAL) {
    ensureDirs();
    return fs
      .readdirSync(CATALOGS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  }

  const { blobs } = await blobList("catalogs/");
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

  const { blobs } = await blobList(`catalogs/${instagram}.json`);
  for (const b of blobs) await blobDel(b.url);
}
