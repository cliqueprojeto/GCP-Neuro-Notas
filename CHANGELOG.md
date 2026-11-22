# Histórico de versões

## 1.0.0 — primeira versão

Primeira versão pública do **GCP Notas**.

### Escrita e organização
- Editor de blocos com comando `/`, barra de formatação, menu flutuante, tabelas, listas de tarefas, listas recolhíveis, destaques, código com realce de sintaxe, imagens, galerias, YouTube, emojis, stickers e ícones.
- Blocos interativos: **enquetes**, **sorteios** (nomes ou números) e **formulários** com exportação CSV e conversão em base de dados.
- Páginas aninhadas com arrastar e soltar, favoritos, capas, ícones, tags, lixeira, histórico de versões, diário do dia e central de tarefas.
- Links `[[entre páginas]]`, backlinks, menções sem link, notas relacionadas e **grafo de ideias**.

### Bases de dados e BI
- 15 tipos de propriedade (incluindo status, senha com gerador, avaliação e progresso) e visualizações de tabela, Kanban, galeria, calendário e lista, com filtros e ordenação.
- Relatórios BI com 10 tipos de gráfico, séries, cálculos, filtros e paletas/cores personalizadas.

### Quadro
- Modo Quadro em qualquer página: caneta, borracha, molduras, formas, textos, notas adesivas, imagens, páginas incorporadas e conectores retos/cotovelo/curvos.

### IA (opcional)
- Claude, OpenAI, Gemini, Mistral, Groq, DeepSeek, Grok, OpenRouter, Ollama e APIs compatíveis, com **detecção automática do melhor modelo**.
- Assistente "segundo cérebro" que responde citando as notas; ações de escrita no editor; sugestão de título e tags; pacote de contexto para outras IAs.

### Segurança, backup e compartilhamento
- Cofre com senha mestra (Argon2id) e páginas cifradas com XChaCha20-Poly1305 em SQLite interno; chave de recuperação; bloqueio automático.
- Backup e sincronização criptografados no Google Drive e OneDrive; backup em arquivo com senha; compartilhamento `.gcpshare` protegido por senha.
- Exportação para impressão, PDF, Word, PowerPoint (gráficos nativos), Excel, Markdown e HTML; importação de Markdown/Obsidian.

### Interface
- 12 temas premium claros e escuros, português/inglês/espanhol com detecção automática, assistente inicial, paleta de comandos e atualizações dentro do aplicativo com verificação SHA-256.
- Instaladores para Windows, macOS (Intel e Apple Silicon), Debian/Ubuntu (.deb), Fedora/openSUSE (.rpm) e Arch/Manjaro (.pkg.tar.zst).
