import { NextRequest } from "next/server";
import JSZip from "jszip";
import { loadAllCatalogs, loadCatalog } from "@/lib/storage";
import type { Property } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function buildDescricaoTxt(p: Property, index: number): string {
  const totalImagens = (p.imagens?.length) || 1;
  const lines = [
    `=== IMÓVEL ${String(index).padStart(3, "0")} ===`,
    ``,
    `Título:        ${p.titulo}`,
    `Categoria:     ${p.categoria}`,
    `Status:        ${p.status}`,
    `Preço:         ${p.preco || "Não informado"}`,
    `Quartos:       ${p.quartos ?? "Não informado"}`,
    `Bairro:        ${p.bairro || "Não informado"}`,
    `Contato:       ${p.contato || "Não informado"}`,
    `Fotos:         ${totalImagens} imagem(ns) nesta pasta`,
    ``,
    `Descrição:`,
    p.descricao,
    ``,
    `Destaques:`,
    p.destaques,
    ``,
    `--- Dados originais ---`,
    `Perfil Instagram: @${p.instagram}`,
    `Post:          ${p.url_post}`,
    `Likes:         ${p.likes}`,
    `Data post:     ${p.data ? new Date(p.data).toLocaleDateString("pt-BR") : "—"}`,
    `Catalogado em: ${new Date(p.catalogado_em).toLocaleString("pt-BR")}`,
    ``,
    `Legenda original:`,
    p.legenda_original || "(sem legenda)",
  ];
  return lines.join("\n");
}

function slugify(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function getExt(url: string): string {
  return url.match(/\.(jpg|jpeg|png|webp)/i)?.[1]?.toLowerCase() || "jpg";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const instagram = searchParams.get("instagram");

  const properties: Property[] = instagram
    ? await loadCatalog(instagram)
    : await loadAllCatalogs();

  if (properties.length === 0) {
    return new Response(JSON.stringify({ error: "Nenhum imóvel catalogado" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const zip = new JSZip();
  const raiz = zip.folder("catalogo_imoveis")!;

  // Índice geral na raiz
  raiz.file(
    "imoveis.json",
    JSON.stringify(
      { total: properties.length, gerado_em: new Date().toISOString(), imoveis: properties },
      null,
      2
    )
  );

  const csvFields: (keyof Property)[] = [
    "titulo", "categoria", "status", "preco", "quartos", "bairro",
    "contato", "descricao", "destaques", "instagram", "url_post",
    "likes", "data", "catalogado_em",
  ];
  const csvRows = properties.map((p) =>
    csvFields.map((f) => {
      const val = p[f];
      if (val === null || val === undefined) return "";
      const str = String(val).replace(/"/g, '""');
      return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
    }).join(",")
  );
  raiz.file("imoveis.csv", [csvFields.join(","), ...csvRows].join("\n"));

  // Uma pasta por imóvel (carrossel)
  for (let i = 0; i < properties.length; i++) {
    const p = properties[i];
    const num = String(i + 1).padStart(3, "0");
    const slug = slugify(p.titulo);
    const folderName = `${num}_${slug}`;
    const pasta = raiz.folder(folderName)!;

    // Descrição do imóvel
    pasta.file("descricao.txt", buildDescricaoTxt(p, i + 1));

    // Todas as imagens do carrossel
    const urls: string[] = p.imagens?.length
      ? p.imagens
      : [p.url_imagem_blob || p.url_imagem];

    for (let j = 0; j < urls.length; j++) {
      const buffer = await fetchImageBuffer(urls[j]);
      if (buffer) {
        const ext = getExt(urls[j]);
        pasta.file(`imagem_${String(j + 1).padStart(2, "0")}.${ext}`, buffer);
      }
    }
  }

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const filename = instagram
    ? `catalogo_${instagram}.zip`
    : `catalogo_imoveis_completo.zip`;

  return new Response(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(zipBuffer.length),
    },
  });
}
