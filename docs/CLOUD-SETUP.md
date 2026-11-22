# Configurar Google Drive e OneDrive

O GCP Notas conversa direto com o Google Drive e o OneDrive a partir do seu computador (OAuth com PKCE e retorno local em `127.0.0.1`). Não existe servidor intermediário. Para isso, o aplicativo precisa de um **ID de cliente OAuth** de cada provedor.

- **Versões oficiais** (Releases do GitHub) já saem configuradas quando os segredos abaixo estão definidos no repositório.
- **Quem compila por conta própria** pode informar os IDs em `.env` (veja `.env.example`) ou direto no app, em **Configurações → Backup e sincronização → Configuração avançada**.

## Google Drive

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie (ou escolha) um projeto.
2. Em **APIs e serviços → Biblioteca**, ative a **Google Drive API**.
3. Em **Tela de consentimento OAuth**, escolha *Externo*, preencha nome do app e e-mail e adicione o escopo `.../auth/drive.appdata` (escopo **não sensível**: não exige verificação do Google).
4. Em **Credenciais → Criar credenciais → ID do cliente OAuth**, escolha o tipo **App para computador** (*Desktop app*).
5. Copie o **ID do cliente** e a **chave secreta do cliente**.
   - Em apps para computador, o Google trata essa "chave secreta" como pública; a segurança vem do PKCE.

O GCP Notas guarda os arquivos na pasta oculta do aplicativo no seu Drive (`appDataFolder`): eles não aparecem na lista de arquivos e só o GCP Notas consegue lê-los.

## OneDrive (Microsoft)

1. Acesse o [Microsoft Entra — Registros de aplicativo](https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) e clique em **Novo registro**.
2. Em **Tipos de conta**, escolha *Contas em qualquer diretório organizacional e contas pessoais Microsoft*.
3. Em **URI de redirecionamento**, escolha **Cliente público/nativo (celular e desktop)** e informe `http://localhost`.
4. Em **Permissões de API**, adicione (Microsoft Graph, delegadas): `Files.ReadWrite.AppFolder`, `User.Read` e `offline_access`.
5. Copie o **ID do aplicativo (cliente)**. Não é preciso segredo.

Os arquivos ficam em **Aplicativos/GCP Notas** no seu OneDrive.

## Segredos do GitHub Actions (builds oficiais)

Em **Settings → Secrets and variables → Actions** do repositório, crie:

| Segredo | Valor |
|---|---|
| `GOOGLE_CLIENT_ID` | ID do cliente Google |
| `GOOGLE_CLIENT_SECRET` | Chave secreta do cliente Google (app para computador) |
| `MICROSOFT_CLIENT_ID` | ID do aplicativo Microsoft |

## O que é enviado

Somente arquivos `.gcpcloud` com os registros **já cifrados** pela chave do seu cofre e o cabeçalho que exige a sua senha para abrir. Nem o Google nem a Microsoft conseguem ler suas notas.
