/** Porta de entrada do catálogo: o fornecedor manda o que tem, e aqui
 *  cada formato vira a mesma coisa — uma lista de linhas de tabela.
 *  Quem entende de peça é o lib/catalogo.js; aqui só se lê arquivo. */

const PLANILHA = ["xlsx", "xlsm", "xlsb", "xls", "ods", "csv", "tsv", "txt", "htm", "html"];

/** O que o seletor de arquivo aceita. */
export const FORMATOS =
  ".xlsx,.xlsm,.xlsb,.xls,.ods,.csv,.tsv,.txt,.pdf,.docx,.htm,.html," +
  "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const FORMATOS_HUMANOS = "Excel, CSV, PDF, Word (.docx), OpenDocument ou texto";

/** Formatos que não dá para abrir no navegador, com a saída para cada um. */
const RECUSADOS = {
  doc: "O .doc é o Word antigo e vem embaralhado. Abra no Word e salve como .docx ou PDF — leva dez segundos.",
  rtf: "RTF não traz a tabela de forma confiável. Salve como .docx, PDF ou Excel.",
  jpg: "Foto de catálogo é imagem, não texto. Peça o arquivo original em PDF ou Excel.",
  jpeg: "Foto de catálogo é imagem, não texto. Peça o arquivo original em PDF ou Excel.",
  png: "Foto de catálogo é imagem, não texto. Peça o arquivo original em PDF ou Excel.",
  zip: "Descompacte o arquivo e mande a planilha ou o PDF de dentro dele.",
};

export const extensaoDe = (nome) => String(nome).toLowerCase().split(".").pop() || "";

/** O nome do arquivo costuma ser o melhor palpite de fornecedor:
 *  "Tabela Randon 2026 - final.xlsx" → "Randon". */
export function fornecedorDoNome(nome) {
  const semExtensao = String(nome).replace(/\.[^.]+$/, "");
  const limpo = semExtensao
    .replace(/[_-]+/g, " ")
    .replace(
      /\b(tabela|lista|catalogo|catálogo|precos|preços|preco|preço|de|do|da|atualizada?|nova|final|copia|cópia|v\d+|rev\d*)\b/gi,
      " "
    )
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return limpo.slice(0, 40);
}

/** Lê o arquivo e devolve { linhas, formato, detalhe }. */
export async function extrair(arquivo) {
  const extensao = extensaoDe(arquivo.name);

  if (RECUSADOS[extensao]) throw new Error(RECUSADOS[extensao]);

  if (PLANILHA.includes(extensao)) {
    const { lerPlanilha } = await import("@/lib/extrair/planilha");
    return { ...(await lerPlanilha(arquivo, extensao)), formato: extensao.toUpperCase() };
  }

  if (extensao === "pdf") {
    const { lerPdf } = await import("@/lib/extrair/pdf");
    return { ...(await lerPdf(arquivo)), formato: "PDF" };
  }

  if (extensao === "docx") {
    const { lerDocx } = await import("@/lib/extrair/docx");
    return { ...(await lerDocx(arquivo)), formato: "Word" };
  }

  throw new Error(`Não sei ler arquivo .${extensao}. Aceito ${FORMATOS_HUMANOS}.`);
}
