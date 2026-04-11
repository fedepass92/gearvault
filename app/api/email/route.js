import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getResendClient, FROM_EMAIL, FROM_NAME, inviteTemplate, resetPasswordTemplate, maintenanceAlertTemplate, setConfirmTemplate } from '@/lib/resend'
import { generateQuotePDFBuffer } from '@/lib/pdf'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { type, to, ...data } = body

    // ── Quote email (handled before generic `to` guard — no `to` field here) ───
    if (type === 'quote') {
      const { quote, items } = body
      if (!quote?.client_email) {
        return NextResponse.json({ error: 'Missing client_email on quote' }, { status: 400 })
      }

      console.log('[quote] start — quote:', quote.id, 'to:', quote.client_email, 'items:', items?.length)

      const admin = getAdminClient()

      // Load app_settings for branding + notification email
      let settings = {}
      try {
        const { data } = await admin.from('app_settings').select('key, value')
        if (data) data.forEach(({ key, value }) => { settings[key] = value })
        console.log('[quote] app_settings loaded:', Object.keys(settings))
      } catch (settingsErr) {
        console.warn('[quote] app_settings fetch failed (using defaults):', settingsErr?.message)
      }

      const companyName  = settings.company_name  || 'Brain Digital'
      const companyEmail = settings.company_email || 'info@braindigital.it'
      const notifyEmail  = settings.notification_email || companyEmail
      const logoUrl      = settings.company_logo_light || ''

      // Generate PDF buffer
      console.log('[quote] generating PDF buffer...')
      let pdfBuffer
      try {
        pdfBuffer = await generateQuotePDFBuffer(quote, items, settings)
        console.log('[quote] PDF buffer size:', pdfBuffer?.length)
      } catch (pdfErr) {
        console.error('[quote] PDF generation failed:', pdfErr)
        return NextResponse.json({ error: `PDF generation failed: ${pdfErr.message}` }, { status: 500 })
      }

      const safeTitle = (quote.title || 'preventivo').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
      const dateStr = new Date().toISOString().split('T')[0]
      const pdfFilename = `Preventivo_${safeTitle}_${dateStr}.pdf`
      const pdfAttachment = { filename: pdfFilename, content: pdfBuffer }

      const eventLine = quote.event_date
        ? `<p style="margin:0 0 8px;">📅 Data evento: <strong>${new Date(quote.event_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></p>`
        : ''

      const logoHeaderHtml = logoUrl
        ? `<img src="${logoUrl}" alt="${companyName}" height="40" style="height:40px;display:block;max-width:200px;object-fit:contain;margin-bottom:4px;">`
        : `<h1 style="color:white;margin:0;font-size:20px;">${companyName}</h1>`

      const clientHtml = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#0f172a;padding:24px;border-radius:8px 8px 0 0;">
            ${logoHeaderHtml}
            <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">Preventivo attrezzatura</p>
          </div>
          <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;">
            <p style="margin:0 0 12px;">Gentile <strong>${quote.client_name || 'Cliente'}</strong>,</p>
            <p style="margin:0 0 8px;">Ti inviamo in allegato il preventivo <strong>${quote.title}</strong>.</p>
            ${eventLine}
            <p style="margin:0 0 8px;">In allegato trovi il PDF con il dettaglio dell&apos;attrezzatura.</p>
            <p style="margin:0 0 16px;">Per qualsiasi informazione siamo a disposizione.</p>
            <p style="margin:0;">${companyName}<br>
            <a href="mailto:${companyEmail}" style="color:#0f172a;">${companyEmail}</a></p>
          </div>
          <div style="padding:12px 24px;background:#f1f5f9;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">Questo preventivo è stato generato automaticamente da GearVault.</p>
          </div>
        </div>`

      const notifyHtml = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#0f172a;padding:24px;border-radius:8px 8px 0 0;">
            <h1 style="color:white;margin:0;font-size:18px;">✅ Preventivo inviato</h1>
          </div>
          <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;">
            <p style="margin:0 0 8px;"><strong>Titolo:</strong> ${quote.title}</p>
            <p style="margin:0 0 8px;"><strong>Cliente:</strong> ${quote.client_name || '—'}</p>
            <p style="margin:0 0 8px;"><strong>Email:</strong> ${quote.client_email}</p>
            ${eventLine}
            <p style="margin:0;">Il PDF è allegato a questa notifica.</p>
          </div>
        </div>`

      const resend = getResendClient()

      // Send to client
      console.log('[quote] sending to client:', quote.client_email)
      const { data: clientData, error: clientErr } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [quote.client_email],
        subject: `Preventivo ${quote.title} — ${companyName}`,
        html: clientHtml,
        attachments: [pdfAttachment],
      })
      console.log('[quote] client send result:', { id: clientData?.id, error: clientErr })
      if (clientErr) {
        return NextResponse.json({ error: clientErr.message }, { status: 500 })
      }

      // Send notification to company
      console.log('[quote] sending notification to:', notifyEmail)
      const { data: notifyData, error: notifyErr } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [notifyEmail],
        subject: `Preventivo inviato - ${quote.title}`,
        html: notifyHtml,
        attachments: [pdfAttachment],
      })
      console.log('[quote] notification result:', { id: notifyData?.id, error: notifyErr })

      // Advance status to 'sent'
      await admin.from('quotes').update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', quote.id)
      console.log('[quote] done — status set to sent')

      return NextResponse.json({ success: true })
    }

    // 'reset' uses email field instead of to
    const email = to || body.email
    if (!type || !email) {
      return NextResponse.json({ error: 'Missing required fields: type, to/email' }, { status: 400 })
    }

    let subject, html
    if (type === 'invite') {
      const admin = getAdminClient()
      const origin = request.headers.get('origin') || ''

      // Create user via admin API (email pre-confirmed, no Supabase confirmation email)
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: to,
        password: crypto.randomUUID().slice(0, 16) + 'Aa1!',
        email_confirm: true,
      })
      if (createError) {
        console.error('[invite] createUser error:', JSON.stringify(createError, null, 2))
        return NextResponse.json({ error: createError.message }, { status: 400 })
      }

      // Create profile explicitly — don't rely on trigger which may fail
      const role = data.role || 'operator'
      const { error: profileError } = await admin.from('profiles').upsert(
        { id: created.user.id, full_name: '', role },
        { onConflict: 'id' }
      )
      if (profileError) {
        console.error('[invite] profile upsert error:', profileError)
      }

      // Generate a recovery link that redirects to /imposta-password
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email: to,
        options: { redirectTo: `${origin}/imposta-password` },
      })
      const setupUrl = linkData?.properties?.action_link || `${origin}/imposta-password`

      // Load logo for branding
      let inviteLogoUrl = ''
      try {
        const { data: logoRow } = await admin.from('app_settings').select('value').eq('key', 'company_logo_light').single()
        inviteLogoUrl = logoRow?.value || ''
      } catch { /* fallback */ }

      // Send branded email with the setup link
      ;({ subject, html } = inviteTemplate({ inviteeEmail: to, inviterName: data.inviterName || null, loginUrl: setupUrl, logoUrl: inviteLogoUrl }))

      const { data: result, error } = await getResendClient().emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
      })
      if (error) {
        console.error('[email route] Resend error:', error)
        return NextResponse.json({ id: null, warning: 'User created but email failed' })
      }
      return NextResponse.json({ id: result?.id })

    } else if (type === 'reset') {
      const admin = getAdminClient()
      const origin = request.headers.get('origin') || ''

      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: `${origin}/imposta-password` },
      })
      if (linkError) {
        return NextResponse.json({ error: linkError.message }, { status: 400 })
      }
      const resetUrl = linkData?.properties?.action_link || `${origin}/imposta-password`

      ;({ subject, html } = resetPasswordTemplate({ resetUrl }))

      const { data: result, error } = await getResendClient().emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [email],
        subject,
        html,
      })
      if (error) {
        console.error('[email route] Resend error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ id: result?.id })

    } else if (type === 'maintenance_alert') {
      ;({ subject, html } = maintenanceAlertTemplate(data))
    } else if (type === 'set_confirm') {
      ;({ subject, html } = setConfirmTemplate(data))
    } else {
      return NextResponse.json({ error: `Unknown email type: ${type}` }, { status: 400 })
    }

    const { data: result, error } = await getResendClient().emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    })

    if (error) {
      console.error('[email route] Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ id: result?.id })
  } catch (err) {
    console.error('[email route] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
