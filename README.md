# Catálogo de peças — Reformadora de Chassis

Portal para achar peça: código, aplicação, marca, fornecedor e preço. O catálogo é alimentado com os arquivos que os fornecedores mandam, do jeito que eles mandam.

**React 19 + Next.js 15** (na Vercel) + **Supabase** (banco Postgres, login e fotos) + **GitHub**. Tudo em plano gratuito.

Interface em **shadcn/ui**: componentes acessíveis do Radix, estilizados com **Tailwind 4** e ícones **Lucide**. Os componentes ficam em `components/ui/` — são seus, dá para abrir e editar qualquer um.

---

## O catálogo

A tela inicial é a busca. Digitou, achou: a lista inteira está no navegador e filtra a cada tecla, com o pedaço que casou grifado de amarelo.

A busca perdoa o jeito que cada um digita:

- **acento e caixa não importam** — `cuica` acha `Cuíca`;
- **começo de palavra basta** — `amort` acha `amortecedor`;
- **pontuação de código some** — `ab123` acha `AB-12/3`, e `1721` acha o chassi `1.721`;
- **vários termos se cruzam** — `mola 1721` casa a peça na descrição e o modelo na aplicação ao mesmo tempo;
- **erro de digitação ainda acha** — `amortcedor` acha `amortecedor`, e a tela avisa que o resultado é aproximado, para você saber que aquilo foi um palpite;
- **a ordem tem critério** — código exato vem antes de palavra inteira, que vem antes de pedaço no meio do texto.

Ao lado da busca ficam três filtros montados a partir do próprio catálogo: fornecedor, marca e categoria. Eles somam com a busca, e o botão de download leva para o Excel exatamente o que está na tela.

---

## Quem entra no portal

Um link, mandado no grupo da oficina. É só isso.

A primeira conta criada é a dona do portal e entra direto. De dentro, ela copia o **link de convite** e manda para a equipe; quem abre o link se cadastra sozinho e já está dentro. Ninguém decora código, ninguém aprova ninguém, e não existe passo no painel do Supabase.

O link é o que separa a equipe do resto da internet, e por isso ele é sorteado pelo banco — 24 caracteres aleatórios que ninguém adivinha — e só aparece para quem já é da equipe. Se alguém sai da oficina, um clique em *Gerar link novo* mata o antigo na hora.

Por que existe alguma barreira, já que você queria simples: a chave que o navegador usa é **pública por natureza** — está no código da página, qualquer um lê. Com o cadastro totalmente aberto, quem achasse o endereço criaria uma conta e leria seu catálogo inteiro, com custo e margem. Com o convite, criar conta sem ele produz uma conta que não enxerga **nada** — porque as permissões do banco não perguntam "você está logado?", perguntam **"você é da equipe?"**.

E é a resposta a essa pergunta que libera peça, movimentação e foto — não uma verificação na tela, que qualquer pessoa contornaria falando direto com o banco.

---

## Como as peças ficam organizadas

Duas tabelas, e uma regra no meio delas:

- **`pecas`** — o catálogo: código, descrição, aplicação (modelo do chassi), marca, categoria, unidade, fornecedor, custo e venda; e mais o que é da oficina — prateleira, saldo, mínimo e foto.
- **`movimentacoes`** — toda entrada e saída, com motivo (OS ou veículo), responsável e data. O saldo da peça nunca é digitado à mão: ele é resultado do que entrou menos o que saiu.
- **`movimentar()`** — a função no banco que faz as duas coisas na mesma transação. Ou o saldo muda **e** a movimentação é gravada, ou nada acontece. Duas pessoas dando baixa ao mesmo tempo não se sobrescrevem, e saída maior que o saldo é recusada pelo próprio banco.

Essa é a diferença que importa num estoque: o histórico sempre explica o saldo.

Por isso o campo de quantidade só é editável no **cadastro** da peça — e o número digitado ali entra como a primeira movimentação, com o motivo "Cadastro inicial". Depois disso, o saldo muda por **Entrada** ou **Baixa**, nunca por digitação. Na tela de editar, ele aparece travado.

---

## Passo 1 — Supabase

1. Entre em `supabase.com` com sua conta do GitHub → **New project**.
2. Nome `estoque-chassis`, região **South America (São Paulo)**, e defina a senha do banco (guarde num lugar seguro — você quase não vai usar).
3. Espere ~2 minutos enquanto o banco sobe.
4. No menu lateral, abra o **SQL Editor** → **New query** → abra o arquivo `supabase/schema.sql` deste projeto, cole o conteúdo inteiro e clique em **Run**.

Isso cria as tabelas, as funções, os índices de busca, as permissões e o depósito de fotos, de uma vez.

O arquivo pode ser colado de novo sempre que mudar: nada é apagado e nenhum dado se perde. **Se o portal já está no ar, rode de novo agora** — a importação de catálogo depende da versão atual deste arquivo.

## Passo 2 — A equipe

Não tem passo. Sério: você não cria usuário para ninguém e não define senha de oficina nenhuma.

Em **Authentication → Providers → Email**, desligue só o **Confirm email** — sem isso, cada pessoa que se cadastrar precisaria caçar um e-mail de confirmação antes de usar o portal.

Depois é assim:

1. **Você abre o portal e clica em *Criar meu acesso*.** A primeira conta criada é a dona e entra direto — não há a quem pedir convite ainda.
2. **Dentro do portal, clique no ícone de convidar**, no topo. Aparece um link. Copie, ou toque em *Compartilhar* e mande direto no grupo do WhatsApp.
3. **Cada pessoa abre o link, preenche nome, e-mail e senha, e já está dentro.** Ninguém digita código, ninguém espera aprovação, você não faz nada.

**Para tirar alguém:** apague a linha dela em **Table Editor → `equipe`** (a conta continua existindo, mas não enxerga mais nada) e clique em *Gerar link novo* no portal — o link antigo morre na hora, e quem já entrou continua dentro.

## Passo 3 — Chaves

**Project Settings → API.** Copie dois valores:

- `Project URL`
- `anon public` (nos projetos novos aparece como **Publishable key**, começando em `sb_publishable_`)

Essas chaves são públicas por natureza — elas ficam visíveis no navegador. Quem protege os dados é o **RLS**, ativado no `schema.sql`: sem login válido, a chave não lê nada. A chave `service_role` é a perigosa: **essa nunca sai do painel do Supabase.**

## Passo 4 — Rodar na sua máquina

```bash
npm install
cp .env.example .env.local
```

Preencha `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

```bash
npm run dev
```

Abra `http://localhost:3000` e entre com um dos usuários do passo 2.

> O `npm install` também copia o leitor de PDF para `public/pdf.worker.min.mjs` (é o `scripts/copiar-worker.mjs`, que roda sozinho). O arquivo fica fora do Git porque vem da biblioteca; na Vercel ele é gerado no build, sem configuração nenhuma.

## Passo 5 — GitHub

```bash
git init
git add .
git commit -m "portal de estoque"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/estoque-chassis.git
git push -u origin main
```

O `.gitignore` já mantém o `.env.local` fora do commit.

## Passo 6 — Vercel

1. `vercel.com` → entrar com o GitHub → **Add New → Project** → importe o repositório.
2. Em **Environment Variables**, cole as duas variáveis do `.env.local`.
3. **Deploy**. Em cerca de um minuto o portal está no ar num endereço `.vercel.app`.

A partir daí, cada `git push` publica sozinho. Se quiser um domínio próprio (`estoque.suaempresa.com.br`), é só apontar em Settings → Domains.

---

## O que o portal faz

- **Busca que perdoa** — descrita lá em cima. A tecla `/` põe o cursor na busca, `Esc` limpa.
- **Alimentar o catálogo** — Excel, PDF, Word, CSV ou OpenDocument, sem converter nada antes. Detalhado na seção seguinte.
- **Filtros do próprio catálogo** — fornecedor, marca e categoria saem do que já está cadastrado, e somam com a busca.
- **Exportar CSV** — o botão de download baixa exatamente o que está na tela, num arquivo que o Excel em português abre com um duplo clique.
- **Sincronia entre os computadores** — peça cadastrada no balcão aparece na tela da oficina sem ninguém recarregar a página.
- **Fotos** — enviadas do celular direto para o depósito privado do Supabase, com link temporário para exibição. Trocar a foto ou excluir a peça apaga o arquivo antigo, então o depósito não incha com imagens sem dono.
- **Catálogo grande** — a lista é lida do banco de mil em mil, sem teto, e a tela desenha 60 cartões por vez com um *mostrar mais* no fim. Buscar entre milhares de peças continua instantâneo.
- **Feito para o celular** — a tela funciona de pé no meio do galpão, com alvos grandes e números em fonte monoespaçada.

## Dois avisos sobre o plano gratuito

1. **Projeto pausa com 7 dias sem uso.** Se a oficina usar o portal todo dia, isso nunca acontece. Se acontecer, um clique no painel reativa e nenhum dado se perde.
2. **Faça backup.** O plano gratuito não guarda cópias automáticas. Uma vez por mês, limpe a busca e clique no botão de download: sai o catálogo inteiro em CSV. Leva 30 segundos.

---

## Alimentando o catálogo

O botão **Alimentar catálogo** recebe o arquivo do fornecedor. Não precisa converter, renomear nem arrumar coluna antes.

**O que ele lê:**

| Formato | Como |
| --- | --- |
| `.xlsx` `.xlsm` `.xls` `.ods` | todas as abas da pasta de trabalho, de uma vez |
| `.csv` `.tsv` `.txt` | separador descoberto sozinho (`;` `,` tabulação ou `\|`), e acento de arquivo antigo do Windows corrigido |
| `.pdf` | a tabela é remontada a partir da posição de cada pedaço de texto na página |
| `.docx` | as tabelas do documento; se não houver tabela, os parágrafos alinhados por tabulação |
| `.htm` `.html` | a tabela da página |

O `.doc` antigo, o RTF e foto de catálogo não dão para ler no navegador — a tela diz isso na hora, e diz o que fazer (abrir no Word e salvar como `.docx` ou PDF resolve).

**Como ele entende o arquivo.** Primeiro procura a linha de cabeçalho — a que mais parece nome de coluna e menos parece dado. Depois liga cada coluna a um campo pelo nome, tolerando acento, caixa e abreviação (`Ref`, `Cód.`, `Produto`, `Descrição`, `Aplicação`, `Fabricante`, `Un.`, `Valor Unitário`…), e escolhendo sempre o apelido mais específico: *Preço de custo* vira **custo**, não preço.

Quando o arquivo **não tem cabeçalho nenhum**, ele deduz pelo conteúdo: a coluna de texto mais longa é a descrição, a de códigos curtos com número no meio é o código, a de valores maiores é o preço. Tudo que foi deduzido aparece escrito na tela, para você conferir em vez de descobrir depois.

**Você manda mais que ele.** Antes de gravar, cada coluna aparece com uma amostra do conteúdo e um seletor: mudou o seletor, a prévia recalcula na hora. Se o arquivo veio sem coluna de fornecedor, o campo *Fornecedor* é preenchido com um palpite tirado do nome do arquivo e você corrige ali mesmo.

**Coisas de catálogo de fornecedor que ele já sabe:**

- **Linha de seção vira categoria.** Uma célula sozinha e curta no meio da tabela (`SUSPENSÃO`, `FREIO`) é entendida como categoria e passa a valer para as peças abaixo dela.
- **Cabeçalho repetido a cada página do PDF** é descartado, assim como `TOTAL`, `Página 3 de 12` e observação de rodapé.
- **Margens irregulares.** Colunas `+50%`, `+100%` e afins viram opção de preço de venda; vence a que estiver preenchida em mais linhas, e onde ela estiver vazia vale a primeira margem preenchida daquela linha.
- **Peça repetida no arquivo** — vale a última ocorrência, que é a correção mais recente. A tela diz quantas linhas caíram nessa regra.
- **Número escrito de qualquer jeito** — `R$ 1.850,00`, `1.234`, `1,5`, `(45,90)`. E `RD-1001` **não** é lido como número: código tem letra.

**O que a importação nunca toca:** saldo, estoque mínimo, prateleira e foto. Isso é da oficina, não do fornecedor. Campo que o arquivo não traz também não apaga o que já estava lá — se você preencheu a aplicação à mão e o catálogo novo vem sem ela, a sua continua.

A gravação é feita pela função `importar_pecas()` no banco, em lotes de 100 peças. Cada lote é uma transação: ou as 100 entram, ou nenhuma.

**Como uma peça é reconhecida entre uma importação e outra:** por **fornecedor + código**. Quando o catálogo não tem código, o **nome da peça** faz esse papel — senão o catálogo inteiro de um fornecedor viraria uma linha só. Essa regra está escrita duas vezes, em `lib/catalogo.js` e na função `chave_peca()` do banco, e as duas precisam continuar iguais: é ela que faz o número prometido na prévia ser o número gravado.

## Onde mora cada coisa

| Arquivo | Do que cuida |
| --- | --- |
| `lib/texto.js` | tirar acento, comparar palavra e ler número escrito de qualquer jeito |
| `lib/extrair/` | abrir arquivo: `planilha.js` (Excel/CSV/ODS/HTML), `pdf.js`, `docx.js`, e o `index.js` que despacha |
| `lib/catalogo.js` | achar cabeçalho, entender colunas, adivinhar o que não tem nome, montar as peças |
| `lib/busca.js` | índice, pontuação, tolerância a erro de digitação e realce |
| `components/ImportarCatalogo.js` | a tela de importar, com a conferência das colunas |
| `app/page.js` | o catálogo: busca, filtros e cartões |

Uma coisa a respeitar: **a regra de identidade da peça está em dois lugares** — `chave()` em `lib/catalogo.js` e `chave_peca()` no `schema.sql`. Mexeu numa, mexa na outra.

## Mexendo no visual

- **Cores, cantos e sombras** — tudo sai de `app/globals.css`. A paleta é branco, preto e amarelo: `--accent` é o amarelo, e ele só aparece onde precisa dizer alguma coisa (o que a busca achou, o filtro ligado, o aviso). `--radius` controla o arredondamento de todos os componentes de uma vez.
- **Componentes** — `components/ui/` guarda Button, Input, Card, Dialog, Sheet, Badge, Label, Skeleton e o Toaster. Nenhum vem de uma biblioteca fechada: o código é seu, e editar um arquivo muda o portal inteiro.
- **Novos componentes** — o padrão shadcn permite baixar mais quando precisar, por exemplo uma tabela ou um seletor:

  ```bash
  npx shadcn@latest add table select tabs
  ```

  O `components.json` já está configurado, então o comando coloca cada arquivo no lugar certo. O catálogo completo está em `ui.shadcn.com/docs/components`.
- **Ícones** — `lucide-react`, com mais de mil desenhos. Procure em `lucide.dev/icons`.

## Próximos passos naturais

1. Leitura de código de barras pela câmera do celular — o campo `codigo` já existe.
2. Histórico de preço por peça, para ver quanto o fornecedor subiu de uma tabela para a outra.
3. Ler catálogo escaneado (PDF que é foto) com reconhecimento de texto no navegador.
4. Vincular a baixa a uma OS de serviço, para saber o custo de peças por chassi reformado.
5. Busca no servidor (o índice `pg_trgm` já está criado) para o dia em que o catálogo passar de umas dezenas de milhares de peças e não couber mais na memória do celular.
