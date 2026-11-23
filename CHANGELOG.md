# Histórico de versões

## 1.5.0 — Kanban completo, datas no padrão do idioma, mais contraste e novo ícone

- **Kanban**: arraste cartões entre colunas e dentro delas com o mouse ou, no celular e no tablet, segurando o cartão; o status muda sozinho. Um clique em qualquer parte do cartão abre o registro, sem a sensação de "duro".
- **Novos campos**: Texto longo, **Produtos/serviços** (itens com quantidade, valor unitário, subtotal concluído, subtotal pendente e total geral), **Subtarefas** (com progresso, data de entrega e ordem por arrastar) e **Temporizador** (progressivo ou regressivo por duração ou até uma data; ao concluir a tarefa ele para, registra o tempo e só reabre se a conclusão for desmarcada).
- **Cartão completo**: atalhos para Subtarefas, Datas, Produtos/serviços, Temporizador, Anexo e Local; "Adicionar campo ao cartão" com todos os tipos; Descrição; **Comentários** (editar e excluir) e **Todas as atividades** (histórico automático de cada mudança), em ordem crescente ou decrescente. Os cartões mostram selos de subtarefas, itens, tempo e comentários.
- **Datas no padrão do idioma do app**: em português sempre DD/MM/AAAA e 24 h, mesmo com o sistema em inglês; campo de data com digitação mascarada e calendário; "Data de hoje" por extenso; datas de arquivos e tarefas no fuso local (antes podiam virar o dia às 21h). A moeda automática também segue o idioma (PT → R$).
- **Tabelas**: ao clicar numa tabela, as ferramentas aparecem logo abaixo da barra de formatação: linhas e colunas antes/depois, **mesclar e dividir células**, cabeçalho de linha/coluna, **cor da célula** e excluir. O botão "Escrever com IA" não fica mais cortado.
- **Menu de contexto** no editor (botão direito; toque longo no celular e tablet): transformar o bloco, recortar, copiar, colar, negrito, itálico, link, melhorar com IA, inserir tabela, colunas, destaque e divisor, mover, duplicar e excluir.
- **Layouts e colunas**: a barra de opções não aparece mais só por passar o mouse; abre pelo botão "Layout" no canto do bloco e não cobre o texto acima enquanto você edita.
- **Contraste e acessibilidade**: textos secundários, ícones e botões mais escuros no tema claro e mais claros no escuro; opções com destaque ao passar o mouse; ações perigosas (como "Mover para a lixeira") em vermelho bem visível; foco visível no teclado.
- **Android em pé**: as barras do quadro (ferramentas, zoom e apresentar) ficam em linhas próprias, sem sobreposição e dentro da tela.
- **Neuro Links**: o antigo "Grafo de ideias" ganhou o novo nome e um ícone de neurônios ligados.
- **Novo ícone em todos os sistemas**: fundo branco com uma folha de nota ligada a uma rede neural, legível até em tamanhos pequenos.

## 1.4.4 — Gerador de QR Code e exportações fiéis à tela, com links clicáveis

- **QR Code** (`/qrcode`): link, texto, e-mail, telefone, SMS, WhatsApp, Wi-Fi, **Pix** (BR Code do Banco Central, com valor e identificador opcionais) e vCard; cor do código e do fundo, degradê, seis estilos de pontos, três estilos de cantos, logo central, três tamanhos, legenda, conteúdo gerado com copiar e download em PNG ou SVG.
- **PDF de documentos com o visual da tela**: blocos premium, colunas, cartões, QR Codes e capas de vídeo em papel claro; quebras de página entre blocos; título e numeração no rodapé.
- **Links clicáveis no PDF** (textos, vídeos e QR Codes) e um apêndice **"Links e referências"** com o QR Code de cada endereço — também na impressão.
- **Word (.docx)**: QR Codes como imagem clicável com legenda, vídeos do YouTube como link e colunas preservadas.
- Impressão sem controles de edição nem textos de ajuda.

## 1.4.3 — YouTube tocando na página e na apresentação, mídia no quadro e novo ícone em todos os sistemas

- **YouTube**: capa do vídeo em alta resolução com título e botão de play; o vídeo toca dentro da página. Corrigido o "Erro 153" (configuração do player): no computador o player passa por uma página local do próprio app (127.0.0.1), que envia a origem exigida pelo YouTube; no Android o player recebe a política de referência correta.
- **Apresentações**: vídeos do YouTube, áudios e vídeos gravados tocam direto no slide e nas páginas abertas por link; ao trocar de slide, a mídia do slide anterior pausa.
- **Quadro**: novo elemento **Mídia** (YouTube, áudio ou vídeo do computador), que também toca na apresentação; páginas incorporadas no quadro mostram vídeos e áudios tocáveis.
- **Ícone**: o novo ícone (folha de vidro com o cérebro neural, sem moldura) agora também no Windows, macOS e Linux, e no logotipo dentro do app.

## 1.4.2 — Colunas nas páginas, linhas editáveis e conectores contínuos na apresentação

- **Colunas e layouts** (`/colunas`, `/layout`): 2, 3, 4 ou 5 colunas, conteúdo + barra lateral (2:1 e 1:2), destaque central (1:2:1) e colunas em cartões, com ícones de layout. Barra própria para trocar a proporção, somar ou tirar colunas (o conteúdo é preservado) e escolher o estilo: simples, cartões, com borda, sombreado, destaque ou vidro. No celular as colunas viram uma pilha.
- **Linhas editáveis entre componentes**: clicar no vão entre dois blocos (tabela, base, mapa, mídia…) cria uma linha ali; clicar abaixo do texto leva ao fim da página pronto para escrever; o documento sempre termina num parágrafo editável.
- **Apresentação**: conectores que ligam elementos de slides diferentes continuam visíveis, com fluxo animado e um ponto de luz que segue para o próximo slide; o elemento do outro slide aparece em transparência até a chegada. Pontas de seta agora seguem a cor da linha em todos os sistemas (antes ficavam pretas em alguns).

## 1.4.1 — Visões sem duplicar e mapas mentais em tópicos

- **Gerenciador de visões** nas bases: cada tipo (Tabela, Quadro, Gantt, Anexos…) liga e desliga com um clique, sem criar cópias; ocultar sem perder filtros, renomear, duplicar, excluir, reordenar com setas ou arrastando (também pelas abas) e escolher a **visão padrão** (estrela) que abre primeiro.
- **Diagramas e mapas mentais** preenchidos num **editor em tópicos**: cada item com a cor do seu ramo, Enter cria, Tab/Shift+Tab mudam o nível, Alt+↑↓ reordena, botões para recuar, mover e apagar; modo Texto continua disponível para colar listas. A prévia fica fixa enquanto você edita.

## 1.4.0 — Apresentações premium, PowerPoint, diagramas e novas visões de bases

### Apresentação
- Voo contínuo entre slides (zoom e passeio com enquadramento inteligente), além de zoom suave, esmaecer e corte seco — por apresentação ou por slide, com duração.
- Conectores animados (a linha se desenha depois dos elementos), títulos animados por slide, slides automáticos por grupos quando não há molduras.
- Links abrem páginas, bases e relatórios numa tela limpa, somente leitura, com botão "Voltar à apresentação".
- Cronômetro opcional, progressivo ou regressivo, com alerta no último minuto e ao estourar o tempo.

### Apresentações
- Nova entrada fixa na barra lateral: pastas com ícone e cor, uma apresentação em várias pastas, mover, arrastar e soltar, visão em cartões ou registro, busca e apresentar com um clique.
- Novos decks com temas de fundo e slides 16:9 já enquadrados; tema de cada apresentação pelo menu do cartão.

### PowerPoint
- Exportação com formas nativas editáveis, fundo do tema (degradê ou imagem), conectores fiéis, transições e animações de entrada.
- Importação de `.pptx`: posições, tamanhos, cores do tema, fontes, negrito/itálico, alinhamento, imagens, fundos (slide, layout e mestre), grupos, tabelas, transições e animações.

### Quadro
- Banco de diagramas e mapas mentais por categoria, gerados a partir de uma lista com recuo, com paletas, estilos de forma e opção de moldura.
- Fundos: temas, padrão da grade e imagem com ponto de foco, véu e ajuste (preencher, ajustar, mosaico).
- Estilos de conector (tracejado, pontilhado, traço-ponto, serrilhado, ondulado, duplo, neon) e espessura.
- Negrito, itálico, alinhamento e tamanho de texto em notas, formas e textos; refazer; diagramas inseridos sem sobrepor o conteúdo.

### Bases de dados
- Visões Gantt (arrastar/redimensionar, escala de dias, semanas ou meses), Cronograma, Mapa e Anexos.
- Campos Arquivos e Local; tela cheia; desfazer e refazer.

### Páginas
- Blocos `/anexo` e `/mapa` (ponto A, ponto B e trajeto de carro, bicicleta ou a pé via OpenStreetMap).

### Modelos
- Plano de aula com campos dinâmicos e base de intercorrências em sala (PT/EN/ES).

### Android
- Ícone adaptativo sem bordas, que preenche qualquer formato de ícone.
- Barras do Quadro reorganizadas para não se sobreporem em celular (em pé e deitado) e tablet.

## 1.3.3 — Mídia premium, gravação de áudio e vídeo e apresentação por elemento

### Mídia nas páginas
- **Imagens** com barra rápida de tamanho (P, M, G, largura total), alinhamento, legenda, sombra e redimensionamento pela borda.
- **YouTube** com janela própria (cole o link e veja a prévia), tamanhos, alinhamento, legenda e abrir no YouTube.
- **Gravar áudio e vídeo** direto na página (`/áudio`, `/vídeo`): microfone ou câmera, pausa, tempo de gravação, ou enviar arquivo; player com os mesmos controles de tamanho.
- O comando `/` prioriza o título que começa com o que você digitou.

### Janelas do app
- Links, rótulos, senhas e confirmações agora usam janelas do próprio app — sem as caixas do sistema que mostravam "JavaScript – tauri://localhost".

### Bases de dados
- **Rodapé com cálculo por coluna**: soma, média, mediana, mínimo, máximo, amplitude, contagem, preenchidos, vazios, contagem única, % preenchido/vazio, marcados, % concluído, data mais antiga/recente — para qualquer tipo de campo, salvo por visualização.

### Quadro e apresentação
- Cada elemento tem seu painel de apresentação: efeito de entrada (com prévia), **duração**, **atraso** e **em quais slides aparece** (um, vários ou automático pela moldura).
- Corrigido: com as ferramentas de nota, texto, forma e moldura agora dá para criar elementos **dentro** de uma moldura.

### Permissões
- Microfone e câmera habilitados no Android, no macOS (mensagens de permissão) e no Linux (WebKitGTK).

## 1.3.2 — Correção

- **Templates** voltou a abrir: em cofres sem nenhum modelo próprio a tela travava o app (em todos os sistemas). O mesmo defeito foi corrigido na janela "Enviar ao Notion" e nas cores do Grafo.
- O app passa a procurar atualizações no novo endereço do repositório, **cliqueprojeto/GCP-Neuro-Notas**.

## 1.3.1 — Apagar tudo e recomeçar

- Em **Configurações › Backup e sincronização**, nova zona de perigo **Apagar tudo e recomeçar**: remove o banco de dados interno, as configurações e as preferências do aparelho e volta ao assistente inicial, como numa instalação nova.
- Janela de aviso com a lista do que será apagado, atalho para **fazer backup antes** e confirmação digitando a palavra no idioma do app (**REMOVER**, **DELETE** ou **ELIMINAR**).
- Backups já exportados e as cópias no Google Drive/OneDrive não são apagados.

## 1.3.0 — Componentes e quadro estilo Figma

### Componentes estilo site
- Bloco **Botões** (comando `/botões`): texto, ícone, estilo (degradê, sólido, suave, contorno, transparente, vidro), formato (pílula, arredondado, quadrado), tamanho, cor, largura total, alinhamento e efeitos animados (pulsar, brilho, pular, aura).
- Bloco **Cartões** (comando `/cartões`): seções estilo site com ícone, título, descrição, chamada e cor; 1 a 4 colunas; estilos vidro, sólido, contorno e degradê; efeito ao passar o mouse (elevar, inclinar 3D, aura).
- Botões e cartões levam para uma **página ou nota**, um **site** ou um **e-mail** — e os links internos aparecem no Grafo.

### Quadro estilo Figma
- **Link em qualquer elemento** (página, nota, site ou e-mail): selo de link, Ctrl+clique para abrir e clique durante a apresentação.
- Elemento **Botão** e elemento **Gráfico** (traz um gráfico dos Relatórios BI para o quadro).
- **Animações de entrada** por elemento (surgir, subir, deslizar, zoom, saltar, girar) e em loop (pulsar, flutuar, balançar), tocadas em ordem a cada slide.
- **Transições** entre slides: zoom suave, esmaecer, deslizar ou corte seco, com duração ajustável.
- Preenchimento degradê ou vidro em formas e notas.

### Grafo de ideias
- Linhas bem mais visíveis, com cores derivadas do tema; escolha das cores por tipo de ligação e da espessura.
- O grafo abre já organizado e centralizado, com as conexões à vista (no celular começa só com as páginas ligadas).

## 1.2.0 — GCP-Neuro Notas

O app passa a se chamar **GCP-Neuro Notas**, com novo ícone e o tema **Neuro**. Seus dados, a senha e as atualizações continuam os mesmos.

### Bases de dados
- Filtro por valores no estilo do Excel em cada coluna (buscar, selecionar tudo, *em branco*), ordenação rápida e chips de filtros ativos.
- Arrastar e soltar colunas e linhas; menu do botão direito (e toque longo no celular): inserir acima/abaixo, duplicar, mover, excluir; menu da coluna com inserir à esquerda/direita, mover, duplicar e ocultar.
- Novos campos: fórmula entre campos, fórmula condicional por faixa com cores, moeda com país/formato do sistema e máscara ao digitar, CPF e CNPJ com validação, telefone e CEP com máscara.
- Menu de tipos de campo com busca, grupos e ícones coloridos; troca de tipo convertendo os valores.
- Barra de progresso com controle deslizante animado; totais (soma e média) no rodapé.
- Imprimir só a tabela, exportar PDF (vetorial) e Excel; importar Excel/CSV com detecção de tipos.
- Salvar a tabela como modelo (nome, descrição, ícone e cor).

### Editor
- Alça ao lado de cada bloco: mover para cima/baixo (Alt+Shift+↑/↓), arrastar, duplicar, transformar e excluir — inclusive blocos interativos.
- Comando `/` com ícones coloridos, busca com espaços, templates prontos e modelos próprios; salvar qualquer página como modelo.

### Quadro, Grafo e Calendário
- Conectores com pontos nos 4 lados, encaixe magnético, seleção do conector, setas, rótulo, cor e pontas arrastáveis.
- Modo **Apresentar**: molduras viram slides em tela cheia, com lista e ordem dos slides.
- Página fixa **Quadros** com miniaturas.
- Grafo inteligente: ligações do quadro, sugestões de conexão com um clique, grupos, foco local e painel do nó.
- Calendário compacto fixo acima do Diário e agenda em mês, semana e dia com os detalhes dos registros.

### IA
- Conversas salvas como páginas, com histórico e retomada, ligadas no Grafo às notas citadas.
- Selecione um trecho da resposta para reescrever, resumir, traduzir ou explicar; inserir na página aberta ou salvar como nota.

### Busca, nuvem e Notion
- Filtros por tipo e por tags na busca (`#tag`).
- Logos oficiais do Google Drive e OneDrive, passo a passo ilustrado do cadastro OAuth e importação do arquivo JSON do Google.
- Integração com o **Notion**: importar páginas e bases, sincronizar de novo e enviar páginas.

### Android e telas pequenas
- O app respeita a barra de status, a barra de gestos, o entalhe e o teclado; ignora a ampliação de fonte do sistema que estourava botões; layout compacto com o celular deitado; ícones da barra de status seguem o tema.

### Correções
- Exportar PDF não falha mais com "unsupported color function".
- Listas suspensas dentro de janelas (filtros, ordenação, colunas) aplicam a escolha corretamente.

## 1.1.0 — Android

- App **Android** nativo (APK para arm64, armv7 e x86_64; Android 7.0+), gerado e assinado pelo GitHub Actions.
- Interface de celular e tablet: barra inferior com Início, Buscar, ＋ Criar, IA e Menu; folha de criação; janelas em folha deslizante; áreas seguras; alvos de toque maiores.
- Pinça com dois dedos no Quadro e botões de zoom no Grafo.
- Botão/gesto "voltar" do Android navega dentro do app e fecha painéis.
- Ações antes visíveis só com o mouse agora aparecem sempre em telas de toque.
- Exportações, backups e compartilhamentos salvos pelo seletor de arquivos nativo do Android.
- Aviso de nova versão no celular com download do APK.
- Correções: assistente inicial e login não estouram mais a largura em telas estreitas.

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
