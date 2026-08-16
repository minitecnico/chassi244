"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
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

/** Quantas peças por chamada. Apagar 5 mil de uma vez estoura a requisição. */
const LOTE = 200;

/** A palavra que precisa ser digitada. Apagar em massa não pode ser um
 *  clique distraído — e o botão de excluir uma peça só continua onde
 *  sempre esteve, na ficha dela. */
const PALAVRA = "APAGAR";

export default function ApagarPecas({ aberto, pecas, filtrando, aoFechar, aoApagar }) {
  const [confirmacao, setConfirmacao] = useState("");
  const [apagando, setApagando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  useEffect(() => {
    if (aberto) {
      setConfirmacao("");
      setProgresso(0);
    }
  }, [aberto]);

  const total = pecas.length;
  const podeApagar = confirmacao.trim().toUpperCase() === PALAVRA && !apagando;

  async function apagar() {
    setApagando(true);
    setProgresso(0);

    const ids = pecas.map((p) => p.id);
    const fotos = pecas.map((p) => p.foto).filter(Boolean);

    for (let i = 0; i < ids.length; i += LOTE) {
      const { error } = await supabase.from("pecas").delete().in("id", ids.slice(i, i + LOTE));
      if (error) {
        setApagando(false);
        return toast.error(error.message);
      }
      setProgresso(Math.min(i + LOTE, ids.length));
    }

    // as fotos das peças apagadas não ficam ocupando o depósito
    for (let i = 0; i < fotos.length; i += 100) {
      await supabase.storage.from("fotos").remove(fotos.slice(i, i + 100));
    }

    setApagando(false);
    aoApagar(ids);
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !apagando && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apagar {total} {total === 1 ? "peça" : "peças"}</DialogTitle>
          <DialogDescription>
            {filtrando
              ? "Vai apagar exatamente o que está na tela agora — o que a busca e os filtros deixaram."
              : "Nenhum filtro está ligado: isto apaga o catálogo inteiro."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-5">
          <p className="flex gap-2 rounded-lg bg-accent p-3 text-xs font-medium">
            <TriangleAlert className="size-4 shrink-0" />
            <span>
              Não tem como desfazer. O histórico de entradas e saídas dessas peças vai junto, e
              as fotos delas saem do depósito.
            </span>
          </p>

          <div className="overflow-hidden rounded-lg border">
            <ul className="divide-y text-xs">
              {pecas.slice(0, 4).map((p) => (
                <li key={p.id} className="flex gap-2 p-2">
                  <span className="font-mono text-muted-foreground">{p.codigo || "—"}</span>
                  <span className="truncate">{p.descricao}</span>
                </li>
              ))}
            </ul>
            {total > 4 && <p className="etiqueta border-t p-2">e mais {total - 4}</p>}
          </div>

          <div>
            <Label htmlFor="confirmacao">
              Escreva <span className="font-mono font-semibold">{PALAVRA}</span> para confirmar
            </Label>
            <Input
              id="confirmacao"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              disabled={apagando}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="mt-1.5 font-mono"
            />
          </div>

          {apagando && (
            <div className="space-y-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-destructive transition-[width] duration-300"
                  style={{ width: `${(progresso / total) * 100}%` }}
                />
              </div>
              <p className="etiqueta">
                apagando {progresso} de {total}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar} disabled={apagando}>
            Cancelar
          </Button>
          <Button
            onClick={apagar}
            disabled={!podeApagar}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {apagando ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {apagando ? "Apagando..." : `Apagar ${total}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
