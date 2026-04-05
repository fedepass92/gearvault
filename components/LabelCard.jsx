'use client'

import { useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import JsBarcode from 'jsbarcode'

const BASE = 'https://gear.braindigital.it'

export const LABEL_FORMATS = [
  { id: 'standard', label: 'Standard', size: '62×38mm' },
  { id: 'small',    label: 'Small',    size: '38×25mm' },
  { id: 'xs',       label: 'XS',       size: '25×15mm' },
  { id: 'cable',    label: 'Cavo',     size: '80×15mm' },
]

// Brain Digital logo as inline SVG
function BrainLogo({ width = 52, color = '#0f172a' }) {
  return (
    <svg
      width={width}
      viewBox="0 0 200 80"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <text
        x="100" y="54"
        textAnchor="middle"
        fontFamily="'Arial Black','Impact','Helvetica Neue',Arial,sans-serif"
        fontWeight="900"
        fontSize="58"
        letterSpacing="-2"
        fill={color}
      >
        BRAIN
      </text>
      <rect x="8" y="60" width="184" height="2.5" fill={color} />
      <text
        x="100" y="76"
        textAnchor="middle"
        fontFamily="'Arial','Helvetica Neue',Arial,sans-serif"
        fontWeight="700"
        fontSize="14"
        letterSpacing="10"
        fill={color}
      >
        DIGITAL
      </text>
    </svg>
  )
}

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

// ── Standard 62×38mm ─────────────────────────────────────────────────────────
// Style: QR prominent top-right, item info left, Brain Digital logo bottom
function LabelStandard({ item, isCase, isKit, qrValue }) {
  return (
    <div
      className="label-card"
      style={{
        width: '62mm',
        minHeight: '38mm',
        background: '#ffffff',
        color: '#0f172a',
        pageBreakInside: 'avoid',
        borderRadius: '4px',
        border: '1.5px solid #e2e8f0',
        fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', padding: '6px 6px 4px' }}>
        {/* Left: text info */}
        <div style={{ flex: 1, minWidth: 0, paddingRight: '5px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {(isCase || isKit) && (
            <div style={{
              fontSize: '5px', fontWeight: '800', letterSpacing: '0.12em',
              textTransform: 'uppercase', color: isKit ? '#7c3aed' : '#1e40af',
              marginBottom: '3px',
            }}>
              {isKit ? '● KIT' : '● CASE'}
            </div>
          )}
          <div style={{
            fontSize: '9.5px', fontWeight: '800', color: '#0f172a',
            lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.name}
          </div>
          {!isCase && !isKit && (item.brand || item.model) && (
            <div style={{
              fontSize: '6.5px', color: '#64748b', marginTop: '2px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {[item.brand, item.model].filter(Boolean).join(' · ')}
            </div>
          )}
          {isCase || isKit ? (
            item.description && (
              <div style={{
                fontSize: '6px', color: '#64748b', marginTop: '2px', lineHeight: 1.3,
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {item.description}
              </div>
            )
          ) : null}
          {!isCase && !isKit && item.serial_number && (
            <div style={{
              fontSize: '6px', fontFamily: 'monospace', color: '#475569',
              marginTop: '4px', background: '#f1f5f9', borderRadius: '2px',
              padding: '1px 3px', display: 'inline-block',
            }}>
              {item.serial_number}
            </div>
          )}
        </div>
        {/* Right: QR */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <QRCodeSVG value={qrValue} size={56} level="M" style={{ display: 'block' }} />
        </div>
      </div>
      {/* Footer: Brain Digital logo */}
      <div style={{
        borderTop: '1px solid #e2e8f0',
        padding: '3px 7px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
      }}>
        <BrainLogo width={46} color="#0f172a" />
      </div>
    </div>
  )
}

// ── Small 38×25mm ─────────────────────────────────────────────────────────────
function LabelSmall({ item, isCase, isKit, qrValue }) {
  return (
    <div
      className="label-card"
      style={{
        width: '38mm',
        minHeight: '25mm',
        background: '#ffffff',
        color: '#0f172a',
        pageBreakInside: 'avoid',
        borderRadius: '3px',
        border: '1.5px solid #e2e8f0',
        fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Main */}
      <div style={{ flex: 1, display: 'flex', padding: '4px 4px 3px', gap: '4px', alignItems: 'center' }}>
        {/* QR left */}
        <QRCodeSVG value={qrValue} size={38} level="M" style={{ display: 'block', flexShrink: 0 }} />
        {/* Text right */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '7.5px', fontWeight: '800', color: '#0f172a',
            lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.name}
          </div>
          {!isCase && !isKit && item.serial_number && (
            <div style={{ fontSize: '5.5px', fontFamily: 'monospace', color: '#64748b', marginTop: '2px' }}>
              {item.serial_number}
            </div>
          )}
          {(isCase || isKit) && (
            <div style={{
              fontSize: '5px', color: isKit ? '#7c3aed' : '#1e40af',
              marginTop: '2px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              {isKit ? 'Kit' : 'Case'}
            </div>
          )}
        </div>
      </div>
      {/* Footer logo */}
      <div style={{
        borderTop: '1px solid #e2e8f0',
        background: '#f8fafc',
        display: 'flex',
        justifyContent: 'center',
        padding: '2px 0',
      }}>
        <BrainLogo width={32} color="#94a3b8" />
      </div>
    </div>
  )
}

// ── XS 25×15mm ────────────────────────────────────────────────────────────────
// Too small for logo — just QR + name
function LabelXS({ item, isCase, isKit, qrValue }) {
  return (
    <div
      className="label-card"
      style={{
        width: '25mm',
        height: '15mm',
        background: '#ffffff',
        color: '#0f172a',
        pageBreakInside: 'avoid',
        borderRadius: '2px',
        border: '1.5px solid #e2e8f0',
        fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '2px 3px',
      }}
    >
      <QRCodeSVG value={qrValue} size={28} level="L" style={{ display: 'block', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '5.5px', fontWeight: '800', color: '#0f172a',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.name}
        </div>
        {!isCase && !isKit && item.serial_number && (
          <div style={{
            fontSize: '4.5px', fontFamily: 'monospace', color: '#64748b',
            marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
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
  useBarcode(barcodeRef, item.serial_number || item.name, { width: 1.2, height: 24 })

  return (
    <div
      className="label-card"
      style={{
        width: '80mm',
        height: '15mm',
        background: '#ffffff',
        color: '#0f172a',
        pageBreakInside: 'avoid',
        borderRadius: '2px',
        border: '1.5px solid #e2e8f0',
        fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'stretch',
      }}
    >
      {/* Left accent */}
      <div style={{ background: '#0f172a', width: '3px', flexShrink: 0 }} />
      {/* Logo block */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2px 5px', flexShrink: 0,
      }}>
        <BrainLogo width={28} color="#0f172a" />
      </div>
      {/* Separator */}
      <div style={{ width: '1px', background: '#e2e8f0', flexShrink: 0, margin: '3px 0' }} />
      {/* Text */}
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '2px 5px', minWidth: 0, flex: '0 0 auto', maxWidth: '28mm',
      }}>
        <div style={{
          fontSize: '6.5px', fontWeight: '800', color: '#0f172a',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.name}
        </div>
        {!isCase && !isKit && item.serial_number && (
          <div style={{ fontSize: '5px', fontFamily: 'monospace', color: '#64748b', marginTop: '1px' }}>
            {item.serial_number}
          </div>
        )}
      </div>
      {/* Separator */}
      <div style={{ width: '1px', background: '#e2e8f0', flexShrink: 0, margin: '3px 0' }} />
      {/* Barcode */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
        {(item.serial_number || item.name) ? (
          <svg ref={barcodeRef} style={{ maxWidth: '100%', height: '24px' }} />
        ) : (
          <QRCodeSVG value={qrValue} size={24} level="L" style={{ display: 'block' }} />
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
