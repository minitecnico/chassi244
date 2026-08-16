"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

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

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

    if (error) {
      setErro(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha não conferem."
          : error.message
      );
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
