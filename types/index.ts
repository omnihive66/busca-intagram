export interface Property {
  id: string;
  instagram: string;
  titulo: string;
  categoria: "Casa" | "Apartamento" | "Terreno" | "Lote" | "Comercial" | "Outros";
  descricao: string;
  destaques: string;
  status: "À venda" | "Para alugar" | "Vendido" | "Indisponível";
  preco: string | null;
  quartos: number | null;
  bairro: string | null;
  contato: string | null;
  url_imagem: string;
  url_imagem_blob?: string;
  legenda_original: string;
  data: string;
  likes: number;
  url_post: string;
  catalogado_em: string;
}

export interface ScrapeJob {
  id: string;
  instagram: string;
  status: "running" | "completed" | "error";
  total: number;
  processed: number;
  started_at: string;
  completed_at?: string;
  error?: string;
}

export interface Catalog {
  instagram: string;
  updated_at: string;
  total: number;
  properties: Property[];
}
