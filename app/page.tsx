"use client";

import { useState, useEffect, useRef } from "react";
import type { Property } from "@/types";

type ProgressEvent =
  | { type: "status"; message: string; step: number; total_steps: number }
  | { type: "progress"; processed: number; total: number; message: string }
  | { type: "done"; message: string; total: number; new_count: number }
  | { type: "error"; message: string };

const CATEGORIES = ["Todos", "Casa", "Apartamento", "Terreno", "Lote", "Comercial", "Outros"];
const STATUSES = ["Todos", "À venda", "Para alugar", "Vendido", "Indisponível"];

export default function Home() {
  const [accounts, setAccounts] = useState<string[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("todos");
  const [filterCategory, setFilterCategory] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [search, setSearch] = useState("");
  const [newInstagram, setNewInstagram] = useState("");
  const [maxPosts, setMaxPosts] = useState(50);
  const [scraping, setScraping] = useState(false);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [view, setView] = useState<"grid" | "table">("grid");
  const [activeTab, setActiveTab] = useState<"catalog" | "accounts">("catalog");
  const abortRef = useRef<AbortController | null>(null);

  // Extrai só o username de URL completa ou @usuario
  function parseUsername(input: string): string {
    const clean = input.trim().replace(/^@/, "");
    // ex: https://www.instagram.com/ricardoeadaocorretores/
    const match = clean.match(/instagram\.com\/([^/?#]+)/);
    return match ? match[1] : clean;
  }

  useEffect(() => {
    fetchAccounts();
    fetchProperties();
  }, []);

  async function fetchAccounts() {
    const res = await fetch("/api/catalog?accounts=true");
    const data = await res.json();
    setAccounts(data.accounts || []);
  }

  async function fetchProperties(instagram?: string) {
    const url = instagram && instagram !== "todos"
      ? `/api/catalog?instagram=${instagram}`
      : "/api/catalog";
    const res = await fetch(url);
    const data = await res.json();
    setProperties(data.properties || []);
  }

  useEffect(() => {
    fetchProperties(selectedAccount);
  }, [selectedAccount]);

  async function startScrape() {
    if (!newInstagram.trim()) return;
    const username = parseUsername(newInstagram);
    setNewInstagram(username);
    setScraping(true);
    setProgress({ type: "status", message: "Iniciando...", step: 1, total_steps: 3 });
    setProgressPercent(0);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagram: username, maxPosts }),
        signal: abortRef.current.signal,
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const event: ProgressEvent = JSON.parse(line.slice(6));
            setProgress(event);

            if (event.type === "progress") {
              setProgressPercent(Math.round((event.processed / event.total) * 100));
            }
            if (event.type === "done") {
              setProgressPercent(100);
              await fetchAccounts();
              await fetchProperties(selectedAccount);
              setNewInstagram("");
              setTimeout(() => {
                setScraping(false);
                setProgress(null);
                setProgressPercent(0);
              }, 3000);
            }
            if (event.type === "error") {
              setTimeout(() => {
                setScraping(false);
                setProgress(null);
              }, 4000);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setProgress({ type: "error", message: String(err) });
        setTimeout(() => { setScraping(false); setProgress(null); }, 4000);
      } else {
        setScraping(false);
        setProgress(null);
      }
    }
  }

  async function deleteAccount(instagram: string) {
    if (!confirm(`Remover @${instagram} e todos seus imóveis?`)) return;
    await fetch("/api/catalog", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instagram }),
    });
    await fetchAccounts();
    if (selectedAccount === instagram) {
      setSelectedAccount("todos");
    } else {
      await fetchProperties(selectedAccount);
    }
  }

  function exportData(format: "csv" | "json") {
    const base = "/api/export?format=" + format;
    const url = selectedAccount !== "todos"
      ? base + "&instagram=" + selectedAccount
      : base;
    window.open(url, "_blank");
  }

  const filtered = properties.filter((p) => {
    if (filterCategory !== "Todos" && p.categoria !== filterCategory) return false;
    if (filterStatus !== "Todos" && p.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.titulo?.toLowerCase().includes(q) ||
        p.descricao?.toLowerCase().includes(q) ||
        p.bairro?.toLowerCase().includes(q) ||
        p.legenda_original?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const statusColor: Record<string, string> = {
    "À venda": "bg-green-100 text-green-800",
    "Para alugar": "bg-blue-100 text-blue-800",
    "Vendido": "bg-gray-100 text-gray-600",
    "Indisponível": "bg-red-100 text-red-700",
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sky-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">🏠</span>
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-lg leading-none">Catalogador de Imóveis</h1>
              <p className="text-slate-500 text-xs mt-0.5">Instagram → Catálogo IA</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportData("csv")}
              className="text-sm px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
            >
              ⬇ CSV
            </button>
            <button
              onClick={() => exportData("json")}
              className="text-sm px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
            >
              ⬇ JSON
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Scrape Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Raspar novo Instagram</h2>
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-sky-500">
                <span className="px-3 text-slate-400 text-sm">@</span>
                <input
                  type="text"
                  placeholder="perfil_do_instagram"
                  value={newInstagram}
                  onChange={(e) => setNewInstagram(e.target.value)}
                  disabled={scraping}
                  onKeyDown={(e) => e.key === "Enter" && !scraping && startScrape()}
                  className="flex-1 py-2.5 pr-3 text-sm outline-none bg-transparent"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600 whitespace-nowrap">Máx. posts:</label>
              <input
                type="number"
                min={5}
                max={300}
                value={maxPosts}
                onChange={(e) => setMaxPosts(Number(e.target.value))}
                disabled={scraping}
                className="w-20 border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
            <button
              onClick={startScrape}
              disabled={scraping || !newInstagram.trim()}
              className="px-5 py-2.5 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {scraping ? "Raspando..." : "▶ Iniciar"}
            </button>
            {scraping && (
              <button
                onClick={() => abortRef.current?.abort()}
                className="px-4 py-2.5 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50"
              >
                ✕ Cancelar
              </button>
            )}
          </div>

          {/* Progress */}
          {progress && (
            <div className="mt-4 space-y-2">
              <div className={`text-sm px-3 py-2 rounded-lg ${
                progress.type === "error"
                  ? "bg-red-50 text-red-700"
                  : progress.type === "done"
                  ? "bg-green-50 text-green-700"
                  : "bg-sky-50 text-sky-700"
              }`}>
                {progress.message}
              </div>
              {progress.type === "progress" && (
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab("catalog")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "catalog"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Catálogo ({properties.length})
          </button>
          <button
            onClick={() => setActiveTab("accounts")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "accounts"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Contas ({accounts.length})
          </button>
        </div>

        {activeTab === "accounts" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-4">Perfis cadastrados</h2>
            {accounts.length === 0 ? (
              <p className="text-slate-500 text-sm">Nenhum perfil ainda. Raspe um Instagram acima.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {accounts.map((acc) => (
                  <div
                    key={acc}
                    className="flex items-center justify-between p-3 border border-slate-200 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-slate-800 text-sm">@{acc}</p>
                      <p className="text-xs text-slate-500">
                        {properties.filter((p) => p.instagram === acc).length} imóveis
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setSelectedAccount(acc);
                          setActiveTab("catalog");
                        }}
                        className="px-2 py-1 text-xs border border-sky-200 text-sky-600 rounded hover:bg-sky-50"
                      >
                        Ver
                      </button>
                      <button
                        onClick={() => { setNewInstagram(acc); startScrape(); }}
                        className="px-2 py-1 text-xs border border-slate-200 text-slate-600 rounded hover:bg-slate-50"
                        title="Atualizar"
                      >
                        ↺
                      </button>
                      <button
                        onClick={() => deleteAccount(acc)}
                        className="px-2 py-1 text-xs border border-red-200 text-red-500 rounded hover:bg-red-50"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "catalog" && (
          <>
            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <input
                  type="text"
                  placeholder="Buscar por título, bairro..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="todos">Todos os perfis</option>
                  {accounts.map((a) => (
                    <option key={a} value={a}>@{a}</option>
                  ))}
                </select>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
                <div className="flex border border-slate-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setView("grid")}
                    className={`px-3 py-2 text-sm ${view === "grid" ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                  >
                    ⊞
                  </button>
                  <button
                    onClick={() => setView("table")}
                    className={`px-3 py-2 text-sm ${view === "table" ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                  >
                    ☰
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">{filtered.length} imóveis encontrados</p>
            </div>

            {/* Grid View */}
            {view === "grid" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((p) => (
                  <div key={p.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                    <div className="aspect-video bg-slate-100 relative overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url_imagem_blob || p.url_imagem}
                        alt={p.titulo}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div className="absolute top-2 left-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[p.status] || "bg-slate-100 text-slate-600"}`}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                    <div className="p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="font-semibold text-slate-900 text-sm leading-tight line-clamp-2">{p.titulo}</h3>
                        <span className="text-xs text-slate-400 whitespace-nowrap">@{p.instagram}</span>
                      </div>
                      {p.preco && (
                        <p className="text-sky-700 font-bold text-sm">{p.preco}</p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {p.categoria}
                        </span>
                        {p.quartos && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {p.quartos} qts
                          </span>
                        )}
                        {p.bairro && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                            📍 {p.bairro}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">{p.descricao}</p>
                      {p.contato && (
                        <p className="text-xs text-green-700">📞 {p.contato}</p>
                      )}
                      <a
                        href={p.url_post}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center text-xs text-sky-600 border border-sky-200 rounded-lg py-1 hover:bg-sky-50 mt-1"
                      >
                        Ver no Instagram ↗
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Table View */}
            {view === "table" && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {["Título", "Categoria", "Status", "Preço", "Quartos", "Bairro", "Contato", "Perfil", ""].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="font-medium text-slate-900 truncate">{p.titulo}</p>
                          <p className="text-xs text-slate-400 truncate">{p.descricao}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{p.categoria}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[p.status] || ""}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sky-700 font-medium whitespace-nowrap">{p.preco || "—"}</td>
                        <td className="px-4 py-3 text-slate-600 text-center">{p.quartos || "—"}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{p.bairro || "—"}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{p.contato || "—"}</td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">@{p.instagram}</td>
                        <td className="px-4 py-3">
                          <a
                            href={p.url_post}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-sky-600 hover:underline whitespace-nowrap"
                          >
                            Ver ↗
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <p className="text-2xl mb-2">🏠</p>
                    <p>Nenhum imóvel encontrado</p>
                  </div>
                )}
              </div>
            )}

            {filtered.length === 0 && properties.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <p className="text-4xl mb-3">📷</p>
                <p className="text-lg font-medium text-slate-600">Nenhum imóvel ainda</p>
                <p className="text-sm mt-1">Adicione um perfil do Instagram acima para começar</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
