"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Check } from "lucide-react";
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

const VAZIO = {
  codigo: "",
  descricao: "",
  categoria: "",
  aplicacao: "",
  marca: "",
  unidade: "UN",
  local: "",
  fornecedor: "",
  quantidade: "",
  minimo: "",
  custo: "",
  preco: "",
  foto: null,
};

const TEXTOS = [
  "codigo",
  "descricao",
  "categoria",
  "aplicacao",
  "marca",
  "unidade",
  "local",
  "fornecedor",
];
const NUMEROS = ["quantidade", "minimo", "custo", "preco"];

/** Aceita "1.234,56" e "1234.56". */
function num(v) {
  if (typeof v === "number") return v;
  if (!v) return 0;
  const n = Number(String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Apaga do depósito arquivos que ninguém mais aponta. Erro aqui não
 *  atrapalha o cadastro: no pior caso sobra uma foto sem dono. */
const apagarFotos = (caminhos) => {
  const alvos = caminhos.filter(Boolean);
  if (alvos.length) supabase.storage.from("fotos").remove(alvos);
};

export default function PecaForm({ peca, aberto, aoSalvar, aoFechar }) {
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const enviadas = useRef([]); // fotos subidas nesta edição, para limpar o que sobrar

  useEffect(() => {
    if (aberto) {
      setForm({ ...VAZIO, ...(peca || {}) });
      enviadas.current = [];
    }
  }, [aberto, peca]);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  /** Desistiu no meio: o que subiu agora não fica ocupando o depósito. */
  function fechar() {
    apagarFotos(enviadas.current);
    enviadas.current = [];
    aoFechar();
  }

  async function enviarFoto(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEnviandoFoto(true);

    const extensao = arquivo.name.split(".").pop()?.toLowerCase() || "jpg";
    const caminho = `pecas/${crypto.randomUUID()}.${extensao}`;
    const { error } = await supabase.storage.from("fotos").upload(caminho, arquivo);

    if (error) toast.error(error.message);
    else {
      enviadas.current.push(caminho);
      setForm((f) => ({ ...f, foto: caminho }));
    }
    setEnviandoFoto(false);
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);

    const dados = { foto: form.foto || null };
    for (const c of TEXTOS) {
      let v = (form[c] || "").trim();
      if (c === "codigo" || c === "local" || c === "unidade") v = v.toUpperCase();
      dados[c] = v;
    }
    for (const c of NUMEROS) dados[c] = num(form[c]);

    // O saldo de uma peça já cadastrada só muda por entrada ou baixa, para o
    // histórico continuar explicando o número que está na tela.
    const entradaInicial = peca?.id ? 0 : dados.quantidade;
    if (peca?.id) delete dados.quantidade;
    else dados.quantidade = 0;

    const consulta = peca?.id
      ? supabase.from("pecas").update(dados).eq("id", peca.id)
      : supabase.from("pecas").insert(dados);

    let { data, error } = await consulta.select().single();

    // A quantidade digitada no cadastro entra como a primeira movimentação.
    if (!error && entradaInicial > 0) {
      const movimento = await supabase.rpc("movimentar", {
        p_peca: data.id,
        p_tipo: "entrada",
        p_quantidade: entradaInicial,
        p_obs: "Cadastro inicial",
        p_responsavel: "",
      });
      if (movimento.error) toast.error(`Peça cadastrada, mas a entrada falhou: ${movimento.error.message}`);
      else data = movimento.data;
    }

    setSalvando(false);
    if (error) return toast.error(error.message);

    const anterior = peca?.foto || null;
    apagarFotos([
      ...enviadas.current.filter((c) => c !== data.foto),
      anterior !== data.foto ? anterior : null,
    ]);
    enviadas.current = [];

    aoSalvar(data, peca?.id ? "Peça atualizada." : "Peça cadastrada.");
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="p-0">
        <DialogHeader>
          <DialogTitle>{peca?.id ? "Editar peça" : "Nova peça"}</DialogTitle>
          <DialogDescription>
            Descrição e aplicação são o que a equipe procura no dia a dia.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={salvar} className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          <Campo label="Código" valor={form.codigo} onChange={set("codigo")} />
          <Campo
            label="Descrição da peça"
            valor={form.descricao}
            onChange={set("descricao")}
            span={3}
            obrigatorio
          />

          <Campo label="Aplicação (modelo/chassi)" valor={form.aplicacao} onChange={set("aplicacao")} span={2} />
          <Campo label="Marca" valor={form.marca} onChange={set("marca")} />
          <Campo label="Categoria" valor={form.categoria} onChange={set("categoria")} />

          <Campo label="Unidade" valor={form.unidade} onChange={set("unidade")} />
          <Campo label="Prateleira" valor={form.local} onChange={set("local")} />
          <Campo label="Fornecedor" valor={form.fornecedor} onChange={set("fornecedor")} span={2} />

          <Campo
            label={peca?.id ? "Em estoque" : "Quantidade inicial"}
            valor={peca?.id ? Number(peca.quantidade) : form.quantidade}
            onChange={set("quantidade")}
            tipo="number"
            travado={!!peca?.id}
            ajuda={peca?.id ? "Mude pela entrada ou baixa" : "Entra como a primeira movimentação"}
          />
          <Campo label="Estoque mínimo" valor={form.minimo} onChange={set("minimo")} tipo="number" />
          <Campo label="Custo (R$)" valor={form.custo} onChange={set("custo")} />
          <Campo label="Venda (R$)" valor={form.preco} onChange={set("preco")} />

          <div className="col-span-2 sm:col-span-4">
            <Label htmlFor="foto" className="etiqueta">
              Foto
            </Label>
            <div className="mt-2 flex items-center gap-3">
              <Button type="button" variant="outline" size="sm" asChild>
                <label htmlFor="foto" className="cursor-pointer">
                  {enviandoFoto ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                  {form.foto ? "Trocar foto" : "Escolher foto"}
                </label>
              </Button>
              <input id="foto" type="file" accept="image/*" onChange={enviarFoto} className="sr-only" />
              {form.foto && !enviandoFoto && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Check className="size-3.5" /> foto anexada
                </span>
              )}
            </div>
          </div>

          <DialogFooter className="col-span-2 -mx-5 -mb-5 mt-1 sm:col-span-4">
            <Button type="button" variant="outline" onClick={fechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando || enviandoFoto}>
              {salvando && <Loader2 className="animate-spin" />}
              {salvando ? "Salvando..." : "Salvar peça"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ label, valor, onChange, tipo = "text", span = 1, obrigatorio, travado, ajuda }) {
  const id = label.toLowerCase().replace(/\W+/g, "-");
  const cols = { 1: "col-span-1", 2: "col-span-2", 3: "col-span-2 sm:col-span-3" };
  return (
    <div className={cols[span]}>
      <Label htmlFor={id} className="etiqueta">
        {label}
      </Label>
      <Input
        id={id}
        type={tipo}
        value={valor ?? ""}
        onChange={onChange}
        required={obrigatorio}
        disabled={travado}
        inputMode={tipo === "number" ? "decimal" : undefined}
        className="mt-1.5"
      />
      {ajuda && <p className="mt-1 text-[0.6875rem] text-muted-foreground">{ajuda}</p>}
    </div>
  );
}
