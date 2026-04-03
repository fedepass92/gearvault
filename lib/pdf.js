import { format } from 'date-fns'
import { it } from 'date-fns/locale'

const CATEGORY_LABELS = {
  camera: 'Camera',
  lens: 'Obiettivo',
  drone: 'Drone',
  audio: 'Audio',
  lighting: 'Illuminazione',
  support: 'Supporto',
  accessory: 'Accessorio',
  altro: 'Altro',
}

const CONDITION_LABELS = {
  active: 'Attivo',
  repair: 'In riparazione',
  retired: 'Ritirato',
}

/** Export PDF assicurativo per un singolo set */
export async function exportSetInsurancePDF(set, items) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const today = format(new Date(), 'dd/MM/yyyy', { locale: it })
  const todayFile = format(new Date(), 'yyyyMMdd')

  // Header band
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, 210, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Brain Digital', 14, 11)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('GearVault — Dichiarazione valori per polizza assicurativa', 14, 18)
  doc.setFontSize(8)
  doc.text(`Generato il: ${today}`, 196, 11, { align: 'right' })

  // Accent line
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 28, 210, 1.5, 'F')

  doc.setTextColor(0, 0, 0)

  // Set info block
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(`Set: ${set.name}`, 14, 40)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  let infoY = 47
  if (set.job_date) {
    doc.text(`Data lavoro: ${format(new Date(set.job_date), 'd MMMM yyyy', { locale: it })}`, 14, infoY)
    infoY += 5
  }
  if (set.location) {
    doc.text(`Location: ${set.location}`, 14, infoY)
    infoY += 5
  }
  if (set.notes) {
    doc.text(`Note: ${set.notes}`, 14, infoY)
    infoY += 5
  }

  doc.setTextColor(0, 0, 0)

  const equipment = items.map((i) => i.equipment).filter(Boolean)

  const totalMarket = equipment.reduce((s, e) => s + (parseFloat(e.market_value) || 0), 0)
  const totalInsured = equipment.reduce((s, e) => s + (parseFloat(e.insured_value) || 0), 0)

  const tableData = equipment.map((e) => [
    e.name || '',
    e.brand || '',
    e.serial_number || '',
    CATEGORY_LABELS[e.category] || e.category || '',
    e.purchase_date ? format(new Date(e.purchase_date), 'dd/MM/yyyy') : '',
    e.market_value ? `€ ${parseFloat(e.market_value).toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—',
    e.insured_value ? `€ ${parseFloat(e.insured_value).toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—',
    CONDITION_LABELS[e.condition] || e.condition || '',
  ])

  tableData.push([
    { content: `TOTALE (${equipment.length} item)`, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
    { content: `€ ${totalMarket.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
    { content: `€ ${totalInsured.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
    { content: '', styles: { fillColor: [241, 245, 249] } },
  ])

  autoTable(doc, {
    startY: infoY + 4,
    head: [['Nome', 'Marca', 'Seriale', 'Categoria', 'Data Acquisto', 'Val. Mercato', 'Val. Assicurato', 'Condizione']],
    body: tableData,
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 25 },
      2: { cellWidth: 28 },
      3: { cellWidth: 22 },
      4: { cellWidth: 22 },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 25, halign: 'right' },
      7: { cellWidth: 18 },
    },
    margin: { left: 14, right: 14 },
  })

  // Disclaimer
  const finalY = doc.lastAutoTable.finalY + 8
  doc.setFontSize(7.5)
  doc.setTextColor(120)
  doc.setFont('helvetica', 'italic')
  const disclaimer =
    'Documento generato da GearVault per uso assicurativo. I valori riportati sono indicativi e soggetti a verifica.'
  doc.text(disclaimer, 14, finalY, { maxWidth: 182 })

  // Page numbers
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150)
    doc.text(`Pagina ${i} di ${pageCount}`, 196, 290, { align: 'right' })
    doc.text('GearVault — Brain Digital © ' + new Date().getFullYear(), 14, 290)
  }

  doc.save(`BrainDigital_Set_${set.name.replace(/\s+/g, '_')}_${todayFile}.pdf`)
}

export async function exportInsuranceReport(items, categoria = null) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const today = format(new Date(), 'dd/MM/yyyy', { locale: it })
  const todayFile = format(new Date(), 'yyyyMMdd')

  // Header
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, 297, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Elenco Attrezzature — Brain Digital', 14, 13)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generato il: ${today}`, 250, 13, { align: 'right' })
  if (categoria) {
    doc.text(`Categoria: ${CATEGORY_LABELS[categoria] || categoria}`, 200, 13, { align: 'right' })
  }

  doc.setTextColor(0, 0, 0)

  const filteredItems = categoria ? items.filter((i) => i.category === categoria) : items

  const totalPurchase = filteredItems.reduce((s, i) => s + (parseFloat(i.purchase_price) || 0), 0)
  const totalMarket = filteredItems.reduce((s, i) => s + (parseFloat(i.market_value) || 0), 0)

  const tableData = filteredItems.map((item) => [
    item.name || '',
    item.brand || '',
    item.model || '',
    item.serial_number || '',
    item.purchase_date ? format(new Date(item.purchase_date), 'dd/MM/yyyy') : '',
    item.purchase_price ? `€ ${parseFloat(item.purchase_price).toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '',
    item.market_value ? `€ ${parseFloat(item.market_value).toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '',
    CONDITION_LABELS[item.condition] || item.condition || '',
  ])

  // Footer row
  tableData.push([
    { content: `TOTALE (${filteredItems.length} item)`, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
    { content: `€ ${totalPurchase.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
    { content: `€ ${totalMarket.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
    { content: '', styles: { fillColor: [241, 245, 249] } },
  ])

  autoTable(doc, {
    startY: 25,
    head: [['Nome', 'Marca', 'Modello', 'Seriale', 'Data Acquisto', 'Val. Acquisto', 'Val. Mercato', 'Condizione']],
    body: tableData,
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 30 },
      2: { cellWidth: 35 },
      3: { cellWidth: 35 },
      4: { cellWidth: 25 },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 28, halign: 'right' },
      7: { cellWidth: 22 },
    },
    margin: { left: 14, right: 14 },
  })

  // Page numbers
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(`Pagina ${i} di ${pageCount}`, 283, 205, { align: 'right' })
    doc.text('GearVault — Brain Digital © ' + new Date().getFullYear(), 14, 205)
  }

  doc.save(`BrainDigital_Attrezzature_${todayFile}.pdf`)
}
