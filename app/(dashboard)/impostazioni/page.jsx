'use client'

import { useState, useEffect, useRef } from 'react'
import { getSupabase } from '@/lib/supabase'
import { getSettings, saveSettings, saveSetting, SETTINGS_DEFAULTS } from '@/lib/settings'
import {
  Building2, Bell, Package, Tag, FileText, Shield,
  Loader2, Plus, X, Upload, Check, RefreshCw, Image as ImageIcon, Eye, EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import Image from 'next/image'

// ── Toggle switch ──────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        checked ? 'bg-primary' : 'bg-muted-foreground/30'
      }`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-4.5' : 'translate-x-0.5'
      }`} />
    </button>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ title, description, children }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

// ── Field wrapper ──────────────────────────────────────────────────────────────
function SettingRow({ label, hint, children }) {
  return (
    <div className="flex items-start justify-between gap-8">
      <div className="flex-1 min-w-0">
        <Label className="text-sm font-medium">{label}</Label>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="flex-shrink-0 w-64">{children}</div>
    </div>
  )
}

// ── Tag list (categories/locations) ───────────────────────────────────────────
function TagList({ items, onAdd, onRemove, placeholder, defaultItems = [] }) {
  const [input, setInput] = useState('')

  function handleAdd() {
    const v = input.trim()
    if (!v || items.includes(v) || defaultItems.includes(v)) return
    onAdd(v)
    setInput('')
  }

  return (
    <div className="space-y-2">
      {defaultItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {defaultItems.map((item) => (
            <span key={item} className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/50 text-xs font-medium border border-border text-muted-foreground">
              {item}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-xs font-medium border border-border">
            {item}
            <button onClick={() => onRemove(item)} className="text-muted-foreground hover:text-destructive transition">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {items.length === 0 && defaultItems.length === 0 && <span className="text-xs text-muted-foreground italic">Nessun elemento personalizzato</span>}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="h-7 text-xs"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button size="sm" variant="outline" className="h-7 px-2" onClick={handleAdd} disabled={!input.trim()}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ── Password input with show/hide toggle ──────────────────────────────────────
function PasswordInput({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-8 text-sm pr-8"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ImpostazioniPage() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [pwdLoading, setPwdLoading] = useState(false)
  const [currentEmail, setCurrentEmail] = useState('')
  // Change password form
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [changePwdLoading, setChangePwdLoading] = useState(false)
  const logoInputRef = useRef(null)

  useEffect(() => {
    async function init() {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentEmail(user.email || '')
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setIsAdmin(profile?.role === 'admin')
      }
      const s = await getSettings()
      setSettings(s)
      setLoading(false)
    }
    init()
  }, [])

  function set(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(keys) {
    setSaving(true)
    const obj = {}
    keys.forEach((k) => { obj[k] = settings[k] })
    const ok = await saveSettings(obj)
    setSaving(false)
    if (ok) {
      toast.success('Impostazioni salvate')
    } else {
      toast.error('Errore nel salvataggio — verifica che la tabella app_settings esista nel database')
      console.error('[impostazioni] saveSettings failed — run the v3 migration in supabase/schema.sql')
    }
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    const supabase = getSupabase()
    const ext = file.name.split('.').pop()
    const { error } = await supabase.storage.from('settings').upload(`logo.${ext}`, file, { upsert: true })
    if (error) { toast.error('Errore upload logo'); setLogoUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('settings').getPublicUrl(`logo.${ext}`)
    const url = `${publicUrl}?t=${Date.now()}`
    await saveSetting('logo_url', url)
    set('logo_url', url)
    setLogoUploading(false)
    toast.success('Logo aggiornato')
  }

  async function handlePasswordReset() {
    setPwdLoading(true)
    if (!currentEmail) { toast.error('Email non trovata'); setPwdLoading(false); return }
    const res = await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'reset', email: currentEmail }),
    })
    const json = await res.json()
    if (!res.ok) toast.error(json.error || 'Errore invio email')
    else toast.success('Email di reset inviata')
    setPwdLoading(false)
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (!currentPwd) { toast.error('Inserisci la password attuale'); return }
    if (newPwd.length < 8) { toast.error('La nuova password deve essere di almeno 8 caratteri'); return }
    if (newPwd !== confirmPwd) { toast.error('Le password non coincidono'); return }

    setChangePwdLoading(true)
    const supabase = getSupabase()

    // Verify current password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: currentPwd,
    })
    if (signInError) {
      toast.error('Password attuale non corretta')
      setChangePwdLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPwd })
    setChangePwdLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Password aggiornata')
      setCurrentPwd('')
      setNewPwd('')
      setConfirmPwd('')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-center">
        <Shield className="w-10 h-10 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">Accesso riservato agli amministratori</p>
      </div>
    )
  }

  const LABEL_FORMAT_OPTIONS = [
    { value: 'keytag',  label: 'Key Tag (50×80mm)' },
    { value: 'dot',     label: 'Dot (25×25mm)' },
    { value: 'baby',    label: 'Baby Label (38×25mm)' },
    { value: 'barcode', label: 'Barcode (60×25mm)' },
    { value: 'cable',   label: 'Cable Wrap (80×15mm)' },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold">Impostazioni</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Configura GearVault per la tua organizzazione</p>
      </div>

      <Tabs defaultValue="account" className="w-full">
        <TabsList className="h-auto bg-muted/50 p-1 rounded-xl flex-wrap gap-1 w-full justify-start">
          {[
            { value: 'account',   label: 'Account',    icon: Building2 },
            { value: 'notifiche', label: 'Notifiche',  icon: Bell },
            { value: 'inventario',label: 'Inventario', icon: Package },
            { value: 'etichette', label: 'Etichette',  icon: Tag },
            { value: 'pdf',       label: 'Documenti PDF', icon: FileText },
            { value: 'sicurezza', label: 'Sicurezza',  icon: Shield },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="flex items-center gap-1.5 text-xs rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Icon className="w-3.5 h-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Account ─────────────────────────────────────────────────────── */}
        <TabsContent value="account" className="mt-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <Section title="Account Brain Digital" description="Dati identificativi dell'organizzazione">
              {/* Logo */}
              <SettingRow label="Logo aziendale" hint="Usato nelle intestazioni PDF e nelle etichette">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden">
                      {settings.logo_url ? (
                        <Image src={settings.logo_url} alt="Logo" width={56} height={56} className="object-contain" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                      {logoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Carica logo
                    </Button>
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">PNG o SVG con sfondo trasparente, min. 200×200px. Il logo viene salvato automaticamente al caricamento.</p>
                </div>
              </SettingRow>

              <Separator />

              <SettingRow label="Nome azienda" hint="Appare in intestazioni PDF e documenti">
                <Input value={settings.company_name} onChange={(e) => set('company_name', e.target.value)} className="h-8 text-sm" placeholder="Brain Digital" />
              </SettingRow>

              <SettingRow label="Indirizzo" hint="Usato nei documenti ATA e report assicurativi">
                <Input value={settings.company_address} onChange={(e) => set('company_address', e.target.value)} className="h-8 text-sm" placeholder="Via Roma 1, 00100 Roma" />
              </SettingRow>

              <SettingRow label="Email notifiche" hint="Indirizzo mittente per le notifiche automatiche">
                <Input type="email" value={settings.notification_email} onChange={(e) => set('notification_email', e.target.value)} className="h-8 text-sm" placeholder="noreply@braindigital.it" />
              </SettingRow>

              <SettingRow label="Valuta" hint="Simbolo mostrato nei valori monetari">
                <Select value={settings.currency} onValueChange={(v) => set('currency', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="€">€ Euro</SelectItem>
                    <SelectItem value="$">$ Dollaro</SelectItem>
                    <SelectItem value="£">£ Sterlina</SelectItem>
                    <SelectItem value="CHF">CHF Franco svizzero</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
            </Section>

            <div className="flex justify-end pt-2">
              <Button onClick={() => handleSave(['company_name', 'company_address', 'notification_email', 'currency'])} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Salva
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Notifiche ────────────────────────────────────────────────────── */}
        <TabsContent value="notifiche" className="mt-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <Section title="Alert manutenzione" description="Notifiche per attrezzatura da controllare">
              <SettingRow label="Alert manutenzione abilitato" hint="Mostra badge e avvisi per item da controllare">
                <Toggle checked={settings.maintenance_alert_enabled} onChange={(v) => set('maintenance_alert_enabled', v)} />
              </SettingRow>
              <SettingRow label="Giorni senza controllo" hint="Soglia dopo la quale un item è considerato da controllare">
                <Input
                  type="number" min="1" max="365"
                  value={settings.maintenance_alert_days}
                  onChange={(e) => set('maintenance_alert_days', parseInt(e.target.value) || 90)}
                  className="h-8 text-sm"
                />
              </SettingRow>
            </Section>

            <Separator />

            <Section title="Notifiche email" description="Email automatiche per eventi del flusso di lavoro">
              <SettingRow label="Notifica check-in/out" hint="Invia email quando un set parte o rientra">
                <Toggle checked={settings.checkinout_email_enabled} onChange={(v) => set('checkinout_email_enabled', v)} />
              </SettingRow>
              <SettingRow label="Promemoria set in programma" hint="Avviso prima della data del set">
                <Toggle checked={settings.set_reminder_enabled} onChange={(v) => set('set_reminder_enabled', v)} />
              </SettingRow>
              {settings.set_reminder_enabled && (
                <SettingRow label="Giorni di anticipo promemoria">
                  <Input
                    type="number" min="1" max="30"
                    value={settings.set_reminder_days}
                    onChange={(e) => set('set_reminder_days', parseInt(e.target.value) || 3)}
                    className="h-8 text-sm"
                  />
                </SettingRow>
              )}
            </Section>

            <div className="flex justify-end pt-2">
              <Button onClick={() => handleSave(['maintenance_alert_enabled', 'maintenance_alert_days', 'checkinout_email_enabled', 'set_reminder_enabled', 'set_reminder_days'])} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Salva
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Inventario ───────────────────────────────────────────────────── */}
        <TabsContent value="inventario" className="mt-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <Section title="Categorie" description="Le categorie predefinite sono fisse. Aggiungi categorie personalizzate con il ✕ per rimuoverle.">
              <TagList
                items={settings.custom_categories}
                placeholder="Es. Gimbal, Monitor…"
                onAdd={(v) => set('custom_categories', [...settings.custom_categories, v])}
                onRemove={(v) => set('custom_categories', settings.custom_categories.filter((x) => x !== v))}
                defaultItems={['Camera', 'Obiettivo', 'Drone', 'Audio', 'Illuminazione', 'Supporto', 'Accessorio', 'Altro']}
              />
            </Section>

            <Separator />

            <Section title="Location" description="Le location predefinite sono fisse. Aggiungi location personalizzate con il ✕ per rimuoverle.">
              <TagList
                items={settings.custom_locations}
                placeholder="Es. Magazzino, Noleggio…"
                onAdd={(v) => set('custom_locations', [...settings.custom_locations, v])}
                onRemove={(v) => set('custom_locations', settings.custom_locations.filter((x) => x !== v))}
                defaultItems={['Studio', 'Campo', 'Prestito']}
              />
            </Section>

            <div className="flex justify-end pt-2">
              <Button onClick={() => handleSave(['custom_categories', 'custom_locations'])} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Salva
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Etichette ────────────────────────────────────────────────────── */}
        <TabsContent value="etichette" className="mt-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <Section title="Formato etichette" description="Impostazioni predefinite per la stampa">
              <SettingRow label="Formato default" hint="Formato selezionato automaticamente in nuove etichette">
                <Select value={settings.default_label_format} onValueChange={(v) => set('default_label_format', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      { value: 'keytag',  label: 'Key Tag (50×80mm)' },
                      { value: 'dot',     label: 'Dot (25×25mm)' },
                      { value: 'baby',    label: 'Baby Label (38×25mm)' },
                      { value: 'barcode', label: 'Barcode (60×25mm)' },
                      { value: 'cable',   label: 'Cable Wrap (80×15mm)' },
                    ].map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow label="Testo footer etichette" hint="Testo in fondo alle etichette Standard e Small">
                <Input value={settings.label_footer_text} onChange={(e) => set('label_footer_text', e.target.value)} className="h-8 text-sm" placeholder="Brain Digital" maxLength={30} />
              </SettingRow>

              <SettingRow label="Etichette per riga (stampa)" hint="Numero di colonne nella griglia di stampa">
                <Input
                  type="number" min="1" max="10"
                  value={settings.label_per_row}
                  onChange={(e) => set('label_per_row', parseInt(e.target.value) || 3)}
                  className="h-8 text-sm"
                />
              </SettingRow>
            </Section>

            <div className="flex justify-end pt-2">
              <Button onClick={() => handleSave(['default_label_format', 'label_footer_text', 'label_per_row'])} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Salva
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── PDF ──────────────────────────────────────────────────────────── */}
        <TabsContent value="pdf" className="mt-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <Section title="Intestazione PDF" description="Dati mostrati nell'header di tutti i documenti PDF">
              <SettingRow label="Nome intestazione">
                <Input value={settings.pdf_header_name} onChange={(e) => set('pdf_header_name', e.target.value)} className="h-8 text-sm" placeholder="Brain Digital" />
              </SettingRow>
              <SettingRow label="Indirizzo intestazione">
                <Input value={settings.pdf_header_address} onChange={(e) => set('pdf_header_address', e.target.value)} className="h-8 text-sm" placeholder="Via Roma 1, 00100 Roma" />
              </SettingRow>
            </Section>

            <Separator />

            <Section title="Testi predefiniti">
              <div className="space-y-2">
                <Label className="text-sm">Disclaimer report assicurativo</Label>
                <Textarea
                  value={settings.pdf_insurance_disclaimer}
                  onChange={(e) => set('pdf_insurance_disclaimer', e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Note standard ATA Carnet</Label>
                <Textarea
                  value={settings.pdf_ata_notes}
                  onChange={(e) => set('pdf_ata_notes', e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>
            </Section>

            <div className="flex justify-end pt-2">
              <Button onClick={() => handleSave(['pdf_header_name', 'pdf_header_address', 'pdf_insurance_disclaimer', 'pdf_ata_notes'])} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Salva
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Sicurezza ────────────────────────────────────────────────────── */}
        <TabsContent value="sicurezza" className="mt-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">

            {/* Reset via email */}
            <Section title="Reset password" description="Ricevi un link via email per impostare una nuova password">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Reset via email</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ricevi un link all&apos;indirizzo <span className="font-mono">{currentEmail}</span>
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={handlePasswordReset} disabled={pwdLoading}>
                  {pwdLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Invia email reset
                </Button>
              </div>
            </Section>

            <Separator />

            {/* Change password */}
            <Section title="Cambia password" description="Imposta una nuova password partendo da quella attuale">
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Password attuale</Label>
                  <PasswordInput
                    value={currentPwd}
                    onChange={setCurrentPwd}
                    placeholder="La tua password attuale"
                    autoComplete="current-password"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Nuova password</Label>
                  <PasswordInput
                    value={newPwd}
                    onChange={setNewPwd}
                    placeholder="Minimo 8 caratteri"
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Conferma nuova password</Label>
                  <PasswordInput
                    value={confirmPwd}
                    onChange={setConfirmPwd}
                    placeholder="Ripeti la nuova password"
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex justify-end pt-1">
                  <Button type="submit" size="sm" disabled={changePwdLoading || !currentPwd || !newPwd || !confirmPwd}>
                    {changePwdLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Aggiorna password
                  </Button>
                </div>
              </form>
            </Section>

            <Separator />

            <Section title="Sessioni attive" description="Dispositivi connessi al tuo account">
              <div className="space-y-2">
                <div className="p-4 rounded-lg border border-border bg-muted/30 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Sessione corrente</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Browser · {typeof window !== 'undefined' ? navigator.platform : 'Sconosciuto'}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
                    Attiva
                  </span>
                </div>
                <p className="text-xs text-muted-foreground text-center py-2">
                  Per disconnettere tutte le sessioni, usa il bottone &quot;Esci&quot; dalla sidebar su ogni dispositivo.
                </p>
              </div>
            </Section>

          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
