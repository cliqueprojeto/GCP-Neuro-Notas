# Política de Privacidade — GCP-Neuro Notas

*Atualizada em 23/11/2026 · [English](#english) · [Español](#español)*

O **GCP-Neuro Notas** é um aplicativo de código aberto (GPL-3.0) que funciona **offline** no seu aparelho. Desenvolvido por **Bruno Albertini** · [Gestão Cultural Pro](https://www.gestaoculturalpro.com.br).

## O que o app guarda
- Suas notas, bases, quadros e configurações ficam **no seu aparelho**, num cofre criptografado (Argon2id + XChaCha20-Poly1305). Só a sua senha abre o cofre.
- O app **não tem servidor** e **não coleta** dados de uso, telemetria ou publicidade.

## Google Drive (opcional)
Se você conectar o Google Drive, o app pede apenas:
- `drive.appdata`: uma **pasta oculta e exclusiva do app** no seu Drive, usada para o backup e a sincronização. O app não vê nem altera nenhum outro arquivo do seu Drive.
- `email` e `openid`: para mostrar qual conta está conectada.

O que vai para essa pasta são arquivos **já criptografados** com a chave do seu cofre: nem o Google nem o desenvolvedor conseguem lê-los. O acesso é feito direto do seu aparelho para o Google (OAuth com PKCE); os tokens ficam no cofre criptografado. Você pode desconectar a qualquer momento no app ou em <https://myaccount.google.com/permissions>.

O uso de informações recebidas das APIs do Google segue a [Política de Dados do Usuário dos Serviços de API do Google](https://developers.google.com/terms/api-services-user-data-policy), incluindo os requisitos de Uso Limitado.

## Outros serviços (opcionais)
OneDrive, provedores de IA, Notion e e-mail (SMTP) só são usados se você os configurar, e os dados vão direto do seu aparelho para o serviço escolhido.

## Contato
Abra uma *issue* em <https://github.com/cliqueprojeto/GCP-Neuro-Notas/issues>.

---

## English
GCP-Neuro Notas is open-source (GPL-3.0) and works **offline**. Your data stays **on your device** in an encrypted vault; there is **no server** and **no analytics**. If you connect Google Drive, the app only requests `drive.appdata` (a hidden folder used solely by the app, for **encrypted** backup/sync), `email` and `openid`. It cannot see any other Drive file. Use of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. Disconnect any time in the app or at <https://myaccount.google.com/permissions>.

## Español
GCP-Neuro Notas es de código abierto (GPL-3.0) y funciona **sin conexión**. Tus datos quedan **en tu dispositivo** en un cofre cifrado; **no hay servidor** ni **analítica**. Si conectas Google Drive, la app solo solicita `drive.appdata` (una carpeta oculta usada únicamente por la app, para copia de seguridad/sincronización **cifrada**), `email` y `openid`. No puede ver ningún otro archivo de tu Drive. El uso de la información recibida de las API de Google cumple la [Política de Datos del Usuario de los Servicios de API de Google](https://developers.google.com/terms/api-services-user-data-policy), incluidos los requisitos de Uso Limitado.
