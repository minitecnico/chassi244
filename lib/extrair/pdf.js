import { limpar } from "@/lib/texto";

/** PDF não tem tabela: tem pedaços de texto soltos com uma coordenada cada.
 *  A tabela do catálogo é reconstruída aqui, em três passos —
 *  juntar pedaços em linhas, juntar pedaços vizinhos em células,
 *  e descobrir onde ficam as colunas olhando a página inteira. */

/** Pedaços na mesma altura formam uma linha. */
function agruparEmLinhas(itens) {
  const ordenados = [...itens].sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas = [];

  for (const item of ordenados) {
    const atual = linhas[linhas.length - 1];
    const tolerancia = Math.max(2, item.altura * 0.5);
    if (atual && Math.abs(atual.y - item.y) <= tolerancia) atual.itens.push(item);
    else linhas.push({ y: item.y, itens: [item] });
  }

  for (const linha of linhas) linha.itens.sort((a, b) => a.x - b.x);
  return linhas;
}

/** Dentro da linha, pedaços quase colados são a mesma célula.
 *  O espaço largo é que separa uma coluna da outra. */
function juntarEmCelulas(itens) {
  const celulas = [];

  for (const item of itens) {
    const texto = limpar(item.texto);
    if (!texto) continue;

    const atual = celulas[celulas.length - 1];
    const folga = Math.max(item.altura * 0.7, 3);
    if (atual && item.x - atual.x1 <= folga) {
      atual.texto += (item.x - atual.x1 > item.altura * 0.2 ? " " : "") + texto;
      atual.x1 = item.x + item.largura;
    } else {
      celulas.push({ texto, x0: item.x, x1: item.x + item.largura });
    }
  }

  return celulas;
}

/** As colunas da página são as faixas horizontais onde as células caem.
 *  Só linhas com duas células ou mais entram nessa conta: um título como
 *  "TABELA DE PREÇOS 2026" atravessa o começo de duas colunas e, se contasse,
 *  grudaria as duas numa coluna só. Célula larguíssima também fica de fora. */
function descobrirColunas(linhas, largura) {
  const estreitas = linhas
    .filter((celulas) => celulas.length > 1)
    .flat()
    .filter((c) => c.x1 - c.x0 < largura * 0.6)
    .sort((a, b) => a.x0 - b.x0);

  const colunas = [];
  for (const c of estreitas) {
    const atual = colunas[colunas.length - 1];
    if (atual && c.x0 <= atual.x1) atual.x1 = Math.max(atual.x1, c.x1);
    else colunas.push({ x0: c.x0, x1: c.x1 });
  }
  return colunas;
}

/** Cada célula vai para a coluna com a qual ela mais se sobrepõe. */
function encaixar(celula, colunas) {
  let melhor = 0;
  let indice = 0;
  colunas.forEach((coluna, i) => {
    const sobreposicao = Math.min(celula.x1, coluna.x1) - Math.max(celula.x0, coluna.x0);
    if (sobreposicao > melhor) {
      melhor = sobreposicao;
      indice = i;
    }
  });
  return indice;
}

/** Os pedaços de texto de uma página viram linhas de tabela.
 *  Função pura de propósito: é o miolo que dá para testar sem abrir um PDF. */
export function montarTabela(itens, largura = 600) {
  if (!itens.length) return [];

  const linhas = agruparEmLinhas(itens);
  const porLinha = linhas.map((l) => juntarEmCelulas(l.itens)).filter((c) => c.length);
  const colunas = descobrirColunas(porLinha, largura);
  if (colunas.length < 2) return porLinha.map((celulas) => celulas.map((c) => c.texto));

  return porLinha.map((celulas) => {
    const linha = new Array(colunas.length).fill("");
    for (const celula of celulas) {
      const i = encaixar(celula, colunas);
      linha[i] = linha[i] ? `${linha[i]} ${celula.texto}` : celula.texto;
    }
    return linha;
  });
}

/** O worker é copiado para `public/` pelo scripts/copiar-worker.mjs, que roda
 *  depois de cada `npm install`. Endereço fixo em vez de mágica de bundler:
 *  se faltar, o erro aparece na hora e não numa tela em branco. */
const WORKER = "/pdf.worker.min.mjs";

let pdfjs = null;

async function carregarPdfjs() {
  if (!pdfjs) {
    pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = WORKER;
  }
  return pdfjs;
}

export async function lerPdf(arquivo) {
  const pdfjs = await carregarPdfjs();
  const documento = await pdfjs.getDocument({
    data: await arquivo.arrayBuffer(),
    isEvalSupported: false,
  }).promise;

  const paginas = documento.numPages;
  const linhas = [];
  let caracteres = 0;

  for (let n = 1; n <= paginas; n++) {
    const pagina = await documento.getPage(n);
    const conteudo = await pagina.getTextContent();
    const largura = pagina.view[2] - pagina.view[0];

    const itens = conteudo.items
      .filter((i) => i.str && i.str.trim())
      .map((i) => ({
        texto: i.str,
        x: i.transform[4],
        y: i.transform[5],
        largura: i.width,
        altura: Math.abs(i.transform[3]) || i.height || 10,
      }));

    caracteres += itens.reduce((s, i) => s + i.texto.length, 0);
    linhas.push(...montarTabela(itens, largura));
  }

  documento.destroy();

  if (caracteres < 20) {
    throw new Error(
      "Este PDF não tem texto — é a imagem de um papel escaneado. " +
        "Peça o arquivo original ao fornecedor, ou passe o PDF por um leitor de texto antes."
    );
  }

  return { linhas, detalhe: `${paginas} página${paginas > 1 ? "s" : ""}` };
}
