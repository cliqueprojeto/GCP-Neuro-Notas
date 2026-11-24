# Histórico de versões

## 1.9.0 — IA que edita a página, busca na página, capas com IA, Kanban premium e app mais leve

- **A IA edita a página aberta**: no painel "Perguntar à IA", com "Pode editar esta página" ligado, peça mudanças como "normalize as tabelas", "troque estes dados na página" ou "corrija as datas". A IA explica o que mudou e mostra a proposta, com prévia. Você escolhe **Aplicar na página** e pode **Desfazer**. Imagens e blocos especiais são preservados.
- **Capas**: os botões "Trocar capa" e "Remover" não somem mais ao passar o mouse; ficam no topo da capa. Novo **editor de capa** com proporção (5:1, 4:1, 3:1, 16:9 ou original), zoom e posição arrastando a imagem; a capa é salva já recortada e leve. Novo **Gerar capa com IA** (OpenAI, Google Gemini ou OpenRouter, com a sua chave).
- **Localizar na página** (Ctrl+F ou lupa na barra): destaca todas as ocorrências (sem diferenciar acentos), com próximo e anterior e **filtros** por títulos, tabelas, imagens, links, tarefas, layouts e botões, mídia e anexos, destaques e citações, com lista de resultados clicável.
- **Sincronização mais leve e configurável**: em Configurações → Backup e sincronização, escolha quando enviar as alterações (5 s, 30 s, 1, 5 ou 15 minutos, ou só ao sair). As edições vão juntas num envio só. A nuvem na barra superior fica **laranja** quando há algo pendente, com o tempo até o próximo envio. **Ao fechar o app no computador** com alterações não enviadas, ele sincroniza antes e avisa; sem internet, pergunta se pode fechar mesmo assim.
- **App mais rápido ao digitar**: a barra lateral, o topo, as notificações, o painel de IA e a paleta de comandos não são mais recalculados a cada pausa na digitação, só quando muda a estrutura (títulos, ícones, posição). As ligações e notas relacionadas da página também deixaram de ser recalculadas a cada letra.
- **Kanban**:
  - Os cartões mostram **ícones do que têm dentro**: descrição, comentários, subtarefas feitas/total, anexos e prazo colorido (Atrasado, Hoje, Concluído).
  - **Cor do cartão** como faixa no topo ou cartão colorido, com cores prontas, **gradientes premium** e cor personalizada (código, conta-gotas e paleta).
  - **Fundo do quadro** com imagem própria, cores sólidas, gradientes abstratos ou cor personalizada.
  - **Modelos de cartão**: salve um cartão como modelo com nome e crie cartões a partir dele pelo ícone de modelos no topo de cada lista ou em **Templates → Modelos de cartão**.
  - **Copiar ou mover cartão** para qualquer quadro e lista, escolhendo a posição e o que manter (subtarefas, etiquetas, comentários, anexos e descrição). Os campos são casados pelo nome, e os que faltam são criados no destino.
- **Menus que fecham direito**: "Adicionar campo ao cartão" e os outros menus dentro de janelas fecham ao clicar fora ou no próprio botão de novo. O Esc fecha só o menu de cima, sem fechar o cartão.

## 1.8.5 — Links de página em cartões e botões, colunas com borda e fundo, Neuro Links lembra a visualização

- **Links de página personalizáveis**: passe o mouse sobre um link e clique no pincel para escolher a aparência: **etiqueta**, **texto**, **botão** ou **cartão com prévia** (ícone, faixa colorida e o começo do texto da página). Também dá para escolher a cor (prontas, código, conta-gotas ou paleta do designer), mostrar ou esconder o ícone da página e **aplicar a todos os links do bloco** de uma vez, por exemplo de uma coluna inteira.
- **Colunas com borda e fundo próprios**: no botão "Layout", o novo quadrado abre um painel com tipo de borda (sólida, tracejada, pontilhada ou dupla), espessura, cor, fundo com intensidade e arredondamento dos cantos. Vale para cada coluna ou para o bloco inteiro.
- **Ícones de layout redesenhados**: miniaturas retas e nítidas, com a proporção real das colunas, no lugar dos desenhos ovais.
- **Neuro Links lembra a visualização**: filtros (hierarquia, sugestões, similares, tags e páginas soltas), "Tipo/Grupos", a busca e o foco ficam salvos e voltam iguais ao reabrir, até você mudar.

## 1.8.4 — Ícones com imagem do computador e menu de tom de pele legível

- **Ícone com imagem própria**: a escolha de ícone ganhou a aba **Imagem**. Dá para escolher um arquivo do computador ou do celular (PNG, JPG, SVG, ICO, GIF ou WebP), arrastar ou colar com Ctrl+V. As imagens usadas ficam em "Minhas imagens" para usar de novo e sincronizam entre aparelhos. Vale para páginas, pastas de apresentações, botões, cartões, modelos e bases.
- **Tom de pele dos emojis**: o menu deixou de ficar transparente por cima dos emojis. Agora tem fundo sólido na cor do tema, claro ou escuro.

## 1.8.3 — Notion: importação completa (API e .zip) e fim da tela branca

- **Correção da tela branca** ao clicar em "Importar do Notion": a lista de páginas era recarregada sem parar até travar o app. Agora carrega uma vez e mostra o erro na própria janela, se houver.
- **Conectar leva ao próximo passo**: depois de validar o token, a janela para escolher o que importar abre sozinha, e o nome do espaço do Notion fica salvo. "Sincronizar agora" sem nada importado abre essa mesma escolha, com a opção "Selecionar tudo".
- **Importação e sincronização mais completas pela API**: imagens, PDFs, arquivos, áudios e vídeos enviados ao Notion ficam salvos dentro da página (os links do Notion expiram em 1 hora), além da capa da página, de colunas lado a lado, das bases de dados dentro de páginas e do conteúdo de cada registro das bases (nas notas da linha).
- **Novo: importar o .zip exportado pelo Notion** (Configurações → Backup → Notion), em HTML ou Markdown e CSV, com subpáginas. Funciona sem conectar. Vêm a árvore de páginas, as bases com colunas e tipos (seleção com cores, múltipla seleção, data, número, caixa de seleção, link e e-mail), o conteúdo de cada registro, imagens, arquivos, capa, ícone, listas de tarefas, destaques, toggles, colunas, tabelas, cores e os links entre páginas. Exportações grandes divididas em vários .zip dentro do .zip também funcionam.
- **Proteção contra tela branca**: se alguma tela der erro, aparece um aviso com "Tentar de novo" e "Início", e o resto do app continua funcionando.

## 1.8.2 — Fontes, cores personalizadas, texto justificado e cópia para o Word

- **Android (celular e tablet)**: pressionar e segurar não abre mais o menu do app nas páginas e tabelas. O toque longo volta a ser do sistema, para selecionar, copiar e colar. Os menus continuam no ícone de cada linha. No computador nada muda.
- **25 fontes embutidas** (funcionam sem internet em todos os instaladores): Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Nunito, Source Sans 3, Raleway, Work Sans, Lora, Merriweather, Playfair Display, EB Garamond, Libre Baskerville, Crimson Pro, Atkinson Hyperlegible, Lexend e OpenDyslexic (leitura fácil e dislexia), JetBrains Mono, Fira Code, Source Code Pro, IBM Plex Mono, Caveat e Patrick Hand. A fonte pode ser escolhida em Configurações → Editor e em cada página, no menu "⋯".
- **Tamanhos de 10 a 36 px** em Configurações → Editor.
- **Justificar texto**: além de alinhar à esquerda, centralizar e alinhar à direita, agora dá para justificar, inclusive dentro das tabelas. O alinhamento também está na barra fixa do editor.
- **Cores personalizadas**: no botão "+" colorido dos seletores de cor (cor do texto, marca-texto, cor da célula, quadros e apresentações) dá para digitar o código da cor (#RRGGBB ou rgb), usar o seletor ou o **conta-gotas** para pegar qualquer cor da tela, e salvar na **paleta do designer**. A paleta aparece em todos os seletores e sincroniza entre aparelhos.
- **Copiar para o Word, Google Docs ou e-mail**: a formatação continua a mesma, mas o texto claro dos temas escuros vira preto e os fundos escuros saem. As cores escolhidas para o texto são mantidas.

## 1.8.1 — Aviso de atualização sempre com a versão mais nova

- O app procura versão nova ao abrir, **ao voltar para ele** e a cada 3 horas. No Android, onde o app fica aberto em segundo plano por horas, o aviso da versão nova agora aparece sem precisar fechar o app.
- Ao abrir o aviso, o app confere de novo no GitHub e, se já houver uma versão ainda mais nova, baixa direto ela. Antes, um aviso antigo podia levar à versão anterior.

## 1.8.0 — Sincronização automática entre aparelhos

- **Aparelhos espelhados sozinhos**: com o Google Drive (ou OneDrive) conectado, cada alteração é enviada em segundos e os outros aparelhos da mesma conta recebem ao abrir o app, ao voltar para ele, ao reconectar à internet e a cada 30 segundos. Não é mais preciso fazer backup e restaurar para passar do computador para o celular. Pode ser desligado em Configurações → Backup e sincronização.
- **Tudo sincroniza**: textos, imagens, áudios e vídeos dentro das páginas, quadros, apresentações, bases de dados, conversas da IA, lixeira, e também as configurações compartilhadas (IA, e-mail, modelos, editor). A conexão com a nuvem continua sendo de cada aparelho.
- **Correção**: alterações dentro de páginas que já existiam (e imagens inseridas nelas) podiam ser perdidas, porque abrir uma página no outro aparelho a marcava como editada e a versão antiga vencia. Agora só edições de verdade contam, e um quadro aberto na tela recebe na hora o que chega do outro aparelho.
- **Indicador na barra superior**: nuvem verde quando está tudo sincronizado; clique para sincronizar na hora. Sem internet, ele espera e envia quando voltar.
- **Restaurar sem pedir senha de novo**: backups do mesmo cofre são restaurados sem senha, e a senha de login continua a mesma. Num aparelho novo, a senha pedida é a mesma usada para entrar, e dá para importar a configuração do Google direto na tela de restauração.
- **Temas escuros**: o dock e o zoom do quadro e da apresentação ficam sempre legíveis, mesmo sobre fundo claro.
- **Android em pé**: a barra de zoom da apresentação não fica mais por cima da barra de ferramentas.

## 1.7.2 — E-mail: ajuda clara quando o provedor recusa o envio

- Quando o envio falha, o app explica o motivo e mostra o passo a passo no lugar da mensagem técnica: **senha de app do Gmail** (erro 534/5.7.9), usuário ou senha recusados, bloqueio de SMTP na Microsoft, falha de conexão, erro de TLS e remetente não autorizado — com botão direto para a página certa do Google ou da Microsoft e "Tentar de novo".
- Com Gmail selecionado, um aviso explica que é preciso usar senha de app e leva à página de criação.
- Espaços das senhas de app (como o Google exibe, "abcd efgh ijkl mnop") são removidos automaticamente.

## 1.7.1 — Google Drive passo a passo, sem verificação e sem dividir cota

- **Tutorial ilustrado atualizado** (Configurações → Backup e sincronização → Passo a passo do Google) para a nova Google Auth Platform: novas etapas **Acesso a dados** (escopos não confidenciais) e **Branding** (links de página inicial, Política de Privacidade e Termos, com botões de copiar), publicação "Em produção" sem verificação do Google.
- **Compartilhar com pessoas próximas**: exporte a configuração do Google em um arquivo e envie a quem confia; a pessoa importa em um clique. Cada um mantém o próprio Drive e o próprio cofre.
- **Guia no GitHub**: [docs/GOOGLE-DRIVE.md](docs/GOOGLE-DRIVE.md), com as mesmas telas (dados de exemplo, nenhum dado real).
- **Política de Privacidade** e **Termos de Uso** publicados (PT, EN, ES).

## 1.7.0 — Notificações, arquivo, automações, e-mail sem servidor e IA com anexos

- **Central de notificações** (sino no topo, com contador): abas **Pendentes**, **Resolvidas** e **Alertas**; prazos atrasados, de hoje e próximos, lembretes e temporizadores esgotados. Resolver conclui a tarefa, reabrir volta ao início, adiar lembra amanhã às 9h, e um clique abre o cartão certo.
- **Notificações do sistema** no Windows, macOS, Linux e Android, verificadas a cada minuto, sem servidor.
- **E-mail sem servidor**: o app envia direto pelo SMTP do seu provedor (Gmail, Outlook, Yahoo, Zoho, Locaweb, Hostinger…) com senha de app guardada no cofre criptografado; resumo de alertas por e-mail e e-mail de teste. Na versão web, abre o seu app de e-mail com a mensagem pronta.
- **Lembretes** em cartões (data e hora) e **arquivar/desarquivar** cartões (filtro "Arquivados") e páginas (nova tela **Arquivo** na barra lateral).
- **Automações nas bases**: quando um status muda, uma caixa é marcada ou um registro é criado → notificar, enviar e-mail, preencher campo ou arquivar.
- **IA com anexos**: anexe PDF, imagens, planilhas (XLSX/CSV), Word, PowerPoint, Markdown, JSON e textos — imagens e PDF vão no formato nativo (Claude, Gemini, OpenAI), o resto é lido no próprio aparelho. Arraste e solte no painel.
- **Segundo cérebro ligado a projetos**: ligue a conversa a projetos, páginas, bases, quadros e apresentações; eles (e as subpáginas) entram no contexto da IA, e a conversa salva vira um neurônio ligado a eles no Neuro Links.
- **Enviar respostas para páginas**: escolha qualquer página para receber a resposta ou coloque-a como nota no quadro aberto.

## 1.6.0 — Bases de dados dentro da página, Neuro Links neural e temas premium

- **Base de dados na página** (`/base de dados na página`): escolha a visão com prévia ilustrada (Tabela, Quadro, Galeria, Lista, Calendário, Cronograma, Gantt, Mapa ou Anexos) ou mostre uma base que já existe; os dados ficam editáveis ali mesmo, com abas de visões, filtros, Kanban e cartões completos.
- **Menu de opções da base** (estilo Notion): transformar em página, editar ícone, favoritar, **bloquear base de dados**, renomear, mesclar com CSV/planilha, abrir como página, copiar link, duplicar, mover para outra página, mover para a lixeira, pedir à IA e data da última edição.
- **Gerenciador de visões** com miniaturas de cada tipo.
- **Neuro Links** com visual de rede neural: páginas são neurônios com dendritos e brilho, ligações são axônios curvos com botões sinápticos e impulsos elétricos que percorrem as conexões (respeita "reduzir movimento" do sistema).
- **Sinapses (conexões livres)**: ligue qualquer página a qualquer outra, fora da hierarquia — inclusive projetos de raízes diferentes —, pelo painel ("Conectar", "Conectar a…") ou com Shift + arrastar entre neurônios; desfaça quando quiser.
- **Campo Neuro Links nas bases**: cada tarefa ou registro pode apontar para páginas e projetos, e essas ligações aparecem no grafo.
- **Temas premium** com estrutura própria, não só cores: Nebula Glass, Carbon Flat, Emerald Soft, Noir Editorial e Cyber Mesh (escuros); Cloud Glass, Swiss Flat, Porcelain Soft, Paper Editorial e Peach Mesh (claros) — vidro fosco, plano de alto contraste, suave com sombras, editorial com títulos serifados e malha vibrante.
- **Tema personalizado**: base clara ou escura, cores de fundo, painéis, texto e destaques, cantos e estrutura.

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
