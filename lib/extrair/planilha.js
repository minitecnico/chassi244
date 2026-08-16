import { limpar } from "@/lib/texto";

/** Planilhas e texto separado: xlsx, xlsm, xls (o formato velho do Excel),
 *  ods do LibreOffice, csv, tsv, txt e até página HTML com tabela.
 *  Tudo isso é a mesma biblioteca — por isso mora num arquivo só. */

const TEXTO = ["csv", "tsv", "txt", "htm", "html"];

/** Planilha exportada de sistema antigo quase nunca vem em UTF-8. */
async function lerTexto(arquivo) {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  // o caractere de substituição denuncia que o arquivo era Windows-1252
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(bytes) : utf8;
}

/** Qual caractere separa as colunas: o que mais aparece nas primeiras linhas. */
function separador(texto) {
  const amostra = texto.split(/\r?\n/).slice(0, 10).join("\n");
  const candidatos = [";", ",", "\t", "|"];
  let escolhido = ",";
  let recorde = 0;
  for (const c of candidatos) {
    const vezes = amostra.split(c).length - 1;
    if (vezes > recorde) {
      recorde = vezes;
      escolhido = c;
    }
  }
  return escolhido;
}

/** Data vira dd/mm/aaaa; número continua número; o resto vira texto limpo. */
function celula(v) {
  if (v == null) return "";
  if (v instanceof Date) return v.toLocaleDateString("pt-BR");
  if (typeof v === "number") return String(v);
  return limpar(v);
}

export async function lerPlanilha(arquivo, extensao) {
  const XLSX = await import("xlsx");

  let livro;
  if (TEXTO.includes(extensao)) {
    const texto = await lerTexto(arquivo);
    const opcoes = { type: "string", raw: true };
    if (extensao !== "htm" && extensao !== "html") opcoes.FS = separador(texto);
    livro = XLSX.read(texto, opcoes);
  } else {
    livro = XLSX.read(await arquivo.arrayBuffer(), { type: "array", cellDates: true });
  }

  // Catálogo grande costuma vir dividido em abas por linha de produto:
  // lemos todas e deixamos a análise separar cabeçalho de dado.
  const linhas = [];
  for (const nome of livro.SheetNames) {
    const grade = XLSX.utils.sheet_to_json(livro.Sheets[nome], {
      header: 1,
      defval: "",
      raw: true,
      blankrows: false,
    });
    for (const linha of grade) linhas.push(linha.map(celula));
  }

  const abas = livro.SheetNames.length;
  return { linhas, detalhe: abas > 1 ? `${abas} abas lidas` : "" };
}
