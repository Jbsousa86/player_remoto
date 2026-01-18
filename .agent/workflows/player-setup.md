---
description: Como rodar e configurar o Player Remoto
---

### 1. Instalação
Se você acabou de baixar o projeto, execute:
```bash
npm install
```

### 2. Configuração do Banco de Dados (Supabase)
1. Crie uma tabela `playlists` no Supabase com as colunas:
   - `id` (uuid)
   - `url` (text) - Link da imagem ou vídeo
   - `type` (text) - 'image' ou 'video'
   - `duration` (int) - Segundos para exibir (se imagem)
   - `order` (int) - Ordem de exibição

2. Copie os dados de API do Supabase e cole no arquivo `.env` (crie um se não existir baseado no `.env.example`).

### 3. Rodar em Desenvolvimento
Para ver o player funcionando:
```bash
npm run dev
```

### 4. Modo Full Screen
O player já está otimizado para ocupar a tela toda. No totem, basta abrir o navegador em modo quiosque ou apertar `F11`.
