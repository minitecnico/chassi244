-- ============================================================
--  CHASSI244
--  Cole tudo no Supabase → SQL Editor → Run.
--  Pode rodar de novo sempre que este arquivo mudar: nada é apagado
--  e nenhum dado se perde.
-- ============================================================

create extension if not exists pg_trgm;

-- 1. PEÇAS ---------------------------------------------------
create table if not exists pecas (
  id          uuid primary key default gen_random_uuid(),
  codigo      text default '',
  descricao   text not null,
  categoria   text default '',
  aplicacao   text default '',   -- modelo do chassi / veículo
  marca       text default '',
  local       text default '',   -- prateleira
  fornecedor  text default '',
  quantidade  numeric not null default 0,
  minimo      numeric not null default 0,
  custo       numeric not null default 0,
  preco       numeric not null default 0,
  foto        text,              -- caminho do arquivo no Storage
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint quantidade_nao_negativa check (quantidade >= 0)
);

-- unidade de venda do catálogo do fornecedor: UN, PC, KG, M, JG...
alter table pecas add column if not exists unidade text not null default 'UN';

-- coluna de busca: um texto só, minúsculo, com tudo que se procura
alter table pecas drop column if exists busca;
alter table pecas add column busca text
  generated always as (
    lower(coalesce(codigo,'') || ' ' || descricao || ' ' || coalesce(categoria,'') || ' ' ||
          coalesce(aplicacao,'') || ' ' || coalesce(marca,'') || ' ' ||
          coalesce(local,'') || ' ' || coalesce(fornecedor,''))
  ) stored;

create index if not exists pecas_busca_idx on pecas using gin (busca gin_trgm_ops);
create index if not exists pecas_descricao_idx on pecas (descricao);
create index if not exists pecas_fornecedor_codigo_idx on pecas (fornecedor, codigo);

-- Identidade da peça para a importação. Catálogo de fornecedor nem sempre
-- traz código; quando não traz, o nome da peça faz esse papel — senão o
-- catálogo inteiro de um fornecedor viraria uma linha só.
-- A tela usa exatamente esta mesma regra, em lib/catalogo.js.
create or replace function chave_peca(p_fornecedor text, p_codigo text, p_descricao text)
returns text language sql immutable as $$
  select coalesce(trim(p_fornecedor), '') || '|' ||
         case when coalesce(trim(p_codigo), '') <> ''
              then upper(trim(p_codigo))
              else '#' || lower(trim(coalesce(p_descricao, ''))) end
$$;

create index if not exists pecas_chave_idx on pecas (chave_peca(fornecedor, codigo, descricao));

-- atualizado_em automático
create or replace function toca_atualizado_em() returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists pecas_atualizado_em on pecas;
create trigger pecas_atualizado_em before update on pecas
  for each row execute function toca_atualizado_em();

-- 2. MOVIMENTAÇÕES -------------------------------------------
create table if not exists movimentacoes (
  id          bigint generated always as identity primary key,
  peca_id     uuid not null references pecas(id) on delete cascade,
  tipo        text not null check (tipo in ('entrada','saida')),
  quantidade  numeric not null check (quantidade > 0),
  obs         text default '',      -- OS, veículo ou motivo
  responsavel text default '',
  autor       uuid default auth.uid() references auth.users(id) on delete set null,
  criado_em   timestamptz not null default now()
);

create index if not exists movimentacoes_peca_idx on movimentacoes (peca_id, criado_em desc);

-- 3. A REGRA DO NEGÓCIO -------------------------------------
-- Baixa e entrada passam por aqui. O saldo muda e o registro é gravado
-- na mesma transação: ou acontecem as duas coisas, ou nenhuma.
-- Duas pessoas dando baixa ao mesmo tempo não se sobrescrevem.
create or replace function movimentar(
  p_peca uuid,
  p_tipo text,
  p_quantidade numeric,
  p_obs text default '',
  p_responsavel text default ''
) returns pecas
language plpgsql
security invoker
as $$
declare
  atualizada pecas;
begin
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Informe uma quantidade maior que zero.';
  end if;

  update pecas
     set quantidade = quantidade + case when p_tipo = 'entrada' then p_quantidade else -p_quantidade end
   where id = p_peca
     and (p_tipo = 'entrada' or quantidade >= p_quantidade)
  returning * into atualizada;

  if not found then
    raise exception 'Saldo insuficiente para essa saída. Confira o estoque atual.';
  end if;

  insert into movimentacoes (peca_id, tipo, quantidade, obs, responsavel)
  values (p_peca, p_tipo, p_quantidade, coalesce(p_obs,''), coalesce(p_responsavel,''));

  return atualizada;
end $$;

-- 3b. IMPORTAÇÃO DO CATÁLOGO DO FORNECEDOR -------------------
-- A tela lê o arquivo (Excel, PDF, Word, CSV) e manda as peças em lotes.
-- Cada lote é uma transação só. O que o arquivo traz, entra; o que ele não
-- traz, fica como está. Quantidade, estoque mínimo, prateleira e foto são
-- da oficina e nunca são tocados por um catálogo de fornecedor.
create or replace function importar_pecas(itens jsonb)
returns json
language plpgsql
security invoker
as $$
declare
  v_novas int;
  v_atualizadas int;
begin
  with entrada as (
    select
      coalesce(trim(item->>'fornecedor'), '')    as fornecedor,
      upper(coalesce(trim(item->>'codigo'), '')) as codigo,
      trim(item->>'descricao')                   as descricao,
      coalesce(trim(item->>'aplicacao'), '')     as aplicacao,
      coalesce(trim(item->>'marca'), '')         as marca,
      coalesce(trim(item->>'categoria'), '')     as categoria,
      upper(coalesce(nullif(trim(item->>'unidade'), ''), 'UN')) as unidade,
      coalesce((item->>'custo')::numeric, 0)     as custo,
      coalesce((item->>'preco')::numeric, 0)     as preco,
      ord
    from jsonb_array_elements(coalesce(itens, '[]'::jsonb)) with ordinality as t(item, ord)
    where coalesce(trim(item->>'descricao'), '') <> ''
  ),
  -- a mesma peça repetida no lote: vale a última linha do arquivo
  numerada as (
    select *, chave_peca(fornecedor, codigo, descricao) as chave from entrada
  ),
  unicos as (
    select distinct on (chave) * from numerada order by chave, ord desc
  ),
  atualizadas as (
    update pecas p
       set descricao = u.descricao,
           custo     = u.custo,
           preco     = u.preco,
           -- campo que o arquivo não trouxe não apaga o que a oficina preencheu
           aplicacao = coalesce(nullif(u.aplicacao, ''), p.aplicacao),
           marca     = coalesce(nullif(u.marca, ''), p.marca),
           categoria = coalesce(nullif(u.categoria, ''), p.categoria),
           unidade   = coalesce(nullif(u.unidade, 'UN'), p.unidade)
      from unicos u
     where chave_peca(p.fornecedor, p.codigo, p.descricao) = u.chave
    returning p.id
  ),
  novas as (
    insert into pecas (fornecedor, codigo, descricao, aplicacao, marca, categoria, unidade, custo, preco)
    select u.fornecedor, u.codigo, u.descricao, u.aplicacao, u.marca, u.categoria, u.unidade, u.custo, u.preco
      from unicos u
     where not exists (
       select 1 from pecas p
        where chave_peca(p.fornecedor, p.codigo, p.descricao) = u.chave
     )
    returning id
  )
  select (select count(*) from novas), (select count(*) from atualizadas)
    into v_novas, v_atualizadas;

  return json_build_object('novas', v_novas, 'atualizadas', v_atualizadas);
end $$;

-- 4. PERMISSÕES ----------------------------------------------
-- Sem isto, a chave pública do navegador enxergaria a tabela inteira.
alter table pecas enable row level security;
alter table movimentacoes enable row level security;

drop policy if exists "equipe le pecas" on pecas;
drop policy if exists "equipe escreve pecas" on pecas;
create policy "equipe le pecas" on pecas
  for select to authenticated using (true);
create policy "equipe escreve pecas" on pecas
  for all to authenticated using (true) with check (true);

drop policy if exists "equipe le movimentacoes" on movimentacoes;
drop policy if exists "equipe escreve movimentacoes" on movimentacoes;
create policy "equipe le movimentacoes" on movimentacoes
  for select to authenticated using (true);
create policy "equipe escreve movimentacoes" on movimentacoes
  for insert to authenticated with check (true);

-- 5. FOTOS ---------------------------------------------------
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do nothing;

drop policy if exists "equipe ve fotos" on storage.objects;
drop policy if exists "equipe envia fotos" on storage.objects;
drop policy if exists "equipe apaga fotos" on storage.objects;
create policy "equipe ve fotos" on storage.objects
  for select to authenticated using (bucket_id = 'fotos');
create policy "equipe envia fotos" on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos');
-- sem isto, trocar a foto de uma peça deixa o arquivo antigo ocupando
-- espaço para sempre — e o plano gratuito tem 1 GB de depósito.
create policy "equipe apaga fotos" on storage.objects
  for delete to authenticated using (bucket_id = 'fotos');

-- 6. SINCRONIA ENTRE OS COMPUTADORES DA OFICINA --------------
-- Baixa feita no balcão aparece na tela da oficina sem recarregar.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pecas'
  ) then
    alter publication supabase_realtime add table pecas;
  end if;
end $$;
