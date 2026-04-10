import { getSupabase } from '@/lib/supabase'

/** Default settings values */
export const SETTINGS_DEFAULTS = {
  // Account
  company_name: 'Brain Digital',
  company_address: 'Via Dietro Le Mura, 7',
  company_city: '83051 Nusco (AV)',
  company_email: 'info@braindigital.it',
  company_phone: '',
  company_vat: '02852040647',
  company_fiscal_code: 'PSSFRC92S17A509F',
  company_sdi: 'KRRH6B9',
  company_iban: '',
  notification_email: '',
  currency: '€',
  logo_url: '',
  company_logo_light:   '',
  company_logo_dark:    '',
  company_logo_favicon: '',
  company_logo_svg:     '',

  // Notifiche
  maintenance_alert_enabled: true,
  maintenance_alert_days: 90,
  checkinout_email_enabled: false,
  set_reminder_enabled: false,
  set_reminder_days: 3,

  // Inventario
  custom_categories: [],
  custom_locations: [],

  // Etichette
  default_label_format: 'keytag',
  label_footer_text: 'Brain Digital',
  label_per_row: 3,

  // PDF
  pdf_header_name: 'Brain Digital',
  pdf_header_address: '',
  pdf_insurance_disclaimer: 'I valori riportati sono indicativi e soggetti a verifica. Documento generato da GearVault per uso assicurativo.',
  pdf_ata_notes: 'Le merci sono importate temporaneamente per uso professionale e saranno riesportate entro la data indicata.',
}

/** Fetch all settings and merge with defaults */
export async function getSettings() {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('app_settings').select('key, value')
  if (error || !data) return { ...SETTINGS_DEFAULTS }
  const merged = { ...SETTINGS_DEFAULTS }
  for (const row of data) {
    merged[row.key] = row.value
  }
  return merged
}

/** Save a single setting key → value */
export async function saveSetting(key, value) {
  const supabase = getSupabase()
  const { error } = await supabase.from('app_settings').upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
  return !error
}

/** Save multiple settings at once */
export async function saveSettings(obj) {
  const supabase = getSupabase()
  const rows = Object.entries(obj).map(([key, value]) => ({
    key, value, updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from('app_settings').upsert(rows, { onConflict: 'key' })
  return !error
}
