import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { isAdminAuthenticated } from "@/lib/auth";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const API_KEY = process.env.CLOUDINARY_API_KEY!;
const API_SECRET = process.env.CLOUDINARY_API_SECRET!;

function generateSignature(params: Record<string, string>): string {
  // Sort params alphabetically and create the string to sign
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
  const toSign = paramString + API_SECRET;
  return createHash("sha256").update(toSign).digest("hex");
}

// POST /api/admin/upload
// Accepts: FormData with a "file" field
// Returns: { url: string }
export async function POST(req: NextRequest) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Build signed upload params
  const timestamp = Math.round(Date.now() / 1000).toString();
  const folder = "jee-questions";
  const signParams: Record<string, string> = { folder, timestamp };
  const signature = generateSignature(signParams);

  // Forward to Cloudinary
  const cloudForm = new FormData();
  cloudForm.append("file", file);
  cloudForm.append("api_key", API_KEY);
  cloudForm.append("timestamp", timestamp);
  cloudForm.append("signature", signature);
  cloudForm.append("folder", folder);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: cloudForm }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    console.error("Cloudinary upload error:", err);
    return NextResponse.json({ error: "Image upload failed" }, { status: 500 });
  }

  const data = await uploadRes.json();
  return NextResponse.json({ url: data.secure_url });
}
