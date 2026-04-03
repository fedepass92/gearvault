'use client'

import { useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import JsBarcode from 'jsbarcode'

export default function LabelCard({ item, type = 'qr' }) {
  const barcodeRef = useRef()

  const qrValue = `GEARVAULT:${item.id}:${item.serial_number || ''}:${item.name}`

  useEffect(() => {
    if (type === 'barcode' && barcodeRef.current && item.serial_number) {
      try {
        JsBarcode(barcodeRef.current, item.serial_number, {
          format: 'CODE128',
          width: 1.5,
          height: 40,
          displayValue: false,
          margin: 0,
          background: '#ffffff',
          lineColor: '#000000',
        })
      } catch {
        // Invalid barcode value
      }
    }
  }, [type, item.serial_number])

  return (
    <div
      className="label-card bg-white text-black rounded border border-gray-300 p-3 flex flex-col items-center"
      style={{ width: '85mm', minHeight: '54mm', pageBreakInside: 'avoid' }}
    >
      {/* Name */}
      <div className="w-full text-center font-bold text-sm leading-tight mb-1 truncate">
        {item.name}
      </div>

      {/* Brand / Model */}
      {(item.brand || item.model) && (
        <div className="w-full text-center text-xs text-gray-600 mb-2 truncate">
          {[item.brand, item.model].filter(Boolean).join(' – ')}
        </div>
      )}

      {/* QR or Barcode */}
      <div className="flex-1 flex items-center justify-center my-1">
        {type === 'qr' ? (
          <QRCodeSVG value={qrValue} size={80} level="M" />
        ) : (
          item.serial_number ? (
            <svg ref={barcodeRef} />
          ) : (
            <div className="text-xs text-gray-400 italic">Nessun seriale</div>
          )
        )}
      </div>

      {/* Serial */}
      {item.serial_number && (
        <div className="w-full text-center font-mono text-[10px] text-gray-700 mt-1">
          S/N: {item.serial_number}
        </div>
      )}

      {/* Footer */}
      <div className="w-full text-center text-[9px] text-gray-400 mt-1 border-t border-gray-100 pt-1">
        Brain Digital · GearVault
      </div>
    </div>
  )
}
