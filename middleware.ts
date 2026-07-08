import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logApiCall } from "@/lib/api-log";

export function middleware(request: NextRequest) {
  logApiCall({
    direction: "incoming",
    method: request.method,
    url: request.nextUrl.toString(),
  });

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
