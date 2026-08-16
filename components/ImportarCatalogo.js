"use client";

import { useMemo, useRef, useState } from "react";
import { FileUp, Loader2, RotateCcw, Upload, TriangleAlert, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { extrair, FORMATOS, FORMATOS_HUMANOS, fornecedorDoNome } from "@/lib/extrair";
import { analisar, montarPecas, comparar, CAMPOS } from "@/lib/catalogo";
import { moeda } from "@/lib/formato";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Quantas peças vão ao banco por vez. Cada lote é uma transação. */
const LOTE = 100;

export default function ImportarCatalogo({ aberto, aoFechar, pecasNoBanco, aoConcluir }) {
  const [arquivo, setArquivo] = useState(null);
  const [leitura, setLeitura] = useState(null); // { linhas, formato, detalhe }
  const [analise, setAnalise] = useState(null); // { mapa, colunas, dados, margens, avisos }
  const [mapa, setMapa] = useState({});
  const [fornecedor, setFornecedor] = useState("");
  const [lendo, setLendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const entrada = useRef(null);

  async function escolher(novo) {
    if (!novo) return;
    setLendo(true);
    try {
      const lido = await extrair(novo);
      const analisado = analisar(lido.linhas);
      setArquivo(novo);
      setLeitura(lido);
      setAnalise(analisado);
      setMapa(analisado.mapa);
      setFornecedor(
        analisado.mapa.fornecedor != null ? "" : fornecedorDoNome(novo.name)
      );
    } catch (e) {
      toast.error(e.message);
      limpar();
    }
    setLendo(false);
  }

  function limpar() {
    setArquivo(null);
    setLeitura(null);
    setAnalise(null);
    setMapa({});
    setFornecedor("");
    setProgresso(0);
    if (entrada.current) entrada.current.value = "";
  }

  function fechar() {
    if (importando) return;
    limpar();
    aoFechar();
  }

  /** Trocar uma coluna de campo tira o campo de onde ele estava antes:
   *  duas colunas não podem ser a descrição ao mesmo tempo. */
  function apontar(indice, campo) {
    setMapa((atual) => {
      const novo = { ...atual };
      for (const [id, i] of Object.entries(novo)) if (i === indice) delete novo[id];
      if (campo) novo[campo] = indice;
      return novo;
    });
  }

  const resultado = useMemo(() => {
    if (!analise) return null;
    return montarPecas(analise.dados, mapa, {
      margens: analise.margens,
      fornecedorPadrao: fornecedor,
    });
  }, [analise, mapa, fornecedor]);

  const previsao = resultado ? comparar(resultado.pecas, pecasNoBanco) : null;
  const semDescricao = analise && mapa.descricao == null;

  async function importar() {
    setImportando(true);
    setProgresso(0);
    let novas = 0;
    let atualizadas = 0;

    for (let i = 0; i < resultado.pecas.length; i += LOTE) {
      const { data, error } = await supabase.rpc("importar_pecas", {
        itens: resultado.pecas.slice(i, i + LOTE),
      });

      if (error) {
        setImportando(false);
        return toast.error(error.message);
      }

      novas += data.novas;
      atualizadas += data.atualizadas;
      setProgresso(Math.min(i + LOTE, resultado.pecas.length));
    }

    setImportando(false);
    limpar();
    aoConcluir(`${novas} peças cadastradas e ${atualizadas} atualizadas.`);
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Alimentar o catálogo</DialogTitle>
          <DialogDescription>
            Mande o arquivo do jeito que o fornecedor enviou: {FORMATOS_HUMANOS}. As colunas
            são reconhecidas sozinhas e ficam aqui para você conferir antes de gravar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 p-5">
          {!analise && (
            <label
              className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center transition-colors hover:bg-secondary"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                escolher(e.dataTransfer.files?.[0]);
              }}
            >
              {lendo ? (
                <Loader2 className="size-8 animate-spin text-muted-foreground" strokeWidth={1.25} />
              ) : (
                <FileUp className="size-8 text-muted-foreground" strokeWidth={1.25} />
              )}
              <span className="text-sm font-medium">
                {lendo ? "Lendo o arquivo..." : "Escolha o arquivo ou arraste aqui"}
              </span>
              <span className="etiqueta">{FORMATOS_HUMANOS}</span>
              <input
                ref={entrada}
                type="file"
                accept={FORMATOS}
                className="sr-only"
                onChange={(e) => escolher(e.target.files?.[0])}
              />
            </label>
          )}

          {analise && (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="etiqueta rounded border px-1.5 py-0.5">{leitura.formato}</span>
                  <span className="truncate text-sm font-medium">{arquivo?.name}</span>
                  {leitura.detalhe && <span className="etiqueta hidden sm:inline">{leitura.detalhe}</span>}
                </div>
                <Button variant="ghost" size="sm" onClick={limpar} disabled={importando}>
                  <RotateCcw /> Trocar
                </Button>
              </div>

              <div className="grid grid-cols-3 divide-x rounded-lg border">
                <Resumo rotulo="Peças no arquivo" valor={resultado.pecas.length} />
                <Resumo rotulo="Entram novas" valor={previsao.novas} destaque={previsao.novas > 0} />
                <Resumo rotulo="Serão atualizadas" valor={previsao.atualizadas} />
              </div>

              {(analise.avisos.length > 0 || resultado.repetidas > 0) && (
                <div className="space-y-2">
                  {analise.avisos.map((aviso) => (
                    <Aviso key={aviso} icone={Wand2}>
                      {aviso}
                    </Aviso>
                  ))}
                  {resultado.repetidas > 0 && (
                    <Aviso icone={TriangleAlert}>
                      {resultado.repetidas} linhas repetem uma peça já listada no arquivo. Vale a
                      última ocorrência.
                    </Aviso>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="fornecedor" className="etiqueta">
                  Fornecedor
                </Label>
                <Input
                  id="fornecedor"
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  disabled={mapa.fornecedor != null || importando}
                  placeholder="Quem mandou este catálogo"
                  className="mt-1.5"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {mapa.fornecedor != null
                    ? "O próprio arquivo traz uma coluna de fornecedor."
                    : "Vale para as peças deste arquivo, e é por ele que a peça é reconhecida numa próxima importação."}
                </p>
              </div>

              <div>
                <p className="etiqueta">O que é cada coluna</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {analise.colunas.map((coluna) => (
                    <Coluna
                      key={coluna.indice}
                      coluna={coluna}
                      campo={Object.keys(mapa).find((id) => mapa[id] === coluna.indice) || ""}
                      aoTrocar={(campo) => apontar(coluna.indice, campo)}
                      travado={importando}
                    />
                  ))}
                </div>
              </div>

              {semDescricao ? (
                <Aviso icone={TriangleAlert} forte>
                  Nenhuma coluna foi marcada como <strong>Descrição</strong>. Sem o nome da peça
                  não dá para montar o catálogo — escolha a coluna acima.
                </Aviso>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="border-b bg-secondary">
                      <tr>
                        <th className="p-2 font-medium">Código</th>
                        <th className="p-2 font-medium">Peça</th>
                        <th className="p-2 font-medium">Aplicação</th>
                        <th className="p-2 text-right font-medium">Custo</th>
                        <th className="p-2 text-right font-medium">Venda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.pecas.slice(0, 5).map((p, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="p-2 font-mono">{p.codigo || "—"}</td>
                          <td className="max-w-[18rem] truncate p-2 whitespace-normal">{p.descricao}</td>
                          <td className="p-2 text-muted-foreground">{p.aplicacao || "—"}</td>
                          <td className="p-2 text-right font-mono">{moeda(p.custo)}</td>
                          <td className="p-2 text-right font-mono font-semibold">{moeda(p.preco)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {resultado.pecas.length > 5 && (
                    <p className="etiqueta border-t p-2">
                      e mais {resultado.pecas.length - 5} peças
                    </p>
                  )}
                </div>
              )}

              {resultado.ignoradas.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {resultado.ignoradas.length} linhas ficaram de fora por não ter nome de peça nem
                  preço nem código.
                </p>
              )}

              {importando && (
                <div className="space-y-1.5">
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-primary transition-[width] duration-300"
                      style={{ width: `${(progresso / resultado.pecas.length) * 100}%` }}
                    />
                  </div>
                  <p className="etiqueta">
                    gravando {progresso} de {resultado.pecas.length}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={fechar} disabled={importando}>
            Cancelar
          </Button>
          <Button
            onClick={importar}
            disabled={!resultado?.pecas.length || semDescricao || importando || lendo}
          >
            {importando ? <Loader2 className="animate-spin" /> : <Upload />}
            {importando
              ? "Gravando..."
              : resultado
                ? `Gravar ${resultado.pecas.length} peças`
                : "Gravar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Coluna({ coluna, campo, aoTrocar, travado }) {
  const id = `coluna-${coluna.indice}`;
  return (
    <div className={`rounded-lg border p-2.5 ${campo ? "" : "bg-muted"}`}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="truncate text-xs font-medium" title={coluna.titulo}>
          {coluna.titulo}
        </label>
        <select
          id={id}
          value={campo}
          onChange={(e) => aoTrocar(e.target.value)}
          disabled={travado}
          className="rounded-md border bg-card px-1.5 py-1 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <option value="">Ignorar</option>
          {CAMPOS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.rotulo}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1 truncate font-mono text-[0.6875rem] text-muted-foreground">
        {coluna.amostra.join(" · ") || "coluna vazia"}
      </p>
    </div>
  );
}

function Aviso({ icone: Icone, children, forte }) {
  return (
    <p
      className={`flex gap-2 rounded-lg p-3 text-xs ${
        forte ? "bg-accent font-medium" : "bg-muted text-muted-foreground"
      }`}
    >
      <Icone className="size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function Resumo({ rotulo, valor, destaque }) {
  return (
    <div className="p-3 text-center">
      <p className={`font-mono text-xl font-semibold ${destaque ? "text-foreground" : ""}`}>
        {valor}
      </p>
      <p className="etiqueta mt-0.5">{rotulo}</p>
    </div>
  );
}
