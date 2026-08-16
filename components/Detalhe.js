"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { moeda, data, abaixoDoMinimo } from "@/lib/formato";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function Detalhe({ peca, aoAtualizar, aoExcluir, aoEditar, aoFechar }) {
  return (
    <Sheet open={!!peca} onOpenChange={(o) => !o && aoFechar()}>
      <SheetContent side="right" className="p-0">
        {peca && (
          <Conteudo
            peca={peca}
            aoAtualizar={aoAtualizar}
            aoExcluir={aoExcluir}
            aoEditar={aoEditar}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Conteudo({ peca, aoAtualizar, aoExcluir, aoEditar }) {
  const [qtd, setQtd] = useState("1");
  const [obs, setObs] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [historico, setHistorico] = useState([]);
  const [fotoUrl, setFotoUrl] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => setResponsavel(localStorage.getItem("responsavel") || ""), []);

  useEffect(() => {
    carregarHistorico();
  }, [peca.id]);

  useEffect(() => {
    if (!peca.foto) return setFotoUrl("");
    supabase.storage
      .from("fotos")
      .createSignedUrl(peca.foto, 3600)
      .then(({ data }) => setFotoUrl(data?.signedUrl || ""));
  }, [peca.foto]);

  async function carregarHistorico() {
    const { data } = await supabase
      .from("movimentacoes")
      .select("*")
      .eq("peca_id", peca.id)
      .order("criado_em", { ascending: false })
      .limit(12);
    setHistorico(data || []);
  }

  const quantidade = Number(qtd);
  const podeMovimentar = Number.isFinite(quantidade) && quantidade > 0;

  async function movimentar(tipo) {
    if (!podeMovimentar) return;
    setOcupado(true);
    localStorage.setItem("responsavel", responsavel.trim());

    const { data, error } = await supabase.rpc("movimentar", {
      p_peca: peca.id,
      p_tipo: tipo,
      p_quantidade: quantidade,
      p_obs: obs.trim(),
      p_responsavel: responsavel.trim(),
    });

    setOcupado(false);
    if (error) return toast.error(error.message);

    aoAtualizar(data, tipo === "saida" ? `Baixa de ${qtd} un registrada.` : `Entrada de ${qtd} un registrada.`);
    setObs("");
    setQtd("1");
    carregarHistorico();
  }

  return (
    <>
      {abaixoDoMinimo(peca) && <div className="faixa-risco h-1.5 w-full shrink-0" />}

      <SheetHeader>
        <p className="etiqueta">{peca.codigo || "sem código"}</p>
        <SheetTitle>{peca.descricao}</SheetTitle>
        <SheetDescription>{peca.aplicacao || "Sem aplicação informada."}</SheetDescription>
      </SheetHeader>

      {fotoUrl && (
        <img src={fotoUrl} alt={peca.descricao} className="max-h-56 w-full border-b object-cover" />
      )}

      <dl className="grid grid-cols-2 border-b">
        <Dado rotulo="Venda" valor={moeda(peca.preco)} destaque />
        <Dado rotulo="Custo" valor={moeda(peca.custo)} destaque />
        <Dado rotulo="Marca" valor={peca.marca || "—"} />
        <Dado rotulo="Categoria" valor={peca.categoria || "—"} />
        <Dado rotulo="Unidade" valor={peca.unidade || "UN"} />
        <Dado rotulo="Prateleira" valor={peca.local || "—"} />
        <Dado rotulo="Fornecedor" valor={peca.fornecedor || "—"} span />
      </dl>

      <section className="space-y-3 border-b p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="etiqueta">Estoque</p>
          <p className="font-mono text-sm">
            <span className="text-lg font-semibold">{Number(peca.quantidade)}</span>{" "}
            <span className="text-muted-foreground">
              {peca.unidade || "UN"}
              {Number(peca.minimo) > 0 && ` · mínimo ${Number(peca.minimo)}`}
            </span>
          </p>
        </div>

        <div className="flex gap-2">
          <div className="w-24">
            <Label htmlFor="qtd" className="sr-only">
              Quantidade
            </Label>
            <Input
              id="qtd"
              type="number"
              min="1"
              value={qtd}
              onChange={(e) => setQtd(e.target.value)}
              className="text-center font-mono text-base"
            />
          </div>
          <Input
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="OS, veículo ou motivo"
          />
        </div>

        <Input
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          placeholder="Quem está retirando"
        />

        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={ocupado || !podeMovimentar}
            onClick={() => movimentar("saida")}
          >
            {ocupado ? <Loader2 className="animate-spin" /> : <ArrowUpFromLine />}
            Dar baixa
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={ocupado || !podeMovimentar}
            onClick={() => movimentar("entrada")}
          >
            <ArrowDownToLine />
            Entrada
          </Button>
        </div>
      </section>

      <section className="p-5">
        <p className="etiqueta">Últimas movimentações</p>
        {historico.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma movimentação registrada ainda.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {historico.map((h) => (
              <li key={h.id} className="flex items-start gap-3 border-b pb-2.5 text-sm last:border-0">
                <Badge
                  variant={h.tipo === "saida" ? "outline" : "secondary"}
                  className={`font-mono ${h.tipo === "saida" ? "text-destructive" : ""}`}
                >
                  {h.tipo === "saida" ? "−" : "+"}
                  {Number(h.quantidade)}
                </Badge>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{h.obs || "sem observação"}</span>
                  <span className="etiqueta">
                    {data(h.criado_em)}
                    {h.responsavel && ` · ${h.responsavel}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-auto flex gap-2 border-t p-4">
        <Button variant="outline" className="flex-1" onClick={() => aoEditar(peca)}>
          <Pencil /> Editar dados
        </Button>
        <Button
          variant="ghost"
          className="text-destructive hover:bg-destructive/10"
          onClick={() => {
            if (confirm(`Excluir "${peca.descricao}" do estoque?`)) aoExcluir(peca);
          }}
        >
          <Trash2 /> Excluir
        </Button>
      </div>
    </>
  );
}

function Dado({ rotulo, valor, destaque, span }) {
  return (
    <div className={`border-b px-5 py-3 last:border-b-0 ${span ? "col-span-2" : "odd:border-r"}`}>
      <dt className="etiqueta">{rotulo}</dt>
      <dd className={destaque ? "font-mono text-lg font-semibold" : "text-sm"}>{valor}</dd>
    </div>
  );
}
