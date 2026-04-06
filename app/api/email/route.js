import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend, FROM_EMAIL, FROM_NAME, inviteTemplate, resetPasswordTemplate, maintenanceAlertTemplate, setConfirmTemplate } from '@/lib/resend'

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
        password: Math.random().toString(36).slice(-12) + 'Aa1!',
        email_confirm: true,
      })
      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 400 })
      }

      // Set role on profile (trigger may have already created it)
      const role = data.role || 'operator'
      await admin.from('profiles').upsert(
        { id: created.user.id, role },
        { onConflict: 'id' }
      )

      // Generate a recovery link that redirects to /imposta-password
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email: to,
        options: { redirectTo: `${origin}/imposta-password` },
      })
      const setupUrl = linkData?.properties?.action_link || `${origin}/imposta-password`

      // Send branded email with the setup link
      ;({ subject, html } = inviteTemplate({ inviteeEmail: to, inviterName: data.inviterName || null, loginUrl: setupUrl }))

      const { data: result, error } = await resend.emails.send({
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

      const { data: result, error } = await resend.emails.send({
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

    const { data: result, error } = await resend.emails.send({
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
