# Segurança

## Modelo de proteção

| Camada | Como funciona |
|---|---|
| Senha mestra | Derivada com **Argon2id** (64 MiB, 3 iterações, sal aleatório de 128 bits) para uma chave de 256 bits. |
| Chave de dados | Aleatória (256 bits), gerada uma vez. Fica "embrulhada" pela chave da senha e pela chave de recuperação (XChaCha20-Poly1305). |
| Registros | Cada página/configuração é cifrada com **XChaCha20-Poly1305** e nonce aleatório de 192 bits antes de ir para o SQLite. |
| Recuperação | Chave de 30 caracteres (~150 bits) exibida uma vez no assistente; pode ser regenerada. |
| Tentativas | Atraso exponencial a partir da 3ª senha errada (até 5 minutos). |
| Bloqueio | Automático por inatividade (configurável) e manual; a chave é apagada da memória ao bloquear. |
| Backup em arquivo | `.gcpnotes` cifrado com uma senha própria (Argon2id + XChaCha20-Poly1305). Tokens de nuvem não são incluídos. |
| Nuvem | Envia apenas registros já cifrados + o cabeçalho do cofre. Escopos mínimos (`drive.appdata`, `Files.ReadWrite.AppFolder`). |
| Compartilhamento | `.gcpshare` opcionalmente cifrado com senha combinada entre as pessoas. |
| Atualizações | Instaladores baixados apenas das Releases do GitHub e conferidos por SHA-256 antes da instalação. |

O núcleo nativo (Rust) nunca recebe texto em claro: só blobs cifrados. Não há telemetria, conta ou servidor do GCP-Neuro Notas.

## Relatar uma vulnerabilidade

Abra uma *issue* com o título **[segurança]** sem detalhes sensíveis e peça um canal privado, ou entre em contato pela [Gestão Cultural Pro](https://www.gestaoculturalpro.com.br).
