# Android e iOS (roteiro)

O GCP Notas foi estruturado para virar aplicativo **nativo** de celular e tablet sem reescrever o código:

- **Tauri 2** gera projetos Android (Gradle/Kotlin) e iOS (Xcode/Swift) a partir do mesmo núcleo Rust. O ponto de entrada móvel já existe em `src-tauri/src/lib.rs` (`#[cfg_attr(mobile, tauri::mobile_entry_point)]`).
- O **banco SQLite** (rusqlite com SQLite embutido) e a **criptografia** (Argon2id + XChaCha20-Poly1305 no front-end) são portáveis.
- A interface é **responsiva**: barra lateral em gaveta, painel de IA em tela cheia, barras de ferramentas roláveis e alvos de toque adequados.
- Ícones Android/iOS já foram gerados em `src-tauri/icons/`.

## Como gerar

```bash
# Android (Android Studio + SDK/NDK instalados)
npx tauri android init
npx tauri android build --apk

# iOS (macOS com Xcode)
npx tauri ios init
npx tauri ios build
```

## Ajustes previstos para a versão móvel

- OAuth do Google Drive/OneDrive via *deep link* (esquema `gcpnotas://`) no lugar do retorno em `127.0.0.1`.
- Atualizações pela Play Store / App Store (o atualizador interno é desativado no celular).
- Seletor de arquivos e compartilhamento nativos (plugins `dialog` e `share` do Tauri).
- Desbloqueio por biometria (plugin `biometric`) como atalho para a senha mestra.
