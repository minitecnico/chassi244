"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Cliente usado no navegador. A chave é pública de propósito:
 *  quem protege os dados é o RLS do banco, não o segredo da chave. */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
