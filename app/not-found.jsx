import Link from 'next/link'
import CompanyLogo from '@/components/CompanyLogo'

export default function NotFound() {
  return (
    <html lang="it" className="h-full dark">
      <body className="h-full bg-background text-foreground antialiased">
        <div className="min-h-full flex flex-col items-center justify-center px-6 py-16">

          {/* Logo */}
          <div className="mb-10 opacity-80">
            <CompanyLogo variant="light" width={120} />
          </div>

          {/* 404 */}
          <div className="text-center space-y-3 mb-10">
            <p className="text-[120px] font-black leading-none tracking-tight text-foreground select-none">
              404
            </p>
            <p className="text-lg font-semibold text-foreground">Pagina non trovata</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              La pagina che stai cercando non esiste o è stata spostata.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-foreground text-background px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition"
            >
              ← Torna alla Dashboard
            </Link>
            <Link
              href="/inventario"
              className="inline-flex items-center border border-border bg-card text-foreground px-5 py-2 rounded-lg text-sm font-medium hover:bg-muted transition"
            >
              Inventario
            </Link>
          </div>

          {/* Footer */}
          <p className="mt-16 text-xs text-muted-foreground/50">GearVault · Brain Digital</p>
        </div>
      </body>
    </html>
  )
}
