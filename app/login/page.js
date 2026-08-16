"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

/** O Supabase responde a mesma coisa para senha errada e para conta que não
 *  existe — de propósito, para ninguém descobrir quais e-mails estão
 *  cadastrados. Como aqui as contas são criadas à mão no painel, "não existe"
 *  é o motivo mais comum, e a mensagem precisa dizer isso. */
function explicar(erro) {
  const mensagem = erro.message || "";

  if (mensagem === "Invalid login credentials") {
    return "E-mail ou senha não conferem — ou a conta ainda não foi criada no painel do Supabase.";
  }
  if (/email not confirmed/i.test(mensagem)) {
    return "A conta existe mas não foi confirmada. No painel do Supabase, apague e crie de novo marcando Auto Confirm User.";
  }
  if (/logins are disabled|signups not allowed|provider is disabled/i.test(mensagem)) {
    return "O login por e-mail está desligado no painel do Supabase, em Authentication → Providers.";
  }
  if (/failed to fetch|network|load failed/i.test(mensagem)) {
    return "Não consegui falar com o Supabase. Confira a conexão e o endereço do projeto nas variáveis do site.";
  }
  return mensagem;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);
  const router = useRouter();

  async function entrar(e) {
    e.preventDefault();
    setEntrando(true);
    setErro("");

    // espaço colado junto do e-mail ao copiar não pode derrubar o login
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });

    if (error) {
      setErro(explicar(error));
      setEntrando(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <Card className="w-full max-w-sm overflow-hidden p-0">
        <div className="faixa-risco h-1.5 w-full" />

        <form onSubmit={entrar} className="space-y-5 p-7">
          <div>
            <p className="etiqueta">Reformadora de chassis</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Catálogo</h1>
            <p className="mt-2 text-sm text-muted-foreground">Entre com seu e-mail da oficina.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={entrando}>
            {entrando ? <Loader2 className="animate-spin" /> : <LogIn />}
            {entrando ? "Entrando..." : "Entrar"}
          </Button>

          <p className="text-xs text-muted-foreground">
            As contas são criadas no painel do Supabase, em Authentication → Users.
          </p>
        </form>
      </Card>
    </main>
  );
}
