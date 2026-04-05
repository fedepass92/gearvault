'use client'

import { useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import JsBarcode from 'jsbarcode'

const BASE = 'https://gear.braindigital.it'

// Format specs
export const LABEL_FORMATS = [
  { id: 'standard', label: 'Standard', size: '62×38mm' },
  { id: 'small', label: 'Small', size: '38×25mm' },
  { id: 'xs', label: 'XS', size: '25×15mm' },
  { id: 'cable', label: 'Cavo', size: '80×15mm' },
]

function useBarcode(ref, value, options = {}) {
  useEffect(() => {
    if (ref.current && value) {
      try {
        JsBarcode(ref.current, value, {
          format: 'CODE128',
          displayValue: false,
          margin: 0,
          background: '#ffffff',
          lineColor: '#0f172a',
          ...options,
        })
      } catch { /* invalid value */ }
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
}

// ── Standard 62×38mm ────────────────────────────────────────────────────────
function LabelStandard({ item, isCase, isKit, qrValue }) {
  return (
    <div
      className="label-card bg-white text-black flex flex-col"
      style={{
        width: '62mm', minHeight: '38mm',
        pageBreakInside: 'avoid',
        borderRadius: '5px',
        border: '1px solid #e2e8f0',
        fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
        overflow: 'hidden',
      }}
    >
      <div style={{ background: '#0f172a', height: '3px' }} />
      <div style={{ padding: '5px 7px 0', display: 'flex', gap: '6px', flex: 1 }}>
        {/* Left text */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '9px', fontWeight: '700', color: '#0f172a', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.name}
          </div>
          {(isCase || isKit) ? (
            item.description && (
              <div style={{ fontSize: '7px', color: '#64748b', marginTop: '2px', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {item.description}
              </div>
            )
          ) : (
            (item.brand || item.model) && (
              <div style={{ fontSize: '7px', color: '#64748b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {[item.brand, item.model].filter(Boolean).join(' · ')}
              </div>
            )
          )}
          {!isCase && !isKit && item.serial_number && (
            <div style={{ fontSize: '6.5px', fontFamily: 'monospace', color: '#475569', marginTop: '5px', background: '#f1f5f9', borderRadius: '2px', padding: '1px 3px', display: 'inline-block' }}>
              {item.serial_number}
            </div>
          )}
          {(isCase || isKit) && (
            <div style={{ fontSize: '6px', color: isKit ? '#7c3aed' : '#1e40af', marginTop: '5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isKit ? 'Kit' : 'Case'}
            </div>
          )}
        </div>
        {/* QR */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3px 0' }}>
          <QRCodeSVG value={qrValue} size={52} level="M" style={{ display: 'block' }} />
        </div>
      </div>
      <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '2px 7px', display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <span style={{ fontSize: '5.5px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Brain Digital</span>
        <span style={{ fontSize: '5.5px', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>GearVault</span>
      </div>
    </div>
  )
}

// ── Small 38×25mm ────────────────────────────────────────────────────────────
function LabelSmall({ item, isCase, isKit, qrValue }) {
  return (
    <div
      className="label-card bg-white text-black flex flex-col"
      style={{
        width: '38mm', minHeight: '25mm',
        pageBreakInside: 'avoid',
        borderRadius: '4px',
        border: '1px solid #e2e8f0',
        fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
        overflow: 'hidden',
      }}
    >
      <div style={{ background: '#0f172a', height: '2.5px' }} />
      <div style={{ padding: '4px 5px', flex: 1, display: 'flex', gap: '4px', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '7.5px', fontWeight: '700', color: '#0f172a', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.name}
          </div>
          {!isCase && !isKit && item.serial_number && (
            <div style={{ fontSize: '6px', fontFamily: 'monospace', color: '#64748b', marginTop: '3px' }}>
              {item.serial_number}
            </div>
          )}
          {(isCase || isKit) && (
            <div style={{ fontSize: '5.5px', color: isKit ? '#7c3aed' : '#1e40af', marginTop: '3px', fontWeight: '700', textTransform: 'uppercase' }}>
              {isKit ? 'Kit' : 'Case'}
            </div>
          )}
        </div>
        <QRCodeSVG value={qrValue} size={34} level="M" style={{ display: 'block', flexShrink: 0 }} />
      </div>
    </div>
  )
}

// ── XS 25×15mm ───────────────────────────────────────────────────────────────
function LabelXS({ item, isCase, isKit, qrValue }) {
  return (
    <div
      className="label-card bg-white text-black flex"
      style={{
        width: '25mm', height: '15mm',
        pageBreakInside: 'avoid',
        borderRadius: '3px',
        border: '1px solid #e2e8f0',
        fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
        overflow: 'hidden',
        alignItems: 'center',
        gap: '3px',
        padding: '2px 3px',
      }}
    >
      <QRCodeSVG value={qrValue} size={26} level="L" style={{ display: 'block', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '5.5px', fontWeight: '700', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </div>
        {!isCase && !isKit && item.serial_number && (
          <div style={{ fontSize: '5px', fontFamily: 'monospace', color: '#64748b', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.serial_number}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Cable 80×15mm ─────────────────────────────────────────────────────────────
function LabelCable({ item, isCase, isKit, qrValue }) {
  const barcodeRef = useRef()
  useBarcode(barcodeRef, item.serial_number || item.name, { width: 1, height: 22 })

  return (
    <div
      className="label-card bg-white text-black flex"
      style={{
        width: '80mm', height: '15mm',
        pageBreakInside: 'avoid',
        borderRadius: '3px',
        border: '1px solid #e2e8f0',
        fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
        overflow: 'hidden',
        alignItems: 'stretch',
      }}
    >
      <div style={{ background: '#0f172a', width: '2.5px', flexShrink: 0 }} />
      {/* Text */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2px 5px', minWidth: 0, flex: '0 0 auto', maxWidth: '35mm' }}>
        <div style={{ fontSize: '6.5px', fontWeight: '700', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </div>
        {!isCase && !isKit && item.serial_number && (
          <div style={{ fontSize: '5.5px', fontFamily: 'monospace', color: '#64748b', marginTop: '1px' }}>
            {item.serial_number}
          </div>
        )}
      </div>
      {/* Separator */}
      <div style={{ width: '1px', background: '#e2e8f0', flexShrink: 0, margin: '3px 0' }} />
      {/* Barcode */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
        {(item.serial_number || item.name) ? (
          <svg ref={barcodeRef} style={{ maxWidth: '100%', height: '22px' }} />
        ) : (
          <QRCodeSVG value={qrValue} size={22} level="L" style={{ display: 'block' }} />
        )}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function LabelCard({ item, format = 'standard', isCase = false, isKit = false }) {
  const qrValue = isCase
    ? BASE + '/scan/case/' + item.id
    : isKit
    ? BASE + '/scan/kit/' + item.id
    : BASE + '/scan/' + item.id

  const props = { item, isCase, isKit, qrValue }

  if (format === 'small') return <LabelSmall {...props} />
  if (format === 'xs') return <LabelXS {...props} />
  if (format === 'cable') return <LabelCable {...props} />
  return <LabelStandard {...props} />
}
