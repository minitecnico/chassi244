"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, UserPlus } from "lucide-react";
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

/** O convite chega pela barra de endereço, no link que a oficina mandou.
 *  Se a pessoa colar o link inteiro num campo, também vale. */
function acharConvite(texto) {
  const bruto = String(texto || "").trim();
  const naUrl = bruto.match(/[?&]convite=([^&\s]+)/);
  return (naUrl ? naUrl[1] : bruto).trim();
}

export default function Acesso() {
  // "entrar" | "primeiro" — o segundo também atende quem já criou a conta
  // e precisa só terminar de entrar na equipe
  const [modo, setModo] = useState("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [convite, setConvite] = useState("");
  const [pedirConvite, setPedirConvite] = useState(false);
  const [logado, setLogado] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // ?convite=... é lido aqui, e não pela barra de endereço do Next, para
    // a página continuar sendo estática e abrir instantânea no celular
    const daUrl = acharConvite(window.location.search);
    if (daUrl) {
      setConvite(daUrl);
      setModo("primeiro");
    }

    // Quem chega já logado é quem criou a conta e não terminou de entrar
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const { data: membro } = await supabase.from("equipe").select("id").maybeSingle();
      if (membro) return router.replace("/");

      setLogado(true);
      setNome(data.session.user.user_metadata?.nome || "");
      setModo("primeiro");
      if (!daUrl) {
        setPedirConvite(true);
        setAviso("Sua conta está criada. Falta o link de convite da oficina para liberar o acesso.");
      }
    });
  }, [router]);

  function trocarModo(novo) {
    setModo(novo);
    setErro("");
    setAviso("");
  }

  /** Troca o convite pelo acesso de verdade. */
  async function liberar() {
    const { error } = await supabase.rpc("entrar_na_equipe", {
      p_convite: acharConvite(convite),
      p_nome: nome.trim(),
    });

    if (error) {
      setErro(error.message);
      setPedirConvite(true);
      setLogado(true);
      return;
    }

    router.replace("/");
    router.refresh();
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
      if (error) setErro(explicar(error));
      else {
        const { data: membro } = await supabase.from("equipe").select("id").maybeSingle();
        if (membro) {
          router.replace("/");
          router.refresh();
        } else {
          setLogado(true);
          setPedirConvite(true);
          trocarModo("primeiro");
          setAviso("Sua conta existe, mas falta o link de convite da oficina.");
        }
      }
      setOcupado(false);
      return;
    }

    // Já tem conta e só falta o convite: não recria nada.
    if (logado) {
      await liberar();
      setOcupado(false);
      return;
    }

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
  }

  const criando = modo === "primeiro";

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-10">
      <Card className="w-full max-w-sm overflow-hidden p-0">
        <div className="faixa-risco h-1.5 w-full" />

        <form onSubmit={enviar} className="space-y-5 p-7">
          <div>
            <p className="etiqueta">CHASSI244</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
              {criando ? "Primeiro acesso" : "Catálogo"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {criando ? "Crie seu acesso ao catálogo." : "Entre com seu e-mail da oficina."}
            </p>
          </div>

          {criando && (
            <Campo
              id="nome"
              rotulo="Seu nome"
              valor={nome}
              aoMudar={setNome}
              autoComplete="name"
              autoFocus
            />
          )}

          {!logado && (
            <>
              <Campo
                id="email"
                rotulo="E-mail"
                tipo="email"
                valor={email}
                aoMudar={setEmail}
                autoComplete="username"
                autoFocus={!criando}
              />
              <Campo
                id="senha"
                rotulo="Senha"
                tipo="password"
                valor={senha}
                aoMudar={setSenha}
                autoComplete={criando ? "new-password" : "current-password"}
                ajuda={criando ? "Pelo menos 6 caracteres." : ""}
                minimo={criando ? 6 : undefined}
              />
            </>
          )}

          {criando && pedirConvite && (
            <Campo
              id="convite"
              rotulo="Link de convite"
              valor={convite}
              aoMudar={setConvite}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus={logado}
              ajuda="Cole aqui o link que a oficina te mandou."
            />
          )}

          {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}
          {aviso && !erro && <p className="rounded-md bg-accent p-3 text-sm font-medium">{aviso}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={ocupado}>
            {ocupado ? <Loader2 className="animate-spin" /> : criando ? <UserPlus /> : <LogIn />}
            {ocupado ? "Um instante..." : criando ? "Criar meu acesso" : "Entrar"}
          </Button>

          {!logado && (
            <p className="text-center text-sm">
              {criando ? "Já tem acesso? " : "Primeira vez aqui? "}
              <button
                type="button"
                onClick={() => trocarModo(criando ? "entrar" : "primeiro")}
                className="font-medium underline underline-offset-4"
              >
                {criando ? "Entrar" : "Criar meu acesso"}
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
