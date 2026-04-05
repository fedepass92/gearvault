import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

export const FROM_EMAIL = 'gear@gear.braindigital.it'
export const FROM_NAME  = 'GearVault · Brain Digital'

// ── Shared brand styles ────────────────────────────────────────────────────────
const BRAND_BG    = '#0f172a'
const BRAND_BLUE  = '#2563eb'
const BODY_BG     = '#f8fafc'
const CARD_BG     = '#ffffff'
const TEXT_MAIN   = '#0f172a'
const TEXT_MUTED  = '#64748b'

// ── Base layout wrapper ────────────────────────────────────────────────────────
function layout(content) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>GearVault</title>
</head>
<body style="margin:0;padding:0;background:${BODY_BG};font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BODY_BG};padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:${BRAND_BG};border-radius:12px 12px 0 0;padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="font-size:18px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">BRAIN</span>
                  <span style="font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:4px;margin-left:6px;vertical-align:middle;">DIGITAL</span>
                </td>
                <td align="right">
                  <span style="font-size:11px;color:#475569;font-weight:500;">GearVault</span>
                </td>
              </tr>
            </table>
            <div style="height:2px;background:${BRAND_BLUE};margin-top:16px;border-radius:1px;"></div>
          </td>
        </tr>

        <!-- Body card -->
        <tr>
          <td style="background:${CARD_BG};padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f1f5f9;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;">
            <p style="margin:0;font-size:11px;color:${TEXT_MUTED};">Brain Digital · GearVault — Sistema di Gestione Attrezzatura</p>
            <p style="margin:4px 0 0;font-size:10px;color:#94a3b8;">Questa email è stata generata automaticamente, non rispondere a questo messaggio.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function btn(text, href) {
  return `<a href="${href}" style="display:inline-block;background:${BRAND_BG};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;margin-top:8px;">${text}</a>`
}

function badge(text, color = BRAND_BLUE) {
  return `<span style="display:inline-block;background:${color}20;color:${color};font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid ${color}40;">${text}</span>`
}

// ── Template: Invito utente ────────────────────────────────────────────────────
export function inviteTemplate({ inviteeEmail, inviterName, loginUrl }) {
  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:${TEXT_MAIN};">Sei stato invitato a GearVault</h1>
    <p style="margin:0 0 24px;font-size:14px;color:${TEXT_MUTED};">
      ${inviterName ? `<strong style="color:${TEXT_MAIN};">${inviterName}</strong> ti ha invitato a` : 'Sei stato invitato a'}
      utilizzare GearVault, il sistema di gestione attrezzatura di Brain Digital.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin:0 0 28px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:0.08em;">Il tuo accesso</p>
      <p style="margin:0;font-size:15px;font-weight:600;color:${TEXT_MAIN};">${inviteeEmail}</p>
    </div>

    <p style="margin:0 0 20px;font-size:14px;color:${TEXT_MUTED};">
      Clicca il pulsante qui sotto per impostare la tua password e accedere alla piattaforma.
    </p>
    ${btn('Accedi a GearVault →', loginUrl)}

    <p style="margin:28px 0 0;font-size:12px;color:#94a3b8;">
      Il link è valido per 24 ore. Se non hai richiesto questo accesso, ignora questa email.
    </p>
  `
  return {
    subject: 'Sei stato invitato a GearVault',
    html: layout(content),
  }
}

// ── Template: Alert manutenzione ──────────────────────────────────────────────
export function maintenanceAlertTemplate({ items, appUrl }) {
  const rows = items.map((item) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:36px;vertical-align:middle;">
              <div style="width:32px;height:32px;border-radius:8px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:16px;">📦</div>
            </td>
            <td style="padding-left:12px;vertical-align:middle;">
              <p style="margin:0;font-size:14px;font-weight:600;color:${TEXT_MAIN};">${item.name}</p>
              <p style="margin:2px 0 0;font-size:12px;color:${TEXT_MUTED};">
                ${[item.brand, item.model].filter(Boolean).join(' · ') || 'Nessuna marca'}
                ${item.serial_number ? ` · S/N: ${item.serial_number}` : ''}
              </p>
            </td>
            <td align="right" style="vertical-align:middle;">
              ${badge(item.last_checked_at ? `${item.days_since}gg fa` : 'Mai controllato', '#ef4444')}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('')

  const content = `
    <div style="margin:0 0 24px;">
      <span style="font-size:28px;">⚠️</span>
      <h1 style="margin:8px 0 4px;font-size:22px;font-weight:800;color:${TEXT_MAIN};">Attrezzatura da controllare</h1>
      <p style="margin:0;font-size:14px;color:${TEXT_MUTED};">
        ${items.length} elemento${items.length !== 1 ? 'i' : ''} super${items.length !== 1 ? 'ano' : 'a'} la soglia di manutenzione.
      </p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
      ${rows}
    </table>

    ${btn('Vai a Manutenzione →', `${appUrl}/manutenzione`)}

    <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">
      Puoi modificare la soglia di alert nelle Impostazioni di GearVault.
    </p>
  `
  return {
    subject: `Attrezzatura da controllare — ${items.length} elemento${items.length !== 1 ? 'i' : ''}`,
    html: layout(content),
  }
}

// ── Template: Conferma set ─────────────────────────────────────────────────────
export function setConfirmTemplate({ set, items, appUrl }) {
  const STATUS_LABEL = { planned: 'Pianificato', out: 'In uscita', returned: 'Rientrato', incomplete: 'Incompleto' }
  const STATUS_COLOR = { planned: '#2563eb', out: '#f59e0b', returned: '#10b981', incomplete: '#ef4444' }
  const statusColor = STATUS_COLOR[set.status] || '#2563eb'

  const itemRows = items.slice(0, 10).map((item, i) => {
    const eq = item.equipment || item
    return `
      <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'};">
        <td style="padding:8px 12px;font-size:13px;font-weight:600;color:${TEXT_MAIN};">${eq.name || '—'}</td>
        <td style="padding:8px 12px;font-size:12px;color:${TEXT_MUTED};">${eq.serial_number || '—'}</td>
        <td style="padding:8px 12px;font-size:12px;color:${TEXT_MUTED};">${eq.condition === 'active' ? '✅ OK' : eq.condition === 'repair' ? '🔧 Riparazione' : '—'}</td>
      </tr>
    `
  }).join('')

  const extraItems = items.length > 10 ? `
    <tr><td colspan="3" style="padding:8px 12px;font-size:12px;color:${TEXT_MUTED};text-align:center;">
      + ${items.length - 10} altri elementi
    </td></tr>
  ` : ''

  const content = `
    <div style="margin:0 0 8px;">${badge(STATUS_LABEL[set.status] || 'Pianificato', statusColor)}</div>
    <h1 style="margin:8px 0 4px;font-size:22px;font-weight:800;color:${TEXT_MAIN};">Set "${set.name}" confermato</h1>
    <p style="margin:0 0 24px;font-size:14px;color:${TEXT_MUTED};">Dettagli del set e lista attrezzatura assegnata.</p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin:0 0 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${set.job_date ? `<tr>
          <td style="font-size:11px;font-weight:700;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:0.08em;padding-bottom:4px;">Data lavoro</td>
          <td style="font-size:14px;font-weight:600;color:${TEXT_MAIN};padding-bottom:4px;">${set.job_date}</td>
        </tr>` : ''}
        ${set.location ? `<tr>
          <td style="font-size:11px;font-weight:700;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:0.08em;padding-bottom:4px;">Location</td>
          <td style="font-size:14px;font-weight:600;color:${TEXT_MAIN};padding-bottom:4px;">${set.location}</td>
        </tr>` : ''}
        <tr>
          <td style="font-size:11px;font-weight:700;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:0.08em;">Item</td>
          <td style="font-size:14px;font-weight:600;color:${TEXT_MAIN};">${items.length} elementi</td>
        </tr>
      </table>
    </div>

    ${items.length > 0 ? `
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:0.08em;">Attrezzatura</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:0 0 24px;">
      <thead>
        <tr style="background:${BRAND_BG};">
          <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Nome</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Seriale</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Stato</th>
        </tr>
      </thead>
      <tbody>${itemRows}${extraItems}</tbody>
    </table>` : ''}

    ${btn(`Apri Set →`, `${appUrl}/set/${set.id}`)}
  `
  return {
    subject: `Set "${set.name}" confermato`,
    html: layout(content),
  }
}
