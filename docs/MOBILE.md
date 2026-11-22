# GCP-Neuro Notas no celular e tablet

## Android (disponível a partir da 1.1.0)

O app Android é **nativo**: gerado pelo Tauri 2 a partir do mesmo núcleo Rust (SQLite + comandos) e da mesma interface, com ajustes próprios para toque:

- barra inferior (Início, Buscar, ＋ Criar, IA, Menu) e menu lateral em gaveta;
- janelas em folha deslizante, áreas seguras do entalhe e da barra de gestos;
- pinça com dois dedos no Quadro, botões de zoom no Grafo;
- botão/gesto "voltar" do sistema navegando dentro do app;
- ações sempre visíveis em telas sem mouse;
- arquivos salvos e abertos pelo seletor nativo do Android (exportações, backups, `.gcpshare`).

### Instalar

Baixe `GCP-Notas-x.y.z-Android.apk` na [última versão](https://github.com/cliqueprojeto/GCP-Notas/releases/latest), toque no arquivo, permita **Instalar apps desconhecidos** para o navegador e confirme. Requer Android 7.0 (API 24) ou superior; o APK inclui arm64, armv7 e x86_64.

### Chave de assinatura (importante para as atualizações)

O Android só aceita atualizar um app se a nova versão for assinada **com a mesma chave**. Enquanto os segredos abaixo não existirem, o GitHub Actions assina cada versão com uma chave temporária — funciona para testar, mas a próxima versão vai exigir desinstalar e instalar de novo.

Para ter atualizações normais, crie a chave uma única vez (guarde o arquivo e as senhas em local seguro):

```bash
keytool -genkeypair -v -keystore gcp-notas.jks -alias gcpnotas -keyalg RSA -keysize 2048 -validity 10000
```

```bash
base64 -w0 gcp-notas.jks > gcp-notas.jks.b64
```

Depois, em **GitHub → Settings → Secrets and variables → Actions**, crie:

| Segredo | Valor |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | conteúdo do arquivo `gcp-notas.jks.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | senha do keystore |
| `ANDROID_KEY_ALIAS` | `gcpnotas` |
| `ANDROID_KEY_PASSWORD` | senha da chave (igual à do keystore, se não definiu outra) |

### Compilar localmente

Requer Android Studio (SDK 34, NDK 27), Java 17 e Rust com os alvos Android:

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
```

```bash
npx tauri android init
npx tauri icon assets/branding/icon-1024.png
npx tauri android dev          # celular conectado por USB ou emulador
npx tauri android build --apk  # APK de produção
```

### Observações

- **Google Drive / OneDrive:** o login abre o navegador do celular e volta ao app pelo endereço local. Se a sua conta exigir, use o backup em arquivo como alternativa.
- **Atualizações:** o app avisa quando há versão nova e abre o download do APK.
- **Play Store:** o mesmo projeto gera `.aab` com `npx tauri android build --aab` quando houver publicação na loja.

## iOS / iPadOS (próxima etapa)

O mesmo código gera o projeto Xcode com `npx tauri ios init`; falta a assinatura com uma conta Apple Developer para distribuir.
