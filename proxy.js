import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// Routes that are always public — no auth required
const PUBLIC_PATHS = ['/login', '/item', '/imposta-password', '/offline']

function isPublicPath(pathname) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export async function proxy(request) {
  const { pathname } = request.nextUrl

  // Allow public paths through immediately
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users trying to access protected routes
  if (!user && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image  (image optimization)
     * - favicon.ico
     * - public assets (icons, manifest, images)
     * - API routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icons/|manifest\\.json|.*\\.png$|.*\\.svg$|.*\\.jpg$|.*\\.webp$|api/).*)',
  ],
}
