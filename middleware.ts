import { NextResponse, type NextRequest } from "next/server";

// Cheap edge gate: no session cookie, no app pages. The cookie is only a hint here,
// every API call and every server component re-validates the session against the database.
const PROTECTED = ["/dashboard", "/patients", "/doctors", "/appointments", "/consultations", "/prescriptions", "/medications", "/documents", "/invoices", "/payments", "/notifications", "/settings", "/audit"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !req.cookies.get("mf_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"] };
