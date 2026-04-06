import { NextRequest } from "next/server";
import { scrapeInstagram } from "@/lib/apify";
import { describeProperty } from "@/lib/claude";
import { saveCatalog, loadCatalog } from "@/lib/storage";
import type { Property } from "@/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { instagram, maxPosts = 50 } = await req.json();

  if (!instagram) {
    return new Response(JSON.stringify({ error: "instagram é obrigatório" }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send({ type: "status", message: `🔍 Raspando @${instagram}...`, step: 1, total_steps: 3 });

        const posts = await scrapeInstagram(instagram, maxPosts);
        send({ type: "status", message: `✅ ${posts.length} posts encontrados`, step: 2, total_steps: 3 });

        const existingProperties = await loadCatalog(instagram);
        const existingIds = new Set(existingProperties.map((p) => p.id));

        const newPosts = posts.filter((p) => !existingIds.has(p.id));
        send({ type: "status", message: `🆕 ${newPosts.length} novos imóveis para processar`, step: 2, total_steps: 3 });

        const properties: Property[] = [...existingProperties];
        let processed = 0;

        for (const post of newPosts) {
          send({
            type: "progress",
            processed: ++processed,
            total: newPosts.length,
            message: `🤖 Descrevendo imóvel ${processed}/${newPosts.length}...`,
          });

          const description = await describeProperty(post.url_imagem, post.legenda_original, instagram);

          properties.push({
            id: post.id,
            instagram,
            url_imagem: post.url_imagem,
            imagens: post.imagens,
            legenda_original: post.legenda_original,
            data: post.data,
            likes: post.likes,
            url_post: post.url_post,
            catalogado_em: new Date().toISOString(),
            ...description,
          });

          // Salva a cada 10 para não perder progresso
          if (processed % 10 === 0) {
            await saveCatalog(instagram, properties);
          }

          await new Promise((r) => setTimeout(r, 300));
        }

        await saveCatalog(instagram, properties);

        send({
          type: "done",
          message: `✅ Catálogo atualizado! ${properties.length} imóveis no total.`,
          total: properties.length,
          new_count: newPosts.length,
        });
      } catch (error) {
        send({ type: "error", message: String(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
