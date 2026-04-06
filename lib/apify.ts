const APIFY_TOKEN = process.env.APIFY_API_KEY!;
const ACTOR_ID = "shu8hvrXbJbY3Eb9W";
const BASE = "https://api.apify.com/v2";

export interface InstagramPost {
  id: string;
  url_imagem: string;
  imagens: string[];
  legenda_original: string;
  data: string;
  likes: number;
  url_post: string;
}

interface ApifyInstagramItem {
  id?: string;
  displayUrl?: string;
  images?: string[];
  caption?: string;
  timestamp?: string;
  likesCount?: number;
  url?: string;
}

async function apifyFetch(path: string, options?: RequestInit) {
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}token=${APIFY_TOKEN}`;
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Apify API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function scrapeInstagram(
  username: string,
  maxPosts: number
): Promise<InstagramPost[]> {
  // 1. Inicia o run do ator
  const run = await apifyFetch(`/acts/${ACTOR_ID}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      directUrls: [`https://www.instagram.com/${username}/`],
      resultsType: "posts",
      resultsLimit: maxPosts,
    }),
  });

  const runId: string = run.data.id;
  const datasetId: string = run.data.defaultDatasetId;

  // 2. Aguarda conclusão (poll a cada 5s, máx 270s)
  const deadline = Date.now() + 270_000;
  let status = run.data.status as string;

  while (!["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
    if (Date.now() > deadline) throw new Error("Apify run timeout");
    await new Promise((r) => setTimeout(r, 5000));
    const runStatus = await apifyFetch(`/actor-runs/${runId}`);
    status = runStatus.data.status;
  }

  if (status !== "SUCCEEDED") throw new Error(`Apify run ${status}`);

  // 3. Busca os itens do dataset
  const dataset = await apifyFetch(
    `/datasets/${datasetId}/items?limit=${maxPosts}&clean=true`
  );

  const items: ApifyInstagramItem[] = Array.isArray(dataset) ? dataset : [];
  const posts: InstagramPost[] = [];

  for (const item of items) {
    const imagens: string[] =
      Array.isArray(item.images) && item.images.length > 0
        ? item.images
        : item.displayUrl
        ? [item.displayUrl]
        : [];

    if (imagens.length === 0) continue;

    posts.push({
      id: `${item.id || Date.now()}_${posts.length}`,
      url_imagem: imagens[0],
      imagens,
      legenda_original: item.caption || "",
      data: item.timestamp || "",
      likes: item.likesCount || 0,
      url_post: item.url || "",
    });
  }

  return posts;
}
