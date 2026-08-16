"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  FileUp,
  LogOut,
  MoreVertical,
  Package,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import PecaForm from "@/components/PecaForm";
import Detalhe from "@/components/Detalhe";
import ImportarCatalogo from "@/components/ImportarCatalogo";
import Convite from "@/components/Convite";
import ApagarPecas from "@/components/ApagarPecas";
import { moeda, ordenar, paraCsv } from "@/lib/formato";
import { indexar, buscar, realcar } from "@/lib/busca";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Sem a coluna `busca`, que é do banco e pesa mais que todo o resto junto. */
const COLUNAS =
  "id,codigo,descricao,categoria,aplicacao,marca,unidade,local,fornecedor," +
  "quantidade,minimo,custo,preco,foto,criado_em,atualizado_em";

/** O Supabase devolve no máximo mil linhas por consulta: pedimos de mil em
 *  mil até acabar, senão a peça de número 1001 não existiria na tela. */
const PAGINA = 1000;

/** Quantos cartões desenhar de uma vez; o resto entra em "mostrar mais". */
const LOTE_VISIVEL = 60;

const FILTROS = [
  { id: "fornecedor", rotulo: "Fornecedor" },
  { id: "marca", rotulo: "Marca" },
  { id: "categoria", rotulo: "Categoria" },
];

export default function Catalogo() {
  const [pecas, setPecas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [consulta, setConsulta] = useState("");
  const [filtros, setFiltros] = useState({});
  const [selecionada, setSelecionada] = useState(null);
  const [editando, setEditando] = useState(null); // peça existente, ou {} para nova
  const [importando, setImportando] = useState(false);
  const [convidando, setConvidando] = useState(false);
  const [apagandoLote, setApagandoLote] = useState(false);
  const [limite, setLimite] = useState(LOTE_VISIVEL);
  const campoBusca = useRef(null);
  const router = useRouter();

  useEffect(() => {
    carregar();

    // Peça cadastrada num computador aparece no outro sem recarregar.
    const canal = supabase
      .channel("catalogo")
      .on("postgres_changes", { event: "*", schema: "public", table: "pecas" }, (evento) => {
        setPecas((lista) => {
          if (evento.eventType === "DELETE") return lista.filter((p) => p.id !== evento.old.id);
          const nova = evento.new;
          return lista.some((p) => p.id === nova.id)
            ? lista.map((p) => (p.id === nova.id ? nova : p))
            : ordenar([...lista, nova]);
        });
        setSelecionada((s) => (s && evento.new?.id === s.id ? evento.new : s));
      })
      .subscribe();

    return () => supabase.removeChannel(canal);
  }, []);

  useEffect(() => {
    const atalho = (e) => {
      if (e.key === "/" && document.activeElement !== campoBusca.current) {
        e.preventDefault();
        campoBusca.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === campoBusca.current) setConsulta("");
    };
    window.addEventListener("keydown", atalho);
    return () => window.removeEventListener("keydown", atalho);
  }, []);

  async function carregar() {
    setCarregando(true);

    // Conta criada mas sem o código da oficina não enxerga peça nenhuma —
    // sem esta conferência, o portal mostraria um catálogo vazio como se
    // não houvesse nada cadastrado.
    const { data: membro } = await supabase.from("equipe").select("id").maybeSingle();
    if (!membro) {
      router.replace("/login");
      return;
    }

    const todas = [];

    for (let inicio = 0; ; ) {
      const { data, error } = await supabase
        .from("pecas")
        .select(COLUNAS)
        .order("descricao")
        .order("id") // desempate estável: sem ele, peças de mesmo nome pulam de página
        .range(inicio, inicio + PAGINA - 1);

      if (error) {
        setErro(error.message);
        setCarregando(false);
        return;
      }

      todas.push(...data);
      // avança pelo que o servidor devolveu, não pelo que pedimos
      if (data.length === 0) break;
      inicio += data.length;
    }

    setPecas(todas);
    setErro("");
    setCarregando(false);
  }

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // O índice é montado uma vez por lista; cada tecla só varre texto pronto.
  const indice = useMemo(() => indexar(pecas), [pecas]);
  const achados = useMemo(() => buscar(indice, consulta), [indice, consulta]);

  const visiveis = useMemo(() => {
    const ativos = Object.entries(filtros).filter(([, v]) => v);
    if (!ativos.length) return achados.pecas;
    return achados.pecas.filter((p) => ativos.every(([campo, valor]) => p[campo] === valor));
  }, [achados, filtros]);

  /** As opções de cada filtro saem do próprio catálogo. */
  const opcoes = useMemo(() => {
    const mapa = Object.fromEntries(FILTROS.map((f) => [f.id, new Set()]));
    for (const p of pecas) {
      for (const f of FILTROS) if (p[f.id]) mapa[f.id].add(p[f.id]);
    }
    return Object.fromEntries(
      FILTROS.map((f) => [f.id, [...mapa[f.id]].sort((a, b) => a.localeCompare(b, "pt-BR"))])
    );
  }, [pecas]);

  useEffect(() => setLimite(LOTE_VISIVEL), [consulta, filtros]);

  function exportarCsv() {
    const hoje = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(new Blob([paraCsv(visiveis)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `catalogo-${hoje}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    // soltar o endereço antes da hora cancela o download em alguns navegadores
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`${visiveis.length} peças exportadas.`);
  }

  function aplicar(peca, aviso) {
    setPecas((lista) =>
      lista.some((p) => p.id === peca.id)
        ? lista.map((p) => (p.id === peca.id ? peca : p))
        : ordenar([...lista, peca])
    );
    setSelecionada((s) => (s && s.id === peca.id ? peca : s));
    setEditando(null);
    if (aviso) toast.success(aviso);
  }

  async function excluir(peca) {
    const { error } = await supabase.from("pecas").delete().eq("id", peca.id);
    if (error) return toast.error(error.message);
    if (peca.foto) await supabase.storage.from("fotos").remove([peca.foto]);
    setPecas((lista) => lista.filter((p) => p.id !== peca.id));
    setSelecionada(null);
    toast.success("Peça excluída.");
  }

  const filtrando = Object.values(filtros).some(Boolean);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b py-6">
        <div>
          <p className="etiqueta">CHASSI244</p>
          <h1 className="text-3xl leading-none font-extrabold tracking-tight sm:text-4xl">
            Catálogo de peças
          </h1>
        </div>

        <div className="flex items-end gap-6">
          <Indicador rotulo="Peças" valor={pecas.length} />
          <Indicador rotulo="Fornecedores" valor={opcoes.fornecedor.length} />
          <Indicador rotulo="Marcas" valor={opcoes.marca.length} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Mais opções">
                <MoreVertical />
                <span className="sr-only">Mais opções</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setConvidando(true)}>
                <UserPlus /> Convidar a equipe
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={exportarCsv} disabled={!visiveis.length}>
                <Download /> Baixar em CSV
                <span className="etiqueta ml-auto">{visiveis.length}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Cuidado</DropdownMenuLabel>
              <DropdownMenuItem
                perigo
                onSelect={() => setApagandoLote(true)}
                disabled={!visiveis.length}
              >
                <Trash2 /> Apagar as peças da tela
                <span className="etiqueta ml-auto">{visiveis.length}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={sair}>
                <LogOut /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="sticky top-0 z-10 -mx-4 bg-background/90 px-4 pt-4 pb-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={campoBusca}
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder="Buscar peça, código, aplicação ou marca"
              aria-label="Buscar no catálogo"
              className="h-11 pr-9 pl-9"
            />
            {consulta ? (
              <button
                onClick={() => setConsulta("")}
                aria-label="Limpar busca"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : (
              <kbd className="etiqueta absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border px-1.5 py-0.5 sm:block">
                /
              </kbd>
            )}
          </div>

          <Button size="lg" className="h-11" onClick={() => setImportando(true)}>
            <FileUp />
            <span className="hidden sm:inline">Alimentar catálogo</span>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-11"
            onClick={() => setEditando({})}
            title="Cadastrar uma peça à mão"
          >
            <Plus />
            <span className="sr-only">Nova peça</span>
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          {FILTROS.map((f) => (
            <select
              key={f.id}
              value={filtros[f.id] || ""}
              onChange={(e) => setFiltros((atual) => ({ ...atual, [f.id]: e.target.value }))}
              aria-label={`Filtrar por ${f.rotulo.toLowerCase()}`}
              className={`h-8 rounded-md border px-2 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 ${
                filtros[f.id] ? "bg-accent font-medium" : "bg-card text-muted-foreground"
              }`}
            >
              <option value="">{f.rotulo}</option>
              {opcoes[f.id].map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
          ))}

          {filtrando && (
            <Button variant="ghost" size="sm" onClick={() => setFiltros({})}>
              <X /> Limpar filtros
            </Button>
          )}

          <span className="etiqueta ml-auto">
            {carregando
              ? "carregando"
              : achados.aproximado
                ? `${visiveis.length} parecidas com "${consulta}"`
                : `${visiveis.length} de ${pecas.length}`}
          </span>
        </div>
      </div>

      {erro && (
        <Card className="border-destructive p-4 text-sm text-destructive">
          {erro}{" "}
          <button onClick={carregar} className="underline underline-offset-4">
            tentar de novo
          </button>
        </Card>
      )}

      {carregando && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      )}

      {!carregando && !erro && visiveis.length === 0 && (
        <div className="flex flex-col items-center py-20 text-center">
          <Package className="size-10 text-muted-foreground" strokeWidth={1.25} />
          <p className="mt-4 text-sm text-muted-foreground">
            {pecas.length === 0
              ? "O catálogo está vazio. Mande o arquivo do fornecedor para começar."
              : "Nenhuma peça com esses termos."}
          </p>
          {pecas.length === 0 && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button onClick={() => setImportando(true)}>
                <FileUp /> Alimentar catálogo
              </Button>
              <Button variant="outline" onClick={() => setEditando({})}>
                <Plus /> Cadastrar uma peça
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visiveis.slice(0, limite).map((p) => (
          <Card
            key={p.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelecionada(p)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelecionada(p);
              }
            }}
            className="flex cursor-pointer flex-col gap-0 p-4 transition-colors outline-none hover:border-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="etiqueta truncate">
                <Realce texto={p.codigo || "sem código"} termos={achados.termos} />
              </span>
              {p.fornecedor && (
                <span className="etiqueta shrink-0 truncate">{p.fornecedor}</span>
              )}
            </div>

            <p className="mt-2 leading-snug font-medium">
              <Realce texto={p.descricao} termos={achados.termos} />
            </p>

            {p.aplicacao && (
              <p className="mt-1 text-xs text-muted-foreground">
                <Realce texto={p.aplicacao} termos={achados.termos} />
              </p>
            )}

            <div className="mt-auto flex items-end justify-between gap-3 pt-4">
              <div className="flex min-w-0 flex-wrap gap-1">
                {[p.marca, p.categoria].filter(Boolean).map((etiqueta) => (
                  <span
                    key={etiqueta}
                    className="max-w-[10rem] truncate rounded border px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground"
                  >
                    {etiqueta}
                  </span>
                ))}
              </div>
              <span className="shrink-0 font-mono text-lg leading-none font-semibold">
                {moeda(p.preco)}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {visiveis.length > limite && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <p className="etiqueta">
            mostrando {limite} de {visiveis.length}
          </p>
          <Button variant="outline" onClick={() => setLimite((n) => n + LOTE_VISIVEL * 4)}>
            Mostrar mais peças
          </Button>
        </div>
      )}

      <Detalhe
        peca={selecionada}
        aoFechar={() => setSelecionada(null)}
        aoAtualizar={aplicar}
        aoExcluir={excluir}
        aoEditar={(p) => {
          setSelecionada(null);
          setEditando(p);
        }}
      />

      <ImportarCatalogo
        aberto={importando}
        aoFechar={() => setImportando(false)}
        pecasNoBanco={pecas}
        aoConcluir={(aviso) => {
          setImportando(false);
          toast.success(aviso);
          carregar();
        }}
      />

      <PecaForm
        peca={editando?.id ? editando : null}
        aberto={!!editando}
        aoFechar={() => setEditando(null)}
        aoSalvar={aplicar}
      />

      <Convite aberto={convidando} aoFechar={() => setConvidando(false)} />

      <ApagarPecas
        aberto={apagandoLote}
        pecas={visiveis}
        filtrando={filtrando || !!consulta}
        aoFechar={() => setApagandoLote(false)}
        aoApagar={(ids) => {
          const apagados = new Set(ids);
          setPecas((lista) => lista.filter((p) => !apagados.has(p.id)));
          setSelecionada(null);
          setApagandoLote(false);
          toast.success(`${ids.length} ${ids.length === 1 ? "peça apagada" : "peças apagadas"}.`);
        }}
      />
    </main>
  );
}

/** Grifa a marca-texto o pedaço que a busca casou. */
function Realce({ texto, termos }) {
  const pedacos = realcar(texto, termos);
  if (pedacos.length === 1) return pedacos[0].t;
  return pedacos.map((pedaco, i) =>
    pedaco.marcado ? (
      <mark key={i} className="grifo">
        {pedaco.t}
      </mark>
    ) : (
      <span key={i}>{pedaco.t}</span>
    )
  );
}

function Indicador({ rotulo, valor }) {
  return (
    <div>
      <p className="etiqueta">{rotulo}</p>
      <p className="font-mono text-lg leading-tight font-semibold">{valor}</p>
    </div>
  );
}
