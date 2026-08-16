"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, LogIn, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

/** O Supabase responde a mesma coisa para senha errada e para conta que não
 *  existe — de propósito, para ninguém descobrir quais e-mails estão
 *  cadastrados. As outras mensagens dele são em inglês; aqui viram
 *  português, e dizem o que fazer. */
function explicar(erro) {
  const mensagem = erro?.message || "";

  if (mensagem === "Invalid login credentials") {
    return "E-mail ou senha não conferem. Se é a sua primeira vez, use o primeiro acesso aqui embaixo.";
  }
  if (/user already registered|already been registered/i.test(mensagem)) {
    return "Esse e-mail já tem conta. Entre normalmente.";
  }
  if (/password should be at least/i.test(mensagem)) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (/email not confirmed/i.test(mensagem)) {
    return "Confirme o e-mail que o Supabase enviou e tente de novo.";
  }
  if (/signups not allowed|signup is disabled/i.test(mensagem)) {
    return "O cadastro está desligado no painel do Supabase, em Authentication → Providers.";
  }
  if (/logins are disabled|provider is disabled/i.test(mensagem)) {
    return "O login por e-mail está desligado no painel do Supabase, em Authentication → Providers.";
  }
  if (/failed to fetch|network|load failed/i.test(mensagem)) {
    return "Não consegui falar com o Supabase. Confira a conexão.";
  }
  return mensagem;
}

export default function Acesso() {
  // "entrar" | "primeiro" | "codigo" — o último aparece para quem já tem
  // conta mas ainda não provou que é da oficina
  const [modo, setModo] = useState("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const router = useRouter();

  // Quem chega aqui já logado é quem criou a conta e ainda não deu o código:
  // vai direto para o campo do código, sem pedir a senha de novo.
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const { data: membro } = await supabase.from("equipe").select("id").maybeSingle();
      if (membro) {
        router.replace("/");
        return;
      }
      setNome(data.session.user.user_metadata?.nome || "");
      setModo("codigo");
      setAviso("Falta o código da oficina para liberar seu acesso.");
    });
  }, [router]);

  function trocarModo(novo) {
    setModo(novo);
    setErro("");
    setAviso("");
  }

  const entrarNoPortal = () => {
    router.replace("/");
    router.refresh();
  };

  /** Já autenticado: falta saber se essa conta é da equipe. */
  async function conferirEquipe() {
    const { data } = await supabase.from("equipe").select("id").maybeSingle();
    if (data) return entrarNoPortal();
    trocarModo("codigo");
    setAviso("Falta o código da oficina para liberar seu acesso.");
  }

  async function enviar(e) {
    e.preventDefault();
    setOcupado(true);
    setErro("");
    setAviso("");

    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });
      if (error) {
        setErro(explicar(error));
        setOcupado(false);
        return;
      }
      await conferirEquipe();
      setOcupado(false);
      return;
    }

    if (modo === "primeiro") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: { data: { nome: nome.trim() } },
      });
      if (error) {
        setErro(explicar(error));
        setOcupado(false);
        return;
      }
      // Com a confirmação por e-mail ligada no Supabase, a conta nasce sem
      // sessão: não dá para liberar o acesso agora.
      if (!data.session) {
        trocarModo("entrar");
        setAviso("Conta criada. Confirme o e-mail que o Supabase enviou e entre aqui.");
        setOcupado(false);
        return;
      }
      await liberar();
      setOcupado(false);
      return;
    }

    await liberar();
    setOcupado(false);
  }

  /** Troca o código da oficina pelo acesso de verdade. */
  async function liberar() {
    const { error } = await supabase.rpc("entrar_na_equipe", {
      p_codigo: codigo.trim(),
      p_nome: nome.trim(),
    });
    if (error) {
      setErro(error.message);
      setModo("codigo");
      return;
    }
    entrarNoPortal();
  }

  const titulos = {
    entrar: { titulo: "Catálogo", texto: "Entre com seu e-mail da oficina." },
    primeiro: { titulo: "Primeiro acesso", texto: "Crie seu acesso ao catálogo." },
    codigo: { titulo: "Código da oficina", texto: "Peça o código a quem cuida do portal." },
  };

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-10">
      <Card className="w-full max-w-sm overflow-hidden p-0">
        <div className="faixa-risco h-1.5 w-full" />

        <form onSubmit={enviar} className="space-y-5 p-7">
          <div>
            <p className="etiqueta">Reformadora de chassis</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
              {titulos[modo].titulo}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{titulos[modo].texto}</p>
          </div>

          {modo === "primeiro" && (
            <Campo
              id="nome"
              rotulo="Seu nome"
              valor={nome}
              aoMudar={setNome}
              autoComplete="name"
              autoFocus
            />
          )}

          {modo !== "codigo" && (
            <>
              <Campo
                id="email"
                rotulo="E-mail"
                tipo="email"
                valor={email}
                aoMudar={setEmail}
                autoComplete="username"
                autoFocus={modo === "entrar"}
              />
              <Campo
                id="senha"
                rotulo="Senha"
                tipo="password"
                valor={senha}
                aoMudar={setSenha}
                autoComplete={modo === "primeiro" ? "new-password" : "current-password"}
                ajuda={modo === "primeiro" ? "Pelo menos 6 caracteres." : ""}
                minimo={modo === "primeiro" ? 6 : undefined}
              />
            </>
          )}

          {modo !== "entrar" && (
            <Campo
              id="codigo"
              rotulo="Código da oficina"
              valor={codigo}
              aoMudar={setCodigo}
              autoComplete="off"
              autoFocus={modo === "codigo"}
              ajuda="É a frase combinada da oficina — não é a sua senha."
            />
          )}

          {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}
          {aviso && !erro && <p className="rounded-md bg-accent p-3 text-sm font-medium">{aviso}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={ocupado}>
            {ocupado ? (
              <Loader2 className="animate-spin" />
            ) : modo === "entrar" ? (
              <LogIn />
            ) : modo === "primeiro" ? (
              <UserPlus />
            ) : (
              <KeyRound />
            )}
            {ocupado
              ? "Um instante..."
              : modo === "entrar"
                ? "Entrar"
                : modo === "primeiro"
                  ? "Criar meu acesso"
                  : "Liberar acesso"}
          </Button>

          {modo !== "codigo" && (
            <p className="text-center text-sm">
              {modo === "entrar" ? "Primeira vez aqui? " : "Já tem acesso? "}
              <button
                type="button"
                onClick={() => trocarModo(modo === "entrar" ? "primeiro" : "entrar")}
                className="font-medium underline underline-offset-4"
              >
                {modo === "entrar" ? "Criar meu acesso" : "Entrar"}
              </button>
            </p>
          )}
        </form>
      </Card>
    </main>
  );
}

function Campo({ id, rotulo, valor, aoMudar, tipo = "text", ajuda, minimo, ...resto }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input
        id={id}
        type={tipo}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        required
        minLength={minimo}
        {...resto}
      />
      {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
    </div>
  );
}
