import { put, list, del } from "@vercel/blob";

const CATALOG_PREFIX = "catalogs/";
const JOBS_PREFIX = "jobs/";

export async function saveCatalog(instagram: string, properties: import("@/types").Property[]) {
  const catalog = {
    instagram,
    updated_at: new Date().toISOString(),
    total: properties.length,
    properties,
  };
  const blob = await put(
    `${CATALOG_PREFIX}${instagram}.json`,
    JSON.stringify(catalog),
    { access: "public", contentType: "application/json", addRandomSuffix: false }
  );
  return blob;
}

export async function loadCatalog(instagram: string): Promise<import("@/types").Property[]> {
  try {
    const { blobs } = await list({ prefix: `${CATALOG_PREFIX}${instagram}.json` });
    if (!blobs.length) return [];
    const res = await fetch(blobs[0].url);
    const data = await res.json();
    return data.properties || [];
  } catch {
    return [];
  }
}

export async function loadAllCatalogs(): Promise<import("@/types").Property[]> {
  try {
    const { blobs } = await list({ prefix: CATALOG_PREFIX });
    const all: import("@/types").Property[] = [];
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

export async function saveJob(job: import("@/types").ScrapeJob) {
  await put(
    `${JOBS_PREFIX}${job.id}.json`,
    JSON.stringify(job),
    { access: "public", contentType: "application/json", addRandomSuffix: false }
  );
}

export async function loadJob(jobId: string): Promise<import("@/types").ScrapeJob | null> {
  try {
    const { blobs } = await list({ prefix: `${JOBS_PREFIX}${jobId}.json` });
    if (!blobs.length) return null;
    const res = await fetch(blobs[0].url);
    return await res.json();
  } catch {
    return null;
  }
}

export async function listInstagramAccounts(): Promise<string[]> {
  const { blobs } = await list({ prefix: CATALOG_PREFIX });
  return blobs
    .map((b) => b.pathname.replace(CATALOG_PREFIX, "").replace(".json", ""))
    .filter(Boolean);
}

export async function deleteAccount(instagram: string) {
  const { blobs } = await list({ prefix: `${CATALOG_PREFIX}${instagram}.json` });
  for (const b of blobs) await del(b.url);
}
