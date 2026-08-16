import { limpar } from "@/lib/texto";

/** Um .docx é um zip com um XML dentro. Abrimos o zip, lemos as tabelas
 *  do documento e, se não houver tabela nenhuma, caímos nos parágrafos —
 *  tem fornecedor que manda o catálogo alinhado com tabulação. */

const buscar = (no, tag) => Array.from(no.getElementsByTagName(tag));

const texto = (no) => limpar(buscar(no, "w:t").reduce((s, t) => s + t.textContent, ""));

/** Parágrafo com tabulação: cada tabulação separa uma coluna. */
function paragrafoEmColunas(paragrafo) {
  const partes = [];
  let atual = "";

  for (const no of buscar(paragrafo, "*")) {
    if (no.tagName === "w:tab") {
      partes.push(limpar(atual));
      atual = "";
    } else if (no.tagName === "w:t") {
      atual += no.textContent;
    }
  }
  partes.push(limpar(atual));

  return partes.some(Boolean) ? partes : [];
}

export async function lerDocx(arquivo) {
  const { unzipSync, strFromU8 } = await import("fflate");

  const zip = unzipSync(new Uint8Array(await arquivo.arrayBuffer()));
  const documento = zip["word/document.xml"];
  if (!documento) throw new Error("Este arquivo .docx está sem o conteúdo do documento.");

  const xml = new DOMParser().parseFromString(strFromU8(documento), "application/xml");
  const linhas = [];
  const tabelas = buscar(xml, "w:tbl");

  for (const tabela of tabelas) {
    for (const linha of buscar(tabela, "w:tr")) {
      const celulas = buscar(linha, "w:tc").map(texto);
      if (celulas.some(Boolean)) linhas.push(celulas);
    }
  }

  if (!linhas.length) {
    for (const paragrafo of buscar(xml, "w:p")) {
      const colunas = paragrafoEmColunas(paragrafo);
      if (colunas.length) linhas.push(colunas);
    }
  }

  if (!linhas.length) throw new Error("Não encontrei texto nenhum neste documento do Word.");

  return {
    linhas,
    detalhe: tabelas.length
      ? `${tabelas.length} tabela${tabelas.length > 1 ? "s" : ""}`
      : "texto corrido",
  };
}
