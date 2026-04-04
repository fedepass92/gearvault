'use client'

import { useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import JsBarcode from 'jsbarcode'

export default function LabelCard({ item, type = 'qr', isCase = false, isKit = false }) {
  const barcodeRef = useRef()

  const base = 'https://gear.braindigital.it'
  const qrValue = isCase
    ? base + '/scan/case/' + item.id
    : isKit
    ? base + '/scan/kit/' + item.id
    : base + '/scan/' + item.id

  useEffect(() => {
    if (type === 'barcode' && barcodeRef.current && item.serial_number) {
      try {
        JsBarcode(barcodeRef.current, item.serial_number, {
          format: 'CODE128',
          width: 1.2,
          height: 28,
          displayValue: false,
          margin: 0,
          background: '#ffffff',
          lineColor: '#0f172a',
        })
      } catch {
        // Invalid barcode value
      }
    }
  }, [type, item.serial_number])

  return (
    <div
      className="label-card bg-white text-black flex flex-col"
      style={{
        width: '62mm',
        minHeight: '38mm',
        pageBreakInside: 'avoid',
        borderRadius: '6px',
        border: '1px solid #e2e8f0',
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* Top accent bar */}
      <div style={{ background: '#0f172a', height: '4px', width: '100%' }} />

      <div style={{ padding: '6px 8px 5px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Name */}
        <div style={{
          fontSize: '9px',
          fontWeight: '700',
          color: '#0f172a',
          letterSpacing: '0.01em',
          lineHeight: 1.25,
          marginBottom: '2px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {item.name}
        </div>

        {/* Brand / Model or case description */}
        {(isCase || isKit) ? (
          item.description && (
            <div style={{
              fontSize: '7px',
              color: '#64748b',
              marginBottom: '4px',
              lineHeight: 1.3,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}>
              {item.description}
            </div>
          )
        ) : (
          (item.brand || item.model) && (
            <div style={{
              fontSize: '7px',
              color: '#64748b',
              marginBottom: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {[item.brand, item.model].filter(Boolean).join(' · ')}
            </div>
          )
        )}

        {/* QR or Barcode */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 0' }}>
          {type === 'qr' ? (
            <QRCodeSVG
              value={qrValue}
              size={56}
              level="M"
              style={{ display: 'block' }}
            />
          ) : (
            item.serial_number ? (
              <svg ref={barcodeRef} />
            ) : (
              <div style={{ fontSize: '7px', color: '#94a3b8', fontStyle: 'italic' }}>Nessun seriale</div>
            )
          )}
        </div>

        {/* Serial / Case badge */}
        {!isCase && !isKit && item.serial_number && (
          <div style={{
            fontSize: '7px',
            fontFamily: 'monospace',
            color: '#475569',
            textAlign: 'center',
            marginTop: '2px',
          }}>
            S/N {item.serial_number}
          </div>
        )}
        {(isCase || isKit) && (
          <div style={{
            fontSize: '6.5px',
            color: isKit ? '#7c3aed' : '#1e40af',
            textAlign: 'center',
            marginTop: '2px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {isKit ? 'Kit' : 'Case'}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        background: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
        padding: '2px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '6px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Brain Digital
        </span>
        <span style={{ fontSize: '6px', color: '#cbd5e1', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          GearVault
        </span>
      </div>
    </div>
  )
}
