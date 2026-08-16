/** Base de texto do catálogo: comparar palavras e ler números
 *  do jeito que fornecedor e oficina escrevem na vida real. */

const ACENTUADOS = "áàâãäåéèêëíìîïóòôõöúùûüçñýÿ";
const SEM_ACENTO = "aaaaaaeeeeiiiiooooouuuucnyy";

const MAPA = new Map();
for (let i = 0; i < ACENTUADOS.length; i++) {
  MAPA.set(ACENTUADOS[i], SEM_ACENTO[i]);
  MAPA.set(ACENTUADOS[i].toUpperCase(), SEM_ACENTO[i]);
}

/** Minúsculas sem acento, letra por letra — o texto sai com o mesmo
 *  tamanho da origem, e é isso que deixa o realce da busca cair na
 *  posição certa mesmo em "MOLA PARABÓLICA". */
export const dobrar = (s) =>
  String(s ?? "")
    .replace(/[^\x00-\x7F]/g, (c) => MAPA.get(c) ?? c)
    .toLowerCase();

/** Só letras e números: faz "AB-12/3" casar com "ab123". */
export const compactar = (s) => dobrar(s).replace(/[^a-z0-9]/g, "");

/** Espaços de sobra, quebras de linha e espaço fino do PDF viram um espaço só. */
export const limpar = (s) =>
  String(s ?? "")
    .replace(/[\s   ]+/g, " ")
    .trim();

/**
 * Lê um número escrito de qualquer jeito: 1234.56, "1.234,56", "R$ 1.234,56",
 * "1.234" (mil duzentos e trinta e quatro), "(45,90)" negativo de planilha.
 * Devolve null quando não há número nenhum ali.
 */
export function numero(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  const bruto = String(v).trim();
  if (!bruto || !/\d/.test(bruto)) return null;

  // "RD-1001" e "12 UN" têm dígito mas não são valor: o que tem letra
  // sobrando é código ou unidade, e confundir os dois estraga o catálogo.
  const semMoeda = bruto.replace(/r\$|us\$|\$|€/gi, "");
  if (/[a-zA-Z]/.test(semMoeda)) return null;

  const negativo = /^\s*[-(]/.test(semMoeda);
  let s = semMoeda.replace(/[^\d.,]/g, "");
  if (!s || !/\d/.test(s)) return null;

  const virgulas = (s.match(/,/g) || []).length;
  const pontos = (s.match(/\./g) || []).length;

  if (virgulas && pontos) {
    // o último separador que aparece é o decimal: 1.234,56 ou 1,234.56
    const decimal = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const milhar = decimal === "," ? "." : ",";
    s = s.split(milhar).join("").replace(decimal, ".");
  } else if (virgulas) {
    // uma vírgula com até dois dígitos é decimal; o resto é separador de milhar
    s = virgulas === 1 && /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.split(",").join("");
  } else if (pontos) {
    // "1.234" e "12.345.678" são milhares; "1.5" e "10.90" são decimais
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.split(".").join("");
    else if (pontos > 1) s = s.split(".").join("");
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negativo ? -Math.abs(n) : n;
}

/** Dinheiro com dois decimais: planilha traz coisas como 54.890000000000004. */
export const centavos = (v) => (v == null ? null : Math.round(v * 100) / 100);
