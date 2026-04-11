import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getResendClient, FROM_EMAIL, FROM_NAME } from '@/lib/resend'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const in2days = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]

  const { data: loans } = await admin
    .from('loans')
    .select('*, loan_contacts(name, email, phone), equipment:item_id(name, brand, model)')
    .eq('status', 'active')
    .lte('expected_return', in2days)

  if (!loans?.length) {
    return NextResponse.json({ sent: 0, message: 'No loans expiring' })
  }

  let notifyEmail = 'info@braindigital.it'
  try {
    const { data } = await admin.from('app_settings').select('value').eq('key', 'company_email').single()
    if (data?.value) notifyEmail = data.value
  } catch {}

  const resend = getResendClient()
  let sent = 0

  for (const loan of loans) {
    const isOverdue = loan.expected_return < today
    const contact = loan.loan_contacts
    const item = loan.equipment
    if (!item || !contact) continue

    const itemName = [item.brand, item.name].filter(Boolean).join(' ')

    try {
      await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [notifyEmail],
        subject: isOverdue
          ? `Prestito scaduto - ${itemName} (${contact.name})`
          : `Prestito in scadenza - ${itemName} (${contact.name})`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:${isOverdue ? '#dc2626' : '#f59e0b'};padding:16px 24px;border-radius:8px 8px 0 0;">
              <h2 style="color:white;margin:0;font-size:16px;">${isOverdue ? 'Prestito scaduto' : 'Prestito in scadenza'}</h2>
            </div>
            <div style="padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
              <p><strong>Attrezzatura:</strong> ${itemName}</p>
              <p><strong>Prestata a:</strong> ${contact.name}</p>
              ${contact.email ? `<p><strong>Email:</strong> ${contact.email}</p>` : ''}
              ${contact.phone ? `<p><strong>Tel:</strong> ${contact.phone}</p>` : ''}
              <p><strong>Scadenza:</strong> ${new Date(loan.expected_return).toLocaleDateString('it-IT')}</p>
              ${isOverdue ? `<p style="color:#dc2626;font-weight:600;">Scaduto da ${Math.floor((Date.now() - new Date(loan.expected_return)) / 86400000)} giorni</p>` : ''}
              <br>
              <a href="https://gear.braindigital.it/prestiti" style="background:#0f172a;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Gestisci prestiti</a>
            </div>
          </div>
        `,
      })
      sent++
    } catch (err) {
      console.error(`[loans-notify] Failed for loan ${loan.id}:`, err)
    }
  }

  return NextResponse.json({ sent, total: loans.length })
}
