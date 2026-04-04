import './globals.css'
import { ScannerProvider } from '@/components/ScannerContext'

export const metadata = {
  title: 'GearVault – Brain Digital',
  description: 'Gestione inventario attrezzatura fotografica e video professionale',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GearVault',
  },
}

export const viewport = {
  themeColor: '#0f172a',
}

export default function RootLayout({ children }) {
  return (
    <html lang="it" className="h-full dark">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="h-full bg-background text-foreground antialiased">
        <ScannerProvider>{children}</ScannerProvider>
      </body>
    </html>
  )
}
