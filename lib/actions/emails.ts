"use server";

/**
 * Envía un correo de bienvenida (aparte del de confirmación que envía Supabase)
 * usando Resend (https://resend.com) vía su API REST, sin dependencias extra.
 *
 * Requiere configurar en el entorno (Vercel → Settings → Environment Variables):
 *   - RESEND_API_KEY:     API key de Resend.
 *   - WELCOME_EMAIL_FROM: remitente verificado, p. ej. "FamilyFinance <hola@tudominio.com>".
 *
 * Si falta cualquiera de las dos, no hace nada (el correo de confirmación de
 * Supabase sigue funcionando). Nunca lanza: un fallo aquí no debe romper el
 * registro.
 */
export async function enviarCorreoBienvenida(input: {
  email: string;
  nombre?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.WELCOME_EMAIL_FROM;
  if (!apiKey || !from) {
    return { sent: false, reason: "not_configured" };
  }

  const nombre = (input.nombre ?? "").trim();
  const saludo = nombre ? `¡Hola ${nombre}!` : "¡Hola!";

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1f2937">
    <h1 style="font-size:20px;margin:0 0 12px">${saludo} 👋</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 12px">
      Te damos la bienvenida a <strong>FamilyFinance</strong>. Tu cuenta se creó correctamente.
    </p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 12px">
      Recuerda <strong>confirmar tu correo</strong> con el enlace que te enviamos por separado para
      poder iniciar sesión. Después podrás registrar tu Cuenta Madre, tus transacciones y tus líneas
      presupuestarias.
    </p>
    <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:16px 0 0">
      Si no creaste esta cuenta, puedes ignorar este mensaje.
    </p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.email],
        subject: "¡Bienvenido a FamilyFinance! 🎉",
        html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Resend welcome email error:", res.status, detail);
      return { sent: false, reason: "send_error" };
    }
    return { sent: true };
  } catch (err) {
    console.error("Resend welcome email exception:", err);
    return { sent: false, reason: "exception" };
  }
}
