import { NextResponse } from 'next/server'
import { resend, FROM_EMAIL, FROM_NAME, inviteTemplate, maintenanceAlertTemplate, setConfirmTemplate } from '@/lib/resend'

export async function POST(request) {
  try {
    const body = await request.json()
    const { type, to, ...data } = body

    if (!type || !to) {
      return NextResponse.json({ error: 'Missing required fields: type, to' }, { status: 400 })
    }

    let subject, html
    if (type === 'invite') {
      ;({ subject, html } = inviteTemplate(data))
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
