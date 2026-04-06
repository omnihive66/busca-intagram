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

export async function scrapeInstagram(
  username: string,
  maxPosts: number
): Promise<InstagramPost[]> {
  const run = await client.actor("shu8hvrXbJbY3Eb9W").call({
    usernames: [username],
    resultsLimit: maxPosts,
  });

  const posts: InstagramPost[] = [];

  for await (const item of client.dataset(run.defaultDatasetId).iterateItems()) {
    const images: string[] = item.images?.length
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
