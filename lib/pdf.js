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
