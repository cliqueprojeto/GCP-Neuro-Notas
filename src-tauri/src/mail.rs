//! Envio de e-mail direto do aparelho por SMTP (sem servidor próprio):
//! o usuário informa o servidor do seu provedor (Gmail, Outlook, Zoho…) e uma senha de app.

use lettre::message::{header::ContentType, Mailbox, Message, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::client::{Tls, TlsParameters};
use lettre::{SmtpTransport, Transport};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct MailRequest {
    host: String,
    port: u16,
    /// "ssl" (porta 465), "starttls" (587) ou "none"
    security: String,
    user: String,
    password: String,
    from: String,
    to: Vec<String>,
    subject: String,
    text: String,
    html: Option<String>,
}

fn send_blocking(r: MailRequest) -> Result<(), String> {
    let from: Mailbox = r.from.parse().map_err(|e| format!("remetente inválido: {e}"))?;
    let mut b = Message::builder().from(from).subject(r.subject);
    for to in &r.to {
        b = b.to(to.parse().map_err(|e| format!("destinatário inválido ({to}): {e}"))?);
    }
    let body = match r.html {
        Some(h) => MultiPart::alternative()
            .singlepart(SinglePart::builder().header(ContentType::TEXT_PLAIN).body(r.text))
            .singlepart(SinglePart::builder().header(ContentType::TEXT_HTML).body(h)),
        None => MultiPart::mixed().singlepart(SinglePart::builder().header(ContentType::TEXT_PLAIN).body(r.text)),
    };
    let msg = b.multipart(body).map_err(|e| e.to_string())?;
    let creds = Credentials::new(r.user, r.password);
    let tls = TlsParameters::new(r.host.clone()).map_err(|e| e.to_string())?;
    let mailer = match r.security.as_str() {
        "ssl" => SmtpTransport::relay(&r.host).map_err(|e| e.to_string())?.port(r.port).tls(Tls::Wrapper(tls)),
        "none" => SmtpTransport::builder_dangerous(&r.host).port(r.port),
        _ => SmtpTransport::relay(&r.host).map_err(|e| e.to_string())?.port(r.port).tls(Tls::Required(tls)),
    }
    .credentials(creds)
    .timeout(Some(std::time::Duration::from_secs(25)))
    .build();
    mailer.send(&msg).map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn send_email(req: MailRequest) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || send_blocking(req))
        .await
        .map_err(|e| e.to_string())?
}
