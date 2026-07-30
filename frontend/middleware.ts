import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// "/credencial" es la página de descarga del PDF de credencial: se abre en el
// navegador del sistema desde la app (sin cookie de sesión), debe ser pública.
const PUBLIC_PATHS = ["/login", "/scan", "/portal", "/api", "/m", "/credencial"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  const token = request.cookies.get("seven.auth")?.value;

  if (!token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|branding).*)"],
};
