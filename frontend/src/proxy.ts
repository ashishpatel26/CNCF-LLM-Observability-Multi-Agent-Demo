import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const isAuthed = req.cookies.get("meridian_auth")?.value === "1";
  const isLoginPage = req.nextUrl.pathname === "/login";

  if (!isAuthed && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isAuthed && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
