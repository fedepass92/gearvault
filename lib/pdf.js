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
