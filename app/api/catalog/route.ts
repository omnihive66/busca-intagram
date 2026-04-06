import { NextRequest, NextResponse } from "next/server";
import { loadAllCatalogs, loadCatalog, listInstagramAccounts, deleteAccount } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const instagram = searchParams.get("instagram");
  const accountsOnly = searchParams.get("accounts") === "true";

  if (accountsOnly) {
    const accounts = await listInstagramAccounts();
    return NextResponse.json({ accounts });
  }

  const properties = instagram
    ? await loadCatalog(instagram)
    : await loadAllCatalogs();

  return NextResponse.json({ properties, total: properties.length });
}

export async function DELETE(req: NextRequest) {
  const { instagram } = await req.json();
  if (!instagram) return NextResponse.json({ error: "instagram é obrigatório" }, { status: 400 });
  await deleteAccount(instagram);
  return NextResponse.json({ ok: true });
}
