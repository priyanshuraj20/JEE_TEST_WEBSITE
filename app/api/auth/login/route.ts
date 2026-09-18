import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
  if (password !== adminPassword) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const session = await getSession();
  session.isAdmin = true;
  await session.save();

  return NextResponse.json({ ok: true });
}
