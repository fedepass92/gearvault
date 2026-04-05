import './globals.css'
import { ScannerProvider } from '@/components/ScannerContext'
import { ThemeProvider } from '@/components/ThemeProvider'

export const metadata = {
  title: 'GearVault – Brain Digital',
  description: 'Gestione inventario attrezzatura fotografica e video professionale',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GearVault',
  },
}

export const viewport = {
  themeColor: '#ffffff',
}

export default function RootLayout({ children }) {
  return (
    <html lang="it" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="h-full bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <ScannerProvider>{children}</ScannerProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
