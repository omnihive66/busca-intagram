import Anthropic from "@anthropic-ai/sdk";
import type { Property } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function fetchImageBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  } catch {
    return null;
  }
}

function extractJson(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("JSON não encontrado na resposta");
  return JSON.parse(match[0]);
}

export async function describeProperty(
  imageUrl: string,
  caption: string,
  instagram: string,
  retries = 3
): Promise<Omit<Property, "id" | "instagram" | "url_imagem" | "imagens" | "legenda_original" | "data" | "likes" | "url_post" | "catalogado_em">> {
  const fallback = {
    titulo: "Imóvel disponível",
    categoria: "Outros" as const,
    descricao: caption.slice(0, 200) || "Consulte-nos para mais informações.",
    destaques: "Consulte condições",
    status: "À venda" as const,
    preco: null,
    quartos: null,
    bairro: null,
    contato: null,
  };

  const imgB64 = await fetchImageBase64(imageUrl);
  if (!imgB64) return fallback;

  const prompt = `Você é um especialista em descrição de imóveis para sites imobiliários brasileiros.

Analise a imagem e a legenda abaixo e retorne APENAS um JSON válido:
{
  "titulo": "título atraente (máx 60 caracteres)",
  "categoria": "Casa | Apartamento | Terreno | Lote | Comercial | Outros",
  "descricao": "descrição profissional e atraente (2-3 frases)",
  "destaques": "3 características principais separadas por vírgula",
  "status": "À venda | Para alugar | Vendido | Indisponível",
  "preco": "valor se mencionado ex: R$ 450.000 (ou null)",
  "quartos": número de quartos se mencionado (ou null),
  "bairro": "bairro/cidade se mencionado (ou null)",
  "contato": "telefone ou WhatsApp se houver (ou null)"
}

Legenda: ${caption.slice(0, 500) || "Sem legenda"}

Retorne SOMENTE o JSON.`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/jpeg", data: imgB64 },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const parsed = extractJson(text);

      return {
        titulo: String(parsed.titulo || fallback.titulo),
        categoria: (parsed.categoria as Property["categoria"]) || "Outros",
        descricao: String(parsed.descricao || fallback.descricao),
        destaques: String(parsed.destaques || fallback.destaques),
        status: (parsed.status as Property["status"]) || "À venda",
        preco: parsed.preco ? String(parsed.preco) : null,
        quartos: typeof parsed.quartos === "number" ? parsed.quartos : null,
        bairro: parsed.bairro ? String(parsed.bairro) : null,
        contato: parsed.contato ? String(parsed.contato) : null,
      };
    } catch (err) {
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 2000));
      } else {
        console.error("Claude error after retries:", err);
        return fallback;
      }
    }
  }

  return fallback;
}
