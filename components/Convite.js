"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, RefreshCw, Share2 } from "lucide-react";
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

/** O convite da oficina: um link para mandar no grupo. Quem abre, se
 *  cadastra sozinho e já entra. Ninguém digita senha de oficina nenhuma. */
export default function Convite({ aberto, aoFechar }) {
  const [codigo, setCodigo] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [girando, setGirando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setCarregando(true);
    setCopiado(false);
    supabase.rpc("convite_da_equipe").then(({ data, error }) => {
      if (error) toast.error(error.message);
      setCodigo(data || "");
      setCarregando(false);
    });
  }, [aberto]);

  // o endereço do portal só existe no navegador; no servidor isto é vazio
  const link =
    codigo && typeof window !== "undefined"
      ? `${window.location.origin}/login?convite=${codigo}`
      : "";

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      toast.success("Link copiado. Mande no grupo da oficina.");
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error("Não consegui copiar sozinho — selecione o link e copie à mão.");
    }
  }

  /** Compartilhar do celular: cai direto no WhatsApp. */
  async function compartilhar() {
    try {
      await navigator.share({
        title: "Catálogo de peças",
        text: "Crie seu acesso ao catálogo da oficina:",
        url: link,
      });
    } catch {
      /* fechou o menu do celular; nada a fazer */
    }
  }

  async function girar() {
    if (!confirm("Gerar um link novo? O link antigo para de funcionar na hora. Quem já entrou continua dentro.")) {
      return;
    }
    setGirando(true);
    const { data, error } = await supabase.rpc("girar_convite");
    setGirando(false);
    if (error) return toast.error(error.message);
    setCodigo(data || "");
    setCopiado(false);
    toast.success("Link novo gerado. O anterior não vale mais.");
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar a equipe</DialogTitle>
          <DialogDescription>
            Mande este link para quem vai usar o catálogo. Cada pessoa cria o próprio acesso —
            você não precisa cadastrar ninguém.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 p-5">
          {carregando ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> buscando o link...
            </div>
          ) : (
            <>
              <Input
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
                aria-label="Link de convite"
                className="font-mono text-xs"
              />

              <div className="flex flex-wrap gap-2">
                <Button onClick={copiar} className="flex-1">
                  {copiado ? <Check /> : <Copy />}
                  {copiado ? "Copiado" : "Copiar link"}
                </Button>
                {typeof navigator !== "undefined" && navigator.share && (
                  <Button variant="outline" onClick={compartilhar} className="flex-1">
                    <Share2 /> Compartilhar
                  </Button>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Quem já entrou não precisa do link de novo. Se alguém sair da oficina, gere um
                link novo: o antigo para de valer na hora.
              </p>
            </>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={girar} disabled={girando || carregando}>
            {girando ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Gerar link novo
          </Button>
          <Button variant="outline" onClick={aoFechar}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
