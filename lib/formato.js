/** Como os números e as listas aparecem na tela e no arquivo exportado. */

export const moeda = (v) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const data = (iso) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";

export const abaixoDoMinimo = (p) => Number(p.minimo) > 0 && Number(p.quantidade) <= Number(p.minimo);

/** A lista na ordem em que a oficina espera ver: pela descrição da peça. */
export const ordenar = (pecas) =>
  [...pecas].sort((a, b) => (a.descricao || "").localeCompare(b.descricao || "", "pt-BR"));

const COLUNAS_CSV = [
  ["codigo", "Código"],
  ["descricao", "Peça"],
  ["aplicacao", "Aplicação"],
  ["marca", "Marca"],
  ["categoria", "Categoria"],
  ["unidade", "Unidade"],
  ["fornecedor", "Fornecedor"],
  ["local", "Prateleira"],
  ["quantidade", "Quantidade"],
  ["minimo", "Mínimo"],
  ["custo", "Custo"],
  ["preco", "Venda"],
];

const NUMERICAS = new Set(["quantidade", "minimo", "custo", "preco"]);

/** CSV que o Excel em português abre com um duplo clique: ponto e vírgula
 *  entre as colunas, vírgula decimal e BOM para o acento não virar símbolo. */
export function paraCsv(pecas) {
  const campo = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const numerico = (v) => String(Number(v) || 0).replace(".", ",");

  const linhas = [COLUNAS_CSV.map(([, titulo]) => campo(titulo)).join(";")];
  for (const p of pecas) {
    linhas.push(
      COLUNAS_CSV.map(([chave]) => (NUMERICAS.has(chave) ? numerico(p[chave]) : campo(p[chave]))).join(";")
    );
  }
  return "\uFEFF" + linhas.join("\r\n");
}
