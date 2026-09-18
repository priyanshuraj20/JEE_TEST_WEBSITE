import { SessionOptions, getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export interface SessionData {
  isAdmin: boolean;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "fallback-secret-min-32-chars-here!!",
  cookieName: "jee-admin-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 1 day
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const session = await getSession();
    return session.isAdmin === true;
  } catch {
    return false;
  }
}
