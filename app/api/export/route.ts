import { NextRequest, NextResponse } from "next/server";
import { loadAllCatalogs, loadCatalog } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "json";
  const instagram = searchParams.get("instagram");

  const properties = instagram
    ? await loadCatalog(instagram)
    : await loadAllCatalogs();

  if (format === "csv") {
    const fields = [
      "id", "instagram", "titulo", "categoria", "status", "preco",
      "quartos", "bairro", "descricao", "destaques", "contato",
      "url_imagem", "url_post", "data", "likes", "catalogado_em",
    ];
    const header = fields.join(",");
    const rows = properties.map((p) =>
      fields.map((f) => {
        const val = (p as unknown as Record<string, unknown>)[f];
        if (val === null || val === undefined) return "";
        const str = String(val).replace(/"/g, '""');
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str}"`
          : str;
      }).join(",")
    );
    const csv = [header, ...rows].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="catalogo_imoveis.csv"`,
      },
    });
  }

  return new Response(JSON.stringify({ properties, total: properties.length }, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="catalogo_imoveis.json"`,
    },
  });
}
