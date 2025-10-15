import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  // Since we're using mock authentication with localStorage,
  // we don't need middleware-level auth checks.
  // The ProtectedRoute component handles auth on the client side.
  // This middleware is kept for future Supabase Auth integration.

  // For now, just pass through all requests
  return
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
