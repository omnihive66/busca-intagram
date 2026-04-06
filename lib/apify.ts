import { ApifyClient } from "apify-client";

const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

export interface InstagramPost {
  id: string;
  url_imagem: string;
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

export async function scrapeInstagram(
  username: string,
  maxPosts: number
): Promise<InstagramPost[]> {
  const run = await client.actor("shu8hvrXbJbY3Eb9W").call({
    directUrls: [`https://www.instagram.com/${username}/`],
    resultsType: "posts",
    resultsLimit: maxPosts,
  });

  const dataset = client.dataset(run.defaultDatasetId);
  const { items } = await dataset.listItems({ limit: maxPosts });

  const posts: InstagramPost[] = [];

  for (const raw of items) {
    const item = raw as ApifyInstagramItem;

    const images: string[] =
      Array.isArray(item.images) && item.images.length > 0
        ? item.images
        : item.displayUrl
        ? [item.displayUrl]
        : [];

    for (const imgUrl of images) {
      posts.push({
        id: `${item.id || Date.now()}_${posts.length}`,
        url_imagem: imgUrl,
        legenda_original: item.caption || "",
        data: item.timestamp || "",
        likes: item.likesCount || 0,
        url_post: item.url || "",
      });
    }
  }

  return posts;
}
