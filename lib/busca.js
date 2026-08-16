import { dobrar, compactar } from "@/lib/texto";

/** A busca do catálogo. Quem procura peça no balcão digita errado, digita
 *  pela metade, digita o código com traço quando no cadastro não tem, e
 *  mistura peça com modelo do chassi. Tudo isso precisa achar. */

const PESOS = {
  codigo: 5,
  descricao: 3,
  aplicacao: 2.2,
  marca: 1.6,
  categoria: 1.2,
  fornecedor: 1,
};

const CAMPOS = Object.keys(PESOS);
const ALFANUMERICO = /[a-z0-9]/;

/** Peso do acerto por código escrito de outro jeito: "ab12" achando "AB-12/3". */
const PESO_COMPACTO = 3.5;

/** Monta o índice uma vez, quando a lista muda. Cada tecla digitada depois
 *  só varre texto já preparado. */
export function indexar(pecas) {
  return pecas.map((peca) => {
    const campos = [];
    for (const campo of CAMPOS) {
      const texto = dobrar(peca[campo] ?? "");
      if (texto) campos.push({ texto, peso: PESOS[campo] });
    }

    const palavras = new Set();
    for (const { texto } of campos) {
      for (const palavra of texto.split(/[^a-z0-9]+/)) if (palavra.length > 2) palavras.add(palavra);
    }

    return {
      peca,
      campos,
      palavras: [...palavras],
      compacto: compactar(`${peca.codigo ?? ""} ${peca.descricao ?? ""} ${peca.aplicacao ?? ""}`),
    };
  });
}

/** Quebra o que foi digitado em termos comparáveis. */
export function preparar(consulta) {
  return dobrar(consulta)
    .split(/\s+/)
    .filter(Boolean)
    .map((texto) => ({ texto, compacto: compactar(texto) }));
}

/** Palavra inteira vale mais que começo de palavra, que vale mais que
 *  pedaço no meio. É o que faz "mola" mostrar a mola antes do "suporte
 *  da mola dianteira". */
function qualidade(texto, termo) {
  const i = texto.indexOf(termo);
  if (i < 0) return 0;

  const fim = i + termo.length;
  const comeco = i === 0 || !ALFANUMERICO.test(texto[i - 1]);
  const acaba = fim === texto.length || !ALFANUMERICO.test(texto[fim]);

  if (comeco && acaba) return 1;
  if (comeco) return 0.8;
  return 0.5;
}

/** Distância de digitação entre duas palavras, desistindo assim que
 *  passa do limite — sem isso, comparar tudo com tudo fica caro. */
function distancia(a, b, limite) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limite) return limite + 1;

  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    let menor = i;
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      atual[j] = Math.min(atual[j - 1] + 1, anterior[j] + 1, anterior[j - 1] + custo);
      menor = Math.min(menor, atual[j]);
    }
    if (menor > limite) return limite + 1;
    anterior = atual;
  }

  return anterior[b.length];
}

/** Quantos erros de digitação são perdoáveis num termo deste tamanho. */
const tolerancia = (termo) => (termo.length <= 3 ? 0 : termo.length <= 5 ? 1 : 2);

function pontuarTermo(item, termo, tolerante) {
  let melhor = 0;

  for (const { texto, peso } of item.campos) {
    const q = qualidade(texto, termo.texto);
    if (q * peso > melhor) melhor = q * peso;
  }

  // "1.721" acha "1721", "ab 12" acha "AB-12"
  if (termo.compacto.length >= 3 && item.compacto.includes(termo.compacto)) {
    melhor = Math.max(melhor, PESO_COMPACTO);
  }

  if (melhor || !tolerante) return melhor;

  const limite = tolerancia(termo.texto);
  if (!limite) return 0;
  for (const palavra of item.palavras) {
    if (distancia(palavra, termo.texto, limite) <= limite) return 1.2;
  }

  return 0;
}

/**
 * Busca no índice. Todos os termos digitados precisam acertar alguma coisa;
 * a ordem sai da soma dos acertos. Se a busca exata quase não devolve nada,
 * repete perdoando erro de digitação e avisa que o resultado é aproximado.
 */
export function buscar(indice, consulta) {
  const termos = preparar(consulta);
  if (!termos.length) return { pecas: indice.map((i) => i.peca), termos, aproximado: false };

  const varrer = (tolerante) => {
    const achados = [];
    for (const item of indice) {
      let pontos = 0;
      let completo = true;
      for (const termo of termos) {
        const p = pontuarTermo(item, termo, tolerante);
        if (!p) {
          completo = false;
          break;
        }
        pontos += p;
      }
      if (completo) achados.push({ peca: item.peca, pontos });
    }
    return achados;
  };

  let achados = varrer(false);
  let aproximado = false;

  if (achados.length < 5) {
    const perdoando = varrer(true);
    if (perdoando.length > achados.length) {
      achados = perdoando;
      aproximado = true;
    }
  }

  achados.sort(
    (a, b) => b.pontos - a.pontos || String(a.peca.descricao).localeCompare(String(b.peca.descricao), "pt-BR")
  );

  return { pecas: achados.map((a) => a.peca), termos, aproximado };
}

/** Quebra o texto nos pedaços que casaram, para a tela poder grifar. */
export function realcar(texto, termos) {
  const original = String(texto ?? "");
  const base = dobrar(original);
  if (!termos?.length || base.length !== original.length) return [{ t: original }];

  const marcas = new Array(original.length).fill(false);
  for (const { texto: termo } of termos) {
    if (!termo) continue;
    let i = base.indexOf(termo);
    while (i >= 0) {
      for (let k = i; k < i + termo.length; k++) marcas[k] = true;
      i = base.indexOf(termo, i + 1);
    }
  }

  const pedacos = [];
  for (let i = 0; i < original.length; i++) {
    const ultimo = pedacos[pedacos.length - 1];
    if (ultimo && ultimo.marcado === marcas[i]) ultimo.t += original[i];
    else pedacos.push({ t: original[i], marcado: marcas[i] });
  }
  return pedacos;
}
