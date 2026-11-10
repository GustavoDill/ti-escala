# TI Escala — Visualizador e Editor de Escala de Trabalho

Aplicação web moderna e containerizada construída com **Node.js + Hono (TypeScript)**, **React + Tailwind CSS** e **Supabase** (Storage + Postgres SHA-512 Auth), projetada para substituir o antigo `https://escala-calendar.onrender.com`.

---

## Principais Funcionalidades

1. **Modo Somente Leitura (Padrão)**:
   - Qualquer visitante pode visualizar a escala, filtrar por **Setor (`SETOR`)** e **Função (`FUNÇÃO`)**, buscar por nome ou matrícula e exportar relatórios.
2. **Modo Edição com Edição Inline (Protegido por Senha SHA-512)**:
   - Desbloqueado com a senha de **`administrator`** (Gestor/Chefe) ou **`system`** (Desenvolvedor).
   - Clique diretamente em qualquer célula no **Calendário**, no **Comparador de Colaboradores** ou na **Planilha/Grade (Excel)** para editar inline horários (`08:48`, `07:20`), `FOLGA`, `FÉRIAS`, `ATESTADO`, `FERIADO` ou metadados do colaborador (`Nome`, `SETOR`, `FUNÇÃO`, `ENTR`, `SAI`, intervalos).
   - Permite também adicionar/remover colaboradores, adicionar novas colunas de data (`DD/MM/AAAA`) e fazer upload de um novo `escala.csv`.
3. **Três Visualizações Integradas**:
   - **Calendário**: Visão mensal da equipe (com resumo diário de ativos, folgas e férias + painel lateral detalhado do dia) e visão **Por Colaborador** (calendário individual mensal com horários de entrada/saída, intervalo e contadores do mês).
   - **Comparar Colaboradores**: Matriz lado a lado para comparar 2 ou mais colaboradores (ou um setor inteiro), destacando sobreposições de folgas/férias e a taxa de cobertura diária na linha inferior.
   - **Planilha / Grade (Excel)**: Grade com colunas fixas congeladas à esquerda, cabeçalhos ordenáveis e rolagem horizontal das datas com destaque para sábados e domingos.
4. **Exportação em PDF, XLSX e CSV**:
   - **PDF (`.pdf`)**: Relatório paisagem pronto para impressão com células coloridas por status.
   - **Excel (`.xlsx`)**: Planilha formatada com cabeçalhos congelados e cores automáticas para `FOLGA`, `FÉRIAS` e dias trabalhados.
   - **CSV (`.csv`)**: Arquivo separado por ponto e vírgula (`;`) 100% compatível com o formato original do Excel.
5. **Sincronização com Supabase Storage & Cache Efêmero**:
   - O container **não** inclui um `escala.csv` local embutido. O `escala.csv` inicial deve ser enviado manualmente para o bucket do Supabase.
   - Na inicialização do servidor Hono, o arquivo `escala.csv` é baixado do bucket do Supabase para o cache efêmero da instância (`.cache/escala.csv` + memória).
   - Caso o `escala.csv` não esteja presente no bucket, o servidor exibe uma tela de erro clara e aborta a funcionalidade principal (`503 Service Unavailable`) até que o arquivo seja enviado ao bucket.
   - Toda alteração feita no Modo Edição atualiza o cache local e envia (`upsert`) imediatamente o `escala.csv` atualizado para o bucket do Supabase.

---

## Configuração do Supabase

### 1. Criar a Tabela de Autenticação (`public.escala_auth`)
Abra o **SQL Editor** no painel do Supabase e execute o script [`sql/init_auth.sql`](./sql/init_auth.sql).

Para gerar senhas aleatórias seguras e seus respectivos hashes **SHA-512** (ou calcular o hash de uma senha específica):

```bash
# Gera senhas aleatórias para 'administrator' e 'system' + comando SQL pronto:
npm run hash-password

# Ou gera o hash SHA-512 para uma senha específica:
npm run hash-password -- "MinhaSenhaSegura123"
```

Caso alguém perca a senha futuramente, o administrador do banco pode redefini-la manualmente direto no **SQL Editor** do Supabase:

```sql
UPDATE public.escala_auth
SET password_hash = encode(digest('NOVA_SENHA_AQUI', 'sha512'), 'hex'),
    updated_at = NOW()
WHERE role = 'administrator';
```

### 2. Criar o Bucket no Supabase Storage
1. No painel do Supabase, acesse **Storage** e crie um bucket chamado `escala` (ou o nome definido em `SUPABASE_BUCKET`).
2. Faça o upload manual do arquivo inicial `escala.csv` na raiz do bucket (`escala.csv`).

---

## Variáveis de Ambiente (`.env`)

Copie `.env.example` para `.env` e preencha:

```env
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
SUPABASE_BUCKET=escala
SUPABASE_FILE_PATH=escala.csv
SUPABASE_AUTH_TABLE=escala_auth
```

---

## Executando Localmente e via Docker (Render)

```bash
# Instalar dependências
npm install

# Rodar em modo desenvolvimento (Hono API + Vite HMR)
npm run dev

# Executar testes automatizados
npm test

# Gerar build de produção
npm run build
npm start
```

### Deploy no Render (Docker)
O repositório inclui [`Dockerfile`](./Dockerfile) multi-stage e [`render.yaml`](./render.yaml) prontos para deploy no Render. Basta conectar o repositório ao Render e configurar `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` nas variáveis de ambiente do serviço.

