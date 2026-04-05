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

// Brain Digital logo — real SVG paths, scaled to any width
function BrainLogo({ width = 60, color = '#010101' }) {
  const fill = color
  return (
    <svg
      width={width}
      viewBox="0 0 723.29 271.79"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* Bottom BRAIN DIGITAL strip */}
      <g fill={fill}>
        <polygon points="16.75 238.09 16.75 256.69 33.22 256.69 35.34 254.61 35.34 240.22 33.22 238.09 16.75 238.09"/>
        <rect x="568.6" y="238.09" width="18.55" height="6.18"/>
        <path d="M0,223.49v48.3h723.29v-48.3H0ZM41.48,256.64l-6.18,6.18H10.56v-30.91h24.73l6.18,6.18v18.55ZM137.02,262.82h-6.18v-30.91h6.18v30.91ZM257.27,238.09h-24.73v18.55h18.55v-6.18h-12.36v-6.18h18.55v18.55h-30.91v-30.91h30.91v6.18ZM352.81,262.82h-6.18v-30.91h6.18v30.91ZM473.06,238.09h-12.36v24.73h-6.18v-24.73h-12.36v-6.18h30.91v6.18ZM593.33,262.82h-6.18v-12.36h-18.55v12.36h-6.18v-30.91h30.91v30.91ZM713.6,262.82h-30.91v-30.91h6.18v24.73h24.73v6.18Z"/>
      </g>
      {/* BRAIN letterforms */}
      <g fill={fill}>
        <path d="M89.49,0c13.11,0,24.3,4.63,33.57,13.9s13.9,20.46,13.9,33.57v16.01c0,13.11-4.63,24.3-13.9,33.57-.94.94-1.87,1.78-2.81,2.53v.14c2.71,1.78,5.29,3.84,7.72,6.18,9.27,9.18,13.9,20.46,13.9,33.85v23.46c0,13.11-4.63,24.3-13.9,33.57-9.27,9.27-20.46,13.9-33.57,13.9H5.08c-3.37,0-5.06-1.69-5.06-5.06V5.06C.02,1.69,1.71,0,5.08,0h84.41ZM50.58,45.51v35.39c0,2.25,1.12,3.37,3.37,3.37h22.61c6.55,0,9.83-3.28,9.83-9.83v-22.47c0-6.55-3.28-9.83-9.83-9.83h-22.61c-2.25,0-3.37,1.12-3.37,3.37ZM50.58,129.78v35.39c0,2.25,1.12,3.37,3.37,3.37h24.02c8.89,0,13.34-3.74,13.34-11.24v-19.66c0-7.49-3.75-11.24-11.24-11.24h-26.12c-2.25,0-3.37,1.12-3.37,3.37Z"/>
        <path d="M287.38,105.2c7.87,8.8,11.8,19.24,11.8,31.32v69.1c0,3.37-1.69,5.06-5.06,5.06h-41.15c-3.37,0-5.06-1.69-5.06-5.06v-67.98c0-7.49-3.75-11.24-11.24-11.24h-20.37c-1.87,0-2.81,1.12-2.81,3.37v75.84c0,3.37-1.69,5.06-5.06,5.06h-40.45c-3.37,0-5.06-1.69-5.06-5.06V5.06c0-3.37,1.69-5.06,5.06-5.06h83.01c13.11,0,24.3,4.63,33.57,13.9,9.27,9.27,13.9,20.46,13.9,33.57v26.97c0,11.7-3.7,21.91-11.1,30.62v.14ZM213.51,45.51v35.39c0,2.25,1.12,3.37,3.37,3.37h21.21c6.55,0,9.83-3.28,9.83-9.83v-22.47c0-6.55-3.28-9.83-9.83-9.83h-21.21c-2.25,0-3.37,1.12-3.37,3.37Z"/>
        <path d="M375.72,160.81l-7.16,44.8c-.56,3.37-2.53,5.06-5.9,5.06h-42.28c-2.81,0-4.21-1.17-4.21-3.51,0-.47.05-.98.14-1.54L354.8,5.06c.65-3.37,2.67-5.06,6.04-5.06h67.7c3.37,0,5.38,1.69,6.04,5.06l38.48,200.56c.09.56.14,1.08.14,1.54,0,2.34-1.4,3.51-4.21,3.51h-42.28c-3.37,0-5.34-1.69-5.9-5.06l-7.16-44.8h-37.92ZM394.69,45.22l-12.64,76.97h25.28l-12.64-76.97Z"/>
        <path d="M540.75,205.62c0,3.37-1.64,5.06-4.92,5.06h-40.59c-3.37,0-5.06-1.69-5.06-5.06V5.06c0-3.37,1.69-5.06,5.06-5.06h40.59c3.28,0,4.92,1.69,4.92,5.06v200.56Z"/>
        <path d="M672.63,125.56V5.06c0-3.37,1.69-5.06,5.06-5.06h40.59c3.28,0,4.92,1.69,4.92,5.06v200.56c0,3.37-1.64,5.06-4.92,5.06h-58.15c-3.37,0-5.62-1.69-6.74-5.06l-41.01-121.35v121.35c0,3.37-1.64,5.06-4.92,5.06h-40.59c-3.37,0-5.06-1.69-5.06-5.06V5.06c0-3.37,1.69-5.06,5.06-5.06h58.43c3.37,0,5.62,1.69,6.74,5.06l40.59,120.51Z"/>
      </g>
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
function LabelStandard({ item, isCase, isKit, qrValue }) {
  return (
    <div
      className="label-card"
      style={{
        width: '62mm',
        height: '38mm',
        background: '#ffffff',
        pageBreakInside: 'avoid',
        border: '1px solid #cbd5e1',
        borderRadius: '3px',
        fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      {/* Top accent bar */}
      <div style={{ height: '3px', background: '#0f172a', flexShrink: 0 }} />

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', padding: '4px 5px 3px', gap: '5px', overflow: 'hidden' }}>
        {/* Left: text */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            {(isCase || isKit) && (
              <div style={{
                fontSize: '4.5px', fontWeight: '800', letterSpacing: '0.14em',
                textTransform: 'uppercase', color: isKit ? '#7c3aed' : '#1e40af',
                marginBottom: '2px',
              }}>
                {isKit ? 'Kit' : 'Case'}
              </div>
            )}
            <div style={{
              fontSize: '9px', fontWeight: '800', color: '#0f172a',
              lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {item.name}
            </div>
            {!isCase && !isKit && (item.brand || item.model) && (
              <div style={{
                fontSize: '6px', color: '#64748b', marginTop: '2px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {[item.brand, item.model].filter(Boolean).join(' · ')}
              </div>
            )}
            {(isCase || isKit) && item.description && (
              <div style={{
                fontSize: '6px', color: '#64748b', marginTop: '2px', lineHeight: 1.25,
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {item.description}
              </div>
            )}
          </div>
          {!isCase && !isKit && item.serial_number && (
            <div style={{
              fontSize: '5.5px', fontFamily: 'monospace', color: '#334155',
              background: '#f1f5f9', borderRadius: '2px', padding: '1px 3px',
              display: 'inline-block', marginTop: '2px',
            }}>
              {item.serial_number}
            </div>
          )}
          {/* Logo bottom-left */}
          <div style={{ marginTop: 'auto', paddingTop: '3px' }}>
            <BrainLogo width={38} color="#94a3b8" />
          </div>
        </div>

        {/* Right: QR */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <QRCodeSVG value={qrValue} size={60} level="M" style={{ display: 'block' }} />
        </div>
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
        height: '25mm',
        background: '#ffffff',
        pageBreakInside: 'avoid',
        border: '1px solid #cbd5e1',
        borderRadius: '3px',
        fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ height: '2.5px', background: '#0f172a', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', padding: '3px 4px', gap: '4px', overflow: 'hidden' }}>
        {/* QR left */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <QRCodeSVG value={qrValue} size={42} level="M" style={{ display: 'block' }} />
        </div>
        {/* Text right */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            {(isCase || isKit) && (
              <div style={{
                fontSize: '4px', fontWeight: '800', letterSpacing: '0.12em',
                textTransform: 'uppercase', color: isKit ? '#7c3aed' : '#1e40af', marginBottom: '1px',
              }}>
                {isKit ? 'Kit' : 'Case'}
              </div>
            )}
            <div style={{
              fontSize: '7px', fontWeight: '800', color: '#0f172a', lineHeight: 1.2,
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {item.name}
            </div>
            {!isCase && !isKit && item.serial_number && (
              <div style={{ fontSize: '5px', fontFamily: 'monospace', color: '#64748b', marginTop: '2px' }}>
                {item.serial_number}
              </div>
            )}
          </div>
          <BrainLogo width={28} color="#94a3b8" />
        </div>
      </div>
    </div>
  )
}

// ── XS 25×15mm ────────────────────────────────────────────────────────────────
function LabelXS({ item, isCase, isKit, qrValue }) {
  return (
    <div
      className="label-card"
      style={{
        width: '25mm',
        height: '15mm',
        background: '#ffffff',
        pageBreakInside: 'avoid',
        border: '1px solid #cbd5e1',
        borderRadius: '2px',
        fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '2px 2px 2px 2px',
        boxSizing: 'border-box',
      }}
    >
      <QRCodeSVG value={qrValue} size={30} level="L" style={{ display: 'block', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '5.5px', fontWeight: '800', color: '#0f172a', lineHeight: 1.2,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {item.name}
        </div>
        {!isCase && !isKit && item.serial_number && (
          <div style={{
            fontSize: '4px', fontFamily: 'monospace', color: '#64748b',
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
  useBarcode(barcodeRef, item.serial_number || item.name, { width: 1.2, height: 26 })

  return (
    <div
      className="label-card"
      style={{
        width: '80mm',
        height: '15mm',
        background: '#ffffff',
        pageBreakInside: 'avoid',
        border: '1px solid #cbd5e1',
        borderRadius: '2px',
        fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'stretch',
        boxSizing: 'border-box',
      }}
    >
      {/* Left accent */}
      <div style={{ background: '#0f172a', width: '3px', flexShrink: 0 }} />

      {/* Logo block */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2px 5px', flexShrink: 0,
      }}>
        <BrainLogo width={26} color="#0f172a" />
      </div>

      {/* Separator */}
      <div style={{ width: '1px', background: '#e2e8f0', flexShrink: 0, margin: '3px 0' }} />

      {/* Text */}
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '2px 5px', minWidth: 0, flex: '0 0 auto', maxWidth: '26mm',
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
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
        {(item.serial_number || item.name) ? (
          <svg ref={barcodeRef} style={{ maxWidth: '100%', height: '26px' }} />
        ) : (
          <QRCodeSVG value={qrValue} size={26} level="L" style={{ display: 'block' }} />
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
