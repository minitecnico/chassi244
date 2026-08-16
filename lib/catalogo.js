import { dobrar, limpar, numero, centavos } from "@/lib/texto";

/** O que fazer com um monte de linhas soltas para virar catálogo de peças.
 *  Nenhum fornecedor manda a planilha do mesmo jeito, então aqui a gente
 *  descobre o cabeçalho, entende o nome das colunas, e quando não há nome
 *  nenhum, adivinha pelo conteúdo. O que a gente adivinhou aparece na tela
 *  para você conferir antes de gravar. */

export const CAMPOS = [
  { id: "codigo", rotulo: "Código" },
  { id: "descricao", rotulo: "Descrição", obrigatorio: true },
  { id: "aplicacao", rotulo: "Aplicação" },
  { id: "marca", rotulo: "Marca" },
  { id: "categoria", rotulo: "Categoria" },
  { id: "unidade", rotulo: "Unidade" },
  { id: "fornecedor", rotulo: "Fornecedor" },
  { id: "custo", rotulo: "Custo" },
  { id: "preco", rotulo: "Preço de venda" },
];

const APELIDOS = {
  codigo: ["codigo", "cod", "ref", "referencia", "sku", "part number", "partnumber", "pn", "item n"],
  descricao: [
    "descricao", "produto", "peca", "denominacao", "discriminacao", "material",
    "especificacao", "nome", "mercadoria",
  ],
  aplicacao: ["aplicacao", "modelo", "veiculo", "chassi", "montagem", "aplicacoes", "equipamento"],
  marca: ["marca", "fabricante", "montadora", "linha de fabricacao"],
  categoria: ["categoria", "grupo", "familia", "linha", "segmento", "classe", "secao", "tipo"],
  unidade: ["unidade", "un", "und", "unid", "medida", "embalagem", "emb"],
  fornecedor: ["fornecedor", "distribuidor", "representante", "revenda"],
  custo: ["custo", "preco de custo", "valor unitario", "unitario", "liquido", "net", "compra"],
  preco: ["preco", "venda", "valor", "publico", "sugerido", "tabela", "revenda", "varejo"],
};

/** Apelido curto precisa bater como palavra inteira: senão "un" acha
 *  "conjunto" e "cod" acha qualquer coisa. */
function casa(titulo, apelido) {
  if (apelido.length > 4) return titulo.includes(apelido);
  return new RegExp(`(^|[^a-z0-9])${apelido}([^a-z0-9]|$)`).test(titulo);
}

/** Que campo é esta coluna, pelo nome dela. Vence o apelido mais longo:
 *  "preço de custo" é custo, não preço. */
export function identificar(titulo) {
  const t = dobrar(limpar(titulo));
  if (!t) return null;

  let escolhido = null;
  let tamanho = 0;
  for (const [campo, apelidos] of Object.entries(APELIDOS)) {
    for (const apelido of apelidos) {
      if (casa(t, apelido) && apelido.length > tamanho) {
        escolhido = campo;
        tamanho = apelido.length;
      }
    }
  }
  return escolhido;
}

/** Coluna de margem da tabela do fornecedor: "+50%", "+ 100 %". */
const margemDe = (titulo) => {
  const achado = dobrar(limpar(titulo)).match(/\+\s*(\d+)\s*%/);
  return achado ? `+${achado[1]}%` : null;
};

const vazia = (c) => !String(c ?? "").trim();
const preenchidas = (linha) => linha.filter((c) => !vazia(c)).length;

/** O cabeçalho é a linha que mais parece nome de coluna e menos parece dado. */
function acharCabecalho(linhas) {
  let melhor = -1;
  let recorde = 1.5;

  for (let i = 0; i < Math.min(linhas.length, 25); i++) {
    const linha = linhas[i];
    if (preenchidas(linha) < 2) continue;

    const nomes = linha.filter((c) => identificar(c) || margemDe(c)).length;
    const numeros = linha.filter((c) => !vazia(c) && numero(c) != null).length;
    const pontos = nomes - numeros * 0.75;

    if (pontos > recorde) {
      recorde = pontos;
      melhor = i;
    }
  }
  return melhor;
}

/** Retrato de cada coluna, para adivinhar o que ela é quando não tem nome. */
function perfilar(linhas, quantasColunas) {
  const perfis = [];

  for (let c = 0; c < quantasColunas; c++) {
    const valores = linhas.map((l) => String(l[c] ?? "").trim()).filter(Boolean);
    const numeros = valores.filter((v) => numero(v) != null);
    const codigos = valores.filter((v) => /^[a-z0-9][a-z0-9./\- ]{1,19}$/i.test(v) && /\d/.test(v));

    perfis.push({
      indice: c,
      preenchimento: linhas.length ? valores.length / linhas.length : 0,
      numerico: valores.length ? numeros.length / valores.length : 0,
      codigo: valores.length ? codigos.length / valores.length : 0,
      comprimento: valores.length
        ? valores.reduce((s, v) => s + v.length, 0) / valores.length
        : 0,
      media: numeros.length ? numeros.reduce((s, v) => s + numero(v), 0) / numeros.length : 0,
    });
  }
  return perfis;
}

/** Sem cabeçalho reconhecível, o conteúdo entrega o jogo: a coluna de texto
 *  mais longa é a descrição, a de valores maiores é o preço, e a de códigos
 *  curtos com número no meio é o código. */
function adivinhar(mapa, perfis) {
  const avisos = [];
  const livre = (p) => !Object.values(mapa).includes(p.indice) && p.preenchimento > 0.3;

  if (mapa.descricao == null) {
    const alvo = perfis
      .filter((p) => livre(p) && p.numerico < 0.5 && p.comprimento >= 6)
      .sort((a, b) => b.comprimento - a.comprimento)[0];
    if (alvo) {
      mapa.descricao = alvo.indice;
      avisos.push("A descrição da peça foi deduzida da coluna de texto mais longa.");
    }
  }

  if (mapa.codigo == null) {
    const alvo = perfis
      .filter((p) => livre(p) && p.codigo > 0.6 && p.comprimento <= 18)
      .sort((a, b) => b.codigo - a.codigo)[0];
    if (alvo) {
      mapa.codigo = alvo.indice;
      avisos.push("O código foi deduzido pelo formato dos valores da coluna.");
    }
  }

  if (mapa.preco == null) {
    const alvo = perfis
      .filter((p) => livre(p) && p.numerico > 0.7)
      .sort((a, b) => b.media - a.media)[0];
    if (alvo) {
      mapa.preco = alvo.indice;
      avisos.push("O preço foi deduzido da coluna de números de maior valor — confira.");
    }
  }

  return avisos;
}

/**
 * Olha as linhas cruas e devolve tudo que a tela de importação precisa
 * mostrar: onde está o cabeçalho, que coluna é o quê, e o que foi chute.
 */
export function analisar(linhas) {
  const uteis = linhas.filter((l) => Array.isArray(l) && preenchidas(l) > 0);
  if (!uteis.length) throw new Error("Não encontrei nenhuma linha com conteúdo neste arquivo.");

  const quantasColunas = Math.max(...uteis.map((l) => l.length));
  const iCabecalho = acharCabecalho(uteis);
  const cabecalho =
    iCabecalho >= 0 ? uteis[iCabecalho] : new Array(quantasColunas).fill("");
  const dados = uteis.slice(iCabecalho + 1);

  const mapa = {};
  const margens = [];

  cabecalho.forEach((titulo, i) => {
    const margem = margemDe(titulo);
    if (margem) {
      margens.push({ rotulo: margem, indice: i });
      return;
    }
    const campo = identificar(titulo);
    if (campo && mapa[campo] == null) mapa[campo] = i;
  });

  const perfis = perfilar(dados.slice(0, 300), quantasColunas);
  const avisos = [];

  // Margem preenchida em mais linhas é a que o fornecedor usa de verdade.
  if (mapa.preco == null && margens.length) {
    const melhor = [...margens].sort(
      (a, b) => perfis[b.indice].preenchimento - perfis[a.indice].preenchimento
    )[0];
    mapa.preco = melhor.indice;
  }

  if (iCabecalho < 0) avisos.push("O arquivo não tinha cabeçalho: as colunas foram deduzidas.");
  avisos.push(...adivinhar(mapa, perfis));

  const colunas = [];
  for (let i = 0; i < quantasColunas; i++) {
    colunas.push({
      indice: i,
      titulo: limpar(cabecalho[i]) || `Coluna ${i + 1}`,
      amostra: dados
        .map((l) => limpar(l[i]))
        .filter(Boolean)
        .slice(0, 3),
    });
  }

  return { mapa, colunas, margens, dados, avisos, cabecalho: iCabecalho };
}

const LIXO = /^(total|subtotal|soma|pagina|página|obs|observa|continua|nota|tabela de pre)/i;

/** Linha de categoria: uma célula sozinha, curta, sem preço nenhum.
 *  Catálogo de fornecedor é cheio disso ("SUSPENSÃO", "FREIO"). */
const ehCategoria = (linha) => {
  const cheias = linha.filter((c) => !vazia(c));
  return cheias.length === 1 && cheias[0].length <= 45 && numero(cheias[0]) == null;
};

/** Identidade da peça. Sem código, o nome faz esse papel — senão o
 *  catálogo inteiro de um fornecedor viraria uma peça só.
 *  Igualzinha à função `chave_peca` do banco: se as duas divergirem, a
 *  prévia promete uma coisa e a gravação faz outra. */
export const chave = (p) => {
  const fornecedor = String(p.fornecedor ?? "").trim();
  const codigo = String(p.codigo ?? "").trim().toUpperCase();
  return `${fornecedor}|${codigo || "#" + String(p.descricao ?? "").trim().toLowerCase()}`;
};

/** Transforma as linhas de dados em peças, do jeito que o banco espera. */
export function montarPecas(dados, mapa, { margens = [], fornecedorPadrao = "" } = {}) {
  const ler = (linha, campo) => (mapa[campo] == null ? "" : limpar(linha[mapa[campo]]));
  const lidas = [];
  const ignoradas = [];
  let categoria = "";

  for (const linha of dados) {
    if (!preenchidas(linha)) continue;

    const primeira = limpar(linha.find((c) => !vazia(c)) ?? "");
    if (LIXO.test(primeira)) continue;

    // cabeçalho que se repete a cada página do PDF
    if (linha.filter((c) => identificar(c)).length >= 2) continue;

    if (ehCategoria(linha)) {
      categoria = primeira;
      continue;
    }

    const descricao = ler(linha, "descricao");
    if (!descricao || descricao.length < 2) {
      ignoradas.push(primeira);
      continue;
    }

    // preço: a coluna escolhida e, se ela estiver vazia nesta linha,
    // a primeira margem preenchida — tabela de fornecedor é irregular assim
    let preco = numero(mapa.preco == null ? null : linha[mapa.preco]);
    if (preco == null) {
      for (const margem of margens) {
        const alternativo = numero(linha[margem.indice]);
        if (alternativo != null) {
          preco = alternativo;
          break;
        }
      }
    }

    const custo = numero(mapa.custo == null ? null : linha[mapa.custo]);
    const codigo = ler(linha, "codigo").toUpperCase();

    if (!codigo && preco == null && custo == null) {
      ignoradas.push(descricao);
      continue;
    }

    lidas.push({
      codigo,
      descricao,
      aplicacao: ler(linha, "aplicacao"),
      marca: ler(linha, "marca"),
      categoria: ler(linha, "categoria") || categoria,
      unidade: (ler(linha, "unidade") || "UN").toUpperCase().slice(0, 10),
      fornecedor: ler(linha, "fornecedor") || fornecedorPadrao.trim(),
      custo: centavos(custo) ?? 0,
      preco: centavos(preco) ?? 0,
    });
  }

  // mesma peça repetida no arquivo: vale a última, que é a correção mais recente
  const porChave = new Map();
  for (const p of lidas) porChave.set(chave(p), p);

  return {
    pecas: [...porChave.values()],
    ignoradas,
    repetidas: lidas.length - porChave.size,
  };
}

/** Separa o que vai entrar do que só vai ser atualizado. */
export function comparar(pecasDoArquivo, pecasNoBanco) {
  const existentes = new Set(pecasNoBanco.map(chave));
  const novas = pecasDoArquivo.filter((p) => !existentes.has(chave(p))).length;
  return { novas, atualizadas: pecasDoArquivo.length - novas };
}
