import { format } from 'date-fns'
import { it } from 'date-fns/locale'

const CATEGORY_LABELS = {
  camera: 'Camera', lens: 'Obiettivo', drone: 'Drone', audio: 'Audio',
  lighting: 'Illuminazione', support: 'Supporto', accessory: 'Accessorio', altro: 'Altro',
}

const CONDITION_LABELS = { active: 'Attivo', repair: 'Riparazione', retired: 'Ritirato' }

/** Reusable header band */
function drawHeader(doc, title, subtitle, today, totalWidth) {
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, totalWidth, 24, 'F')
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 24, totalWidth, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, 11)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  if (subtitle) doc.text(subtitle, 14, 18)
  doc.text(`Brain Digital · GearVault`, totalWidth - 14, 11, { align: 'right' })
  doc.setTextColor(180, 180, 180)
  doc.text(`Generato il: ${today}`, totalWidth - 14, 18, { align: 'right' })
  doc.setTextColor(0, 0, 0)
}

/** Full inventory insurance report (landscape A4) */
export async function exportInsuranceReport(items, categoria = null) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const today = format(new Date(), 'dd/MM/yyyy', { locale: it })
  const todayFile = format(new Date(), 'yyyyMMdd')

  drawHeader(doc, 'Report Assicurativo — Brain Digital',
    categoria ? `Categoria: ${CATEGORY_LABELS[categoria] || categoria}` : 'Tutte le categorie',
    today, 297)

  const filteredItems = categoria ? items.filter((i) => i.category === categoria) : items
  const totalPurchase = filteredItems.reduce((s, i) => s + (parseFloat(i.purchase_price) || 0), 0)
  const totalMarket = filteredItems.reduce((s, i) => s + (parseFloat(i.market_value) || 0), 0)
  const totalInsured = filteredItems.reduce((s, i) => s + (parseFloat(i.insured_value) || 0), 0)

  const fmt = (v) => v != null && v !== '' && !isNaN(parseFloat(v))
    ? `€ ${parseFloat(v).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
    : '—'

  const tableData = filteredItems.map((item) => [
    item.name || '',
    item.brand || '',
    item.serial_number || '',
    item.purchase_date ? format(new Date(item.purchase_date), 'dd/MM/yyyy') : '',
    fmt(item.purchase_price),
    fmt(item.market_value),
    fmt(item.insured_value),
    CONDITION_LABELS[item.condition] || item.condition || '',
  ])

  tableData.push([
    { content: `TOTALE (${filteredItems.length} item)`, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
    { content: fmt(totalPurchase), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right' } },
    { content: fmt(totalMarket), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right' } },
    { content: fmt(totalInsured), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right' } },
    { content: '', styles: { fillColor: [241, 245, 249] } },
  ])

  autoTable(doc, {
    startY: 30,
    head: [['Nome', 'Marca', 'Seriale', 'Data Acquisto', 'Val. Acquisto', 'Val. Mercato', 'Val. Assicurato', 'Condizione']],
    body: tableData,
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 30 },
      2: { cellWidth: 35 },
      3: { cellWidth: 24 },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 28, halign: 'right' },
      7: { cellWidth: 22 },
    },
    margin: { left: 14, right: 14 },
  })

  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5)
    doc.setTextColor(150)
    doc.text(`Pagina ${i} di ${pageCount}`, 283, 205, { align: 'right' })
    doc.text('GearVault — Brain Digital © ' + new Date().getFullYear(), 14, 205)
  }

  doc.save(`BrainDigital_Attrezzature_${todayFile}.pdf`)
}

/** Per-set insurance PDF (portrait A4) */
export async function exportSetInsurancePDF(set, items) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const today = format(new Date(), 'dd/MM/yyyy', { locale: it })
  const todayFile = format(new Date(), 'yyyyMMdd')

  drawHeader(doc, `Set: ${set.name}`, 'Dichiarazione valori per polizza assicurativa', today, 210)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  let infoY = 35
  if (set.job_date) {
    doc.text(`Data lavoro: ${format(new Date(set.job_date), 'd MMMM yyyy', { locale: it })}`, 14, infoY)
    infoY += 5
  }
  if (set.location) {
    doc.text(`Location: ${set.location}`, 14, infoY)
    infoY += 5
  }
  doc.setTextColor(0, 0, 0)

  // Extract equipment — handle both set_items with nested equipment and plain equipment arrays
  const equipment = items
    .map((i) => i.equipment || i)
    .filter((e) => e && e.name)

  const fmt = (v) => v != null && v !== '' && !isNaN(parseFloat(v))
    ? `€ ${parseFloat(v).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
    : '—'

  const totalMarket = equipment.reduce((s, e) => s + (parseFloat(e.market_value) || 0), 0)
  const totalInsured = equipment.reduce((s, e) => s + (parseFloat(e.insured_value) || 0), 0)

  const tableData = equipment.map((e) => [
    e.name || '',
    e.brand || '',
    e.serial_number || '',
    CATEGORY_LABELS[e.category] || e.category || '',
    e.purchase_date ? format(new Date(e.purchase_date), 'dd/MM/yyyy') : '',
    fmt(e.market_value),
    fmt(e.insured_value),
    CONDITION_LABELS[e.condition] || e.condition || '',
  ])

  tableData.push([
    { content: `TOTALE (${equipment.length} item)`, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
    { content: fmt(totalMarket), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right' } },
    { content: fmt(totalInsured), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right' } },
    { content: '', styles: { fillColor: [241, 245, 249] } },
  ])

  autoTable(doc, {
    startY: infoY + 4,
    head: [['Nome', 'Marca', 'Seriale', 'Categoria', 'Data Acq.', 'Val. Mercato', 'Val. Assicurato', 'Cond.']],
    body: tableData,
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 22 },
      2: { cellWidth: 25 },
      3: { cellWidth: 20 },
      4: { cellWidth: 18 },
      5: { cellWidth: 24, halign: 'right' },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 15 },
    },
    margin: { left: 10, right: 10 },
  })

  // Disclaimer
  const finalY = doc.lastAutoTable.finalY + 8
  doc.setFontSize(7.5)
  doc.setTextColor(120)
  doc.setFont('helvetica', 'italic')
  doc.text('I valori riportati sono indicativi e soggetti a verifica. Documento generato da GearVault per uso assicurativo.', 10, finalY, { maxWidth: 190 })

  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150)
    doc.text(`Pagina ${i} di ${pageCount}`, 200, 290, { align: 'right' })
    doc.text('GearVault — Brain Digital © ' + new Date().getFullYear(), 10, 290)
  }

  doc.save(`BrainDigital_Set_${set.name.replace(/\s+/g, '_')}_${todayFile}.pdf`)
}

/** Load a remote image as a base64 dataURL (for embedding in jsPDF) */
async function loadImageDataUrl(url) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Checkout Agreement PDF — portrait A4 */
export async function exportCheckoutAgreement(set, items, operator = {}) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const today = format(new Date(), 'dd/MM/yyyy', { locale: it })
  const todayLong = format(new Date(), "d MMMM yyyy 'alle' HH:mm", { locale: it })
  const todayFile = format(new Date(), 'yyyyMMdd')
  const equipment = items.map((i) => i.equipment || i).filter((e) => e && e.name)

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, W, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('BRAIN DIGITAL', 14, 12)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text('GearVault — Sistema di Gestione Attrezzatura', 14, 18)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.text(`Generato il ${today}`, W - 14, 12, { align: 'right' })
  // Blue accent line
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 28, W, 2, 'F')

  let y = 40

  // ── Title ────────────────────────────────────────────────────────────────────
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('ACCORDO DI CHECKOUT', 14, y)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Checkout Agreement / Presa in consegna attrezzatura', 14, y + 6)
  y += 16

  // ── Set info box ─────────────────────────────────────────────────────────────
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, y, W - 28, 30, 3, 3, 'FD')
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.text('DETTAGLI SET', 20, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(10)
  doc.text(set.name, 20, y + 14)
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  const setDetails = [
    set.job_date ? `Data: ${format(new Date(set.job_date), 'd MMMM yyyy', { locale: it })}` : null,
    set.location ? `Location: ${set.location}` : null,
    `Stato: ${set.status === 'planned' ? 'Pianificato' : set.status === 'out' ? 'In uscita' : 'Rientrato'}`,
  ].filter(Boolean).join('   ·   ')
  doc.text(setDetails, 20, y + 21)
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text(`Generato: ${todayLong}`, 20, y + 27)
  y += 38

  // ── Operator ──────────────────────────────────────────────────────────────────
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('OPERATORE RESPONSABILE', 14, y)
  y += 5

  // Avatar circle (initials)
  const initials = ((operator.full_name || operator.email || 'U').split(' ').map((s) => s[0]).join('').slice(0, 2)).toUpperCase()
  doc.setFillColor(15, 23, 42)
  doc.circle(22, y + 6, 6, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text(initials, 22, y + 8, { align: 'center' })

  doc.setTextColor(15, 23, 42)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(operator.full_name || 'Operatore', 32, y + 5)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text(operator.email || '', 32, y + 10)
  y += 22

  // ── Equipment table ───────────────────────────────────────────────────────────
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text(`ATTREZZATURA (${equipment.length} item)`, 14, y)
  y += 4

  autoTable(doc, {
    startY: y,
    head: [['#', 'Nome', 'Marca / Modello', 'Seriale', 'Condizione', 'Stato']],
    body: equipment.map((e, i) => [
      i + 1,
      e.name || '',
      [e.brand, e.model].filter(Boolean).join(' · ') || '—',
      e.serial_number || '—',
      CONDITION_LABELS[e.condition] || e.condition || '—',
      e.condition === 'repair' ? 'Manutenzione' : 'OK',
    ]),
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 45 },
      2: { cellWidth: 40 },
      3: { cellWidth: 35 },
      4: { cellWidth: 22 },
      5: { cellWidth: 18, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  })

  y = doc.lastAutoTable.finalY + 12

  // ── Disclaimer ────────────────────────────────────────────────────────────────
  if (y + 30 > 270) { doc.addPage(); y = 20 }
  doc.setFillColor(254, 243, 199)
  doc.setDrawColor(252, 211, 77)
  doc.roundedRect(14, y, W - 28, 22, 2, 2, 'FD')
  doc.setTextColor(146, 64, 14)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.text('⚠  DICHIARAZIONE DI RESPONSABILITÀ', 20, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(
    'Il sottoscritto dichiara di aver ricevuto l\'attrezzatura elencata in buone condizioni e si impegna a ' +
    'restituirla nello stesso stato. Eventuali danni, smarrimenti o malfunzionamenti dovranno essere ' +
    'comunicati tempestivamente a Brain Digital.',
    20, y + 12, { maxWidth: W - 44 }
  )
  y += 30

  // ── Signature box ─────────────────────────────────────────────────────────────
  if (y + 40 > 275) { doc.addPage(); y = 20 }
  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(14, y, W - 28, 38, 3, 3, 'FD')
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.text('FIRMA DIGITALE / ACCETTAZIONE', 20, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(15, 23, 42)
  doc.text(`Firmato da: ${operator.full_name || '_______________________'}`, 20, y + 16)
  doc.text(`Data firma: ___________________________`, 20, y + 23)
  doc.setDrawColor(203, 213, 225)
  doc.line(20, y + 33, 100, y + 33)
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text('Firma', 20, y + 37)

  // ── Footer ────────────────────────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text('Brain Digital · GearVault © ' + new Date().getFullYear(), 14, 290)
    doc.text(`Pag. ${i}/${pages}`, W - 14, 290, { align: 'right' })
  }

  const safeName = set.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
  doc.save(`BrainDigital_Checkout_${safeName}_${todayFile}.pdf`)
}

/** ATA Carnet PDF — portrait A4 */
export async function exportATACarnet(set, items) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const today = format(new Date(), 'dd/MM/yyyy', { locale: it })
  const todayFile = format(new Date(), 'yyyyMMdd')
  const equipment = items.map((i) => i.equipment || i).filter((e) => e && e.name)

  const fmtEur = (v) => v != null && !isNaN(parseFloat(v))
    ? `€ ${parseFloat(v).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
    : '—'

  const totalValue = equipment.reduce((s, e) => s + (parseFloat(e.insured_value || e.market_value) || 0), 0)

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, W, 32, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text('ATA CARNET', 14, 12)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text('FOR TEMPORARY ADMISSION OF GOODS', 14, 19)
  doc.text('POUR L\'ADMISSION TEMPORAIRE DE MARCHANDISES', 14, 25)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7.5)
  doc.text(today, W - 14, 12, { align: 'right' })
  doc.text('No. ____________________', W - 14, 19, { align: 'right' })
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 32, W, 2, 'F')

  let y = 42

  // ── Exporter info ────────────────────────────────────────────────────────────
  const infoBoxH = 34
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, y, (W - 32) / 2, infoBoxH, 2, 2, 'FD')
  doc.roundedRect(14 + (W - 32) / 2 + 4, y, (W - 32) / 2, infoBoxH, 2, 2, 'FD')

  // Left: exporter
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('ESPORTATORE / HOLDER', 19, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(8.5)
  doc.text('Brain Digital', 19, y + 13)
  doc.setFontSize(7.5)
  doc.setTextColor(71, 85, 105)
  doc.text('Via ____________________, N°____', 19, y + 19)
  doc.text('00100 Roma (RM)', 19, y + 24)
  doc.text('Italia / Italy', 19, y + 29)

  // Right: goods info
  const rx = 14 + (W - 32) / 2 + 8
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('SET / RIFERIMENTO', rx, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(8.5)
  doc.text(set.name, rx, y + 13)
  doc.setFontSize(7.5)
  doc.setTextColor(71, 85, 105)
  if (set.job_date) doc.text(`Data: ${format(new Date(set.job_date), 'd MMM yyyy', { locale: it })}`, rx, y + 19)
  if (set.location) doc.text(`Destinazione: ${set.location}`, rx, y + 24)
  doc.text(`N° item: ${equipment.length}`, rx, y + 29)

  y += infoBoxH + 10

  // ── Goods table ───────────────────────────────────────────────────────────────
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('ELENCO MERCI / LIST OF GOODS', 14, y)
  y += 4

  const tableBody = equipment.map((e, i) => [
    i + 1,
    `${e.name}${e.brand ? '\n' + e.brand + (e.model ? ' ' + e.model : '') : ''}`,
    e.serial_number || '—',
    '', // peso — da compilare
    fmtEur(e.insured_value || e.market_value),
    'IT',
  ])

  // Totals row
  tableBody.push([
    { content: `TOTALE / TOTAL (${equipment.length} item)`, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
    { content: fmtEur(totalValue), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right' } },
    { content: '', styles: { fillColor: [241, 245, 249] } },
  ])

  autoTable(doc, {
    startY: y,
    head: [['N°', 'Descrizione / Description', 'N° Seriale', 'Peso (kg)', 'Valore (€)', 'Paese']],
    body: tableBody,
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5, minCellHeight: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 66 },
      2: { cellWidth: 35 },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 16, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  })

  y = doc.lastAutoTable.finalY + 10

  // ── Customs note ──────────────────────────────────────────────────────────────
  if (y + 45 > 270) { doc.addPage(); y = 20 }
  doc.setFillColor(240, 253, 244)
  doc.setDrawColor(134, 239, 172)
  doc.roundedRect(14, y, W - 28, 36, 2, 2, 'FD')
  doc.setTextColor(20, 83, 45)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.text('NOTE DOGANALI / CUSTOMS NOTES', 20, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const notes = [
    '• Le merci sono importate temporaneamente per uso professionale e saranno riesportate entro la data indicata.',
    '• The goods are temporarily imported for professional use and will be re-exported by the indicated date.',
    '• Paese di origine: Italia / Country of origin: Italy',
    '• Tutte le merci sono di proprietà di Brain Digital e non destinate alla vendita.',
    '• All goods are owned by Brain Digital and not intended for sale.',
  ]
  notes.forEach((note, i) => {
    doc.setTextColor(i % 2 === 0 ? 20 : 52, i % 2 === 0 ? 83 : 120, i % 2 === 0 ? 45 : 70)
    doc.text(note, 20, y + 14 + i * 4.5, { maxWidth: W - 46 })
  })
  y += 44

  // ── Signatures ────────────────────────────────────────────────────────────────
  if (y + 38 > 275) { doc.addPage(); y = 20 }
  const sigBoxW = (W - 36) / 2
  const sigLabels = ['Firma Titolare / Holder\'s Signature', 'Visto Doganale / Customs Visa']
  sigLabels.forEach((label, i) => {
    const bx = 14 + i * (sigBoxW + 8)
    doc.setDrawColor(203, 213, 225)
    doc.setFillColor(250, 250, 250)
    doc.roundedRect(bx, y, sigBoxW, 30, 2, 2, 'FD')
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    doc.text(label, bx + 4, y + 7)
    doc.text('Data / Date: _______________', bx + 4, y + 25)
  })

  // ── Footer ────────────────────────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text('Brain Digital · ATA Carnet generato da GearVault', 14, 290)
    doc.text(`Pag. ${i}/${pages}`, W - 14, 290, { align: 'right' })
  }

  const safeName = set.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
  doc.save(`BrainDigital_ATACarnet_${safeName}_${todayFile}.pdf`)
}

/** Shared drawing logic — returns a jsPDF doc instance (does NOT save/output) */
async function buildQuoteDoc(quote, items, settings = {}) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const companyName    = settings.company_name    || 'Brain Digital'
  const companyAddress = settings.company_address || 'Via Dietro Le Mura, 7'
  const companyEmail   = settings.company_email   || 'info@braindigital.it'
  const companyPhone   = settings.company_phone   || ''

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const BLUE = [30, 58, 95]   // #1e3a5f
  const today = format(new Date(), 'dd/MM/yyyy', { locale: it })
  const todayFile = format(new Date(), 'yyyyMMdd')

  const STATUS_LABELS = {
    draft: 'Bozza',
    sent: 'Inviato',
    confirmed: 'Confermato',
    archived: 'Archiviato',
  }
  const STATUS_COLORS = {
    draft:     [148, 163, 184],
    sent:      [59,  130, 246],
    confirmed: [34,  197,  94],
    archived:  [100, 116, 139],
  }

  const fmt = (v) =>
    v != null && v !== '' && !isNaN(parseFloat(v))
      ? `€ ${parseFloat(v).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
      : '—'

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...BLUE)
  doc.rect(0, 0, W, 30, 'F')
  // Company name
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(companyName.toUpperCase(), 14, 12)
  // Company address + email
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 200, 220)
  doc.text(companyAddress, 14, 19)
  doc.text(companyEmail, 14, 24.5)
  // Right: quote label + number
  doc.setTextColor(180, 200, 220)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('PREVENTIVO', W - 14, 12, { align: 'right' })
  const quoteNum = `#PRV-${quote.id.slice(0, 8).toUpperCase()}`
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(quoteNum, W - 14, 20, { align: 'right' })
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 200, 220)
  doc.text(today, W - 14, 26.5, { align: 'right' })
  // Thin accent line
  doc.setFillColor(180, 200, 220)
  doc.rect(0, 30, W, 0.5, 'F')

  let y = 42

  // ── Title + status pill ──────────────────────────────────────────────────────
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(quote.title || 'Preventivo senza titolo', 14, y)

  const statusLabel = STATUS_LABELS[quote.status] || quote.status || ''
  const statusColor = STATUS_COLORS[quote.status] || [100, 116, 139]
  doc.setFontSize(7.5)
  const pillW = doc.getTextWidth(statusLabel) + 10
  doc.setFillColor(...statusColor)
  doc.roundedRect(W - 14 - pillW, y - 7, pillW, 8, 1.5, 1.5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text(statusLabel, W - 14 - pillW / 2, y - 2, { align: 'center' })

  y += 10

  // ── Info boxes (CLIENTE left · EVENTO right) ─────────────────────────────────
  const infoBoxH = 26
  const halfW = (W - 32) / 2

  // Client box
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, y, halfW, infoBoxH, 2, 2, 'FD')
  doc.setFillColor(...BLUE)
  doc.roundedRect(14, y, halfW, 7, 2, 2, 'F')
  doc.rect(14, y + 3.5, halfW, 3.5, 'F') // fill bottom corners of top bar
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('CLIENTE', 19, y + 5)
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(quote.client_name || '—', 19, y + 14)
  if (quote.client_email) {
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text(quote.client_email, 19, y + 21)
  }

  // Event box
  const rx = 14 + halfW + 4
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(rx, y, halfW, infoBoxH, 2, 2, 'FD')
  doc.setFillColor(...BLUE)
  doc.roundedRect(rx, y, halfW, 7, 2, 2, 'F')
  doc.rect(rx, y + 3.5, halfW, 3.5, 'F')
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('DATA EVENTO', rx + 5, y + 5)
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  const eventDateStr = quote.event_date
    ? format(new Date(quote.event_date), 'd MMMM yyyy', { locale: it })
    : '—'
  doc.text(eventDateStr, rx + 5, y + 14)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  const createdStr = quote.created_at
    ? `Creato il ${format(new Date(quote.created_at), 'dd/MM/yyyy')}`
    : ''
  doc.text(createdStr, rx + 5, y + 21)

  y += infoBoxH + 12

  // ── Equipment table ───────────────────────────────────────────────────────────
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text(`ATTREZZATURA  ·  ${items.length} item`, 14, y)
  y += 4

  const tableBody = items.map((item) => {
    const eq = item.equipment || {}
    const nameParts = [eq.name]
    const brandModel = [eq.brand, eq.model].filter(Boolean).join(' ')
    if (brandModel) nameParts.push(brandModel)
    const name = nameParts.join('\n')
    const qty = item.quantity || 1
    const days = item.days || 1
    const rate = parseFloat(item.daily_rate) || 0
    const lineTotal = qty * days * rate
    return [
      name,
      CATEGORY_LABELS[eq.category] || eq.category || '—',
      qty,
      days,
      fmt(rate),
      { content: fmt(lineTotal), styles: { fontStyle: 'bold' } },
    ]
  })

  const grandTotal = items.reduce((s, item) => {
    return s + (item.quantity || 1) * (item.days || 1) * (parseFloat(item.daily_rate) || 0)
  }, 0)

  autoTable(doc, {
    startY: y,
    head: [['Attrezzatura', 'Categoria', 'Qtà', 'Giorni', 'Tariffa/g', 'Totale']],
    body: tableBody,
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, minCellHeight: 10 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 28 },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 26, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  })

  y = doc.lastAutoTable.finalY + 8

  // ── Financial summary ─────────────────────────────────────────────────────────
  const discountPct = parseFloat(quote.discount_pct) || 0
  const discountAmt = grandTotal * discountPct / 100
  const netTotal    = grandTotal - discountAmt
  const ivaAmt      = netTotal * 0.22
  const totalIvato  = netTotal + ivaAmt

  const summaryW  = 95
  const summaryX  = W - 14 - summaryW
  const rowH      = 6.5
  let sy = y

  const summaryLines = [
    { label: 'Subtotale', value: fmt(grandTotal), bold: false },
    ...(discountPct > 0 ? [
      { label: `Sconto ${discountPct}%`, value: `- ${fmt(discountAmt)}`, bold: false, green: true },
      { label: 'Totale netto', value: fmt(netTotal), bold: false },
    ] : []),
    { label: 'IVA 22%', value: fmt(ivaAmt), bold: false },
  ]

  summaryLines.forEach(({ label, value, green }) => {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    if (green) doc.setTextColor(34, 197, 94)
    else doc.setTextColor(100, 116, 139)
    doc.text(label, summaryX, sy + 5)
    doc.text(value, W - 14, sy + 5, { align: 'right' })
    sy += rowH
  })

  // separator line
  doc.setDrawColor(226, 232, 240)
  doc.line(summaryX, sy + 1, W - 14, sy + 1)
  sy += 4

  // Grand total ivato box
  const calloutW = summaryW
  doc.setFillColor(...BLUE)
  doc.roundedRect(summaryX, sy, calloutW, 13, 2, 2, 'F')
  doc.setTextColor(180, 200, 220)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTALE IVATO', summaryX + 5, sy + 8.5)
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(fmt(totalIvato), W - 18, sy + 9, { align: 'right' })

  y = sy + 20

  // ── Notes ─────────────────────────────────────────────────────────────────────
  if (quote.notes && quote.notes.trim()) {
    if (y + 24 > 270) { doc.addPage(); y = 20 }
    const noteLines = doc.splitTextToSize(quote.notes.trim(), W - 50)
    const noteBoxH = 14 + noteLines.length * 4.5
    // Yellow left border
    doc.setFillColor(255, 251, 235)
    doc.setDrawColor(245, 158, 11)
    doc.roundedRect(14, y, W - 28, noteBoxH, 2, 2, 'FD')
    doc.setFillColor(245, 158, 11)
    doc.roundedRect(14, y, 3, noteBoxH, 1, 1, 'F')
    doc.setTextColor(146, 64, 14)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('NOTE', 22, y + 6.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    noteLines.forEach((line, i) => doc.text(line, 22, y + 12 + i * 4.5))
    y += noteBoxH + 8
  }

  // ── Footer (all pages) ────────────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages()
  const footerParts = [companyName, companyAddress, companyEmail]
  if (companyPhone) footerParts.push(companyPhone)
  const footerLeft = footerParts.join('  ·  ')
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240)
    doc.line(14, 286, W - 14, 286)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text(footerLeft, 14, 291)
    doc.text(`Pag. ${i}/${pages}`, W - 14, 291, { align: 'right' })
  }

  return { doc, safeTitle: (quote.title || 'preventivo').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, ''), todayFile }
}

/** Quote / Preventivo PDF — client-side: fetches app_settings, then downloads */
export async function exportQuotePDF(quote, items) {
  const { getSupabase } = await import('@/lib/supabase')
  const supabase = getSupabase()
  let settings = {}
  try {
    const { data } = await supabase.from('app_settings').select('key, value')
    if (data) data.forEach(({ key, value }) => { settings[key] = value })
  } catch (_) { /* fallback to defaults */ }

  const { doc, safeTitle, todayFile } = await buildQuoteDoc(quote, items, settings)
  doc.save(`BrainDigital_Preventivo_${safeTitle}_${todayFile}.pdf`)
}

/**
 * Quote / Preventivo PDF — server-side: accepts pre-fetched settings, returns Buffer.
 * Used by the /api/email route to attach the PDF to outgoing emails.
 */
export async function generateQuotePDFBuffer(quote, items, settings = {}) {
  const { doc } = await buildQuoteDoc(quote, items, settings)
  return Buffer.from(doc.output('arraybuffer'))
}

/** Field checklist — compact portrait A4 with checkboxes, grouped by category */
export async function exportSetChecklist(set, items) {
  const { default: jsPDF } = await import('jspdf')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const today = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: it })
  const todayFile = format(new Date(), 'yyyyMMdd')
  const W = 210

  // Header
  drawHeader(doc, `Checklist Set: ${set.name}`, 'Lista di carico/scarico attrezzatura', today, W)

  let y = 35
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  if (set.job_date) {
    doc.text(`Data: ${format(new Date(set.job_date), 'd MMMM yyyy', { locale: it })}`, 14, y)
    y += 5
  }
  if (set.location) {
    doc.text(`Location: ${set.location}`, 14, y)
    y += 5
  }
  y += 3

  // Extract and group equipment by category
  const equipment = items.map((i) => i.equipment || i).filter((e) => e && e.name)
  const grouped = {}
  equipment.forEach((e) => {
    const cat = CATEGORY_LABELS[e.category] || e.category || 'Altro'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(e)
  })

  const ROW_H = 8
  const PAGE_H = 280

  function checkNewPage(neededY) {
    if (neededY > PAGE_H) {
      doc.addPage()
      y = 20
    }
  }

  // Two-column layout
  const COL_W = (W - 28) / 2
  const COL2_X = 14 + COL_W + 4
  let col = 0 // 0=left, 1=right
  let rowStartY = y

  function drawRow(eq) {
    const x = col === 0 ? 14 : COL2_X
    if (col === 0) rowStartY = y

    checkNewPage(y + ROW_H)

    // checkbox
    doc.setDrawColor(150)
    doc.rect(x, y - 4.5, 4, 4)

    // name
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30)
    const nameMax = COL_W - 10
    const name = doc.splitTextToSize(eq.name, nameMax)[0]
    doc.text(name, x + 6, y - 1)

    // sub-line
    const sub = [eq.brand, eq.serial_number ? `S/N: ${eq.serial_number}` : ''].filter(Boolean).join(' · ')
    if (sub) {
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100)
      doc.text(sub, x + 6, y + 2.5)
    }

    doc.setDrawColor(220)
    doc.line(x, y + 3.5, x + COL_W, y + 3.5)

    if (col === 0) {
      col = 1
    } else {
      col = 0
      y += ROW_H
    }
  }

  Object.entries(grouped).forEach(([cat, catItems]) => {
    // Flush to new row before category heading
    if (col === 1) { col = 0; y += ROW_H }
    checkNewPage(y + 10)

    // Category heading
    doc.setFillColor(15, 23, 42)
    doc.rect(14, y - 4, W - 28, 6, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255)
    doc.text(cat.toUpperCase(), 17, y - 0.5)
    doc.setTextColor(180)
    doc.text(`${catItems.length} item`, W - 14, y - 0.5, { align: 'right' })
    y += 6

    catItems.forEach((eq) => drawRow(eq))
    if (col === 1) { col = 0; y += ROW_H }
    y += 2
  })

  // Totals line
  y += 4
  checkNewPage(y + 20)
  doc.setDrawColor(37, 99, 235)
  doc.setLineWidth(0.5)
  doc.line(14, y, W - 14, y)
  doc.setLineWidth(0.2)
  y += 5
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30)
  doc.text(`Totale item: ${equipment.length}`, 14, y)

  // Signature boxes
  y += 10
  checkNewPage(y + 35)
  const boxW = (W - 40) / 2
  ;['Uscita — Firma', 'Rientro — Firma'].forEach((label, i) => {
    const bx = 14 + i * (boxW + 12)
    doc.setDrawColor(150)
    doc.setFillColor(250, 250, 250)
    doc.rect(bx, y, boxW, 22, 'FD')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text(label, bx + 3, y + 5)
    doc.text('Data: ___________', bx + 3, y + 18)
  })

  // Footer
  doc.setFontSize(7)
  doc.setTextColor(150)
  doc.text('GearVault — Brain Digital', 14, 290)
  doc.text(`Pagina 1 di ${doc.internal.getNumberOfPages()}`, W - 14, 290, { align: 'right' })

  doc.save(`BrainDigital_Checklist_${set.name.replace(/\s+/g, '_')}_${todayFile}.pdf`)
}
