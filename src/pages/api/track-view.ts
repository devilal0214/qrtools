// pages/api/track-view.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase-admin";
import { UAParser } from "ua-parser-js";
import { FieldValue } from "firebase-admin/firestore";

// Helper: get geo/location info from IP
async function getGeoFromIP(ip: string | null) {
  if (!ip) return null;

  const cleanIp = ip.split(",")[0].trim();

  try {
    const res = await fetch(`https://ipapi.co/${cleanIp}/json/`);

    if (!res.ok) {
      return { ip: cleanIp };
    }

    const data = await res.json();

    return {
      ip: cleanIp,
      city: data.city || null,
      region: data.region || null,
      country: data.country_name || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      org: data.org || null,
    };
  } catch (err) {
    console.error("Geo lookup failed:", err);
    return { ip: cleanIp };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { qrId } = req.body;

  if (!qrId || typeof qrId !== "string") {
    return res.status(400).json({ error: "qrId is required" });
  }

  try {
    console.log("[track-view] called for qrId:", qrId);

    if (!adminDb) {
      console.error("[track-view] adminDb not configured");
      return res.status(500).json({ error: "adminDb not configured" });
    }

    // 1. Get client IP
    const ipHeader =
      (req.headers["x-forwarded-for"] as string | undefined) ||
      (req.headers["x-real-ip"] as string | undefined) ||
      (req.socket.remoteAddress as string | null) ||
      null;

    // 2. Browser / device info from User-Agent
    const uaString = (req.headers["user-agent"] as string) || "";
    const parser = new UAParser(uaString);
    const uaResult = parser.getResult();

    const browserInfo = {
      name: uaResult.browser.name || null,
      version: uaResult.browser.version || null,
    };

    const osInfo = {
      name: uaResult.os.name || null,
      version: uaResult.os.version || null,
    };

    const deviceInfo = {
      type: uaResult.device.type || "desktop",
      vendor: uaResult.device.vendor || null,
      model: uaResult.device.model || null,
    };

    // 3. Approx location from IP
    const geo = await getGeoFromIP(ipHeader);

    // 4. Add scan record in "scans" collection
    const scanDoc = await adminDb.collection("scans").add({
      qrId,
      timestamp: new Date().toISOString(),
      userAgent: uaString,
      browser: browserInfo,
      os: osInfo,
      device: deviceInfo,
      ipInfo: geo,
      referrer: (req.headers.referer as string) || null,
    });

    console.log("[track-view] scan doc added:", scanDoc.id);

    // 5. Increment total scan count on QR doc in "qrcodes"
    const qrRef = adminDb.collection("qrcodes").doc(qrId);

    await qrRef.set(
      {
        scans: FieldValue.increment(1),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log("[track-view] scan count incremented for", qrId);

    return res.status(200).json({ success: true, scanId: scanDoc.id });
  } catch (error: any) {
    console.error("[track-view] Error tracking scan:", error);
    const payload: any = { error: "Failed to track scan" };
    if (process.env.NODE_ENV === "development") {
      payload.details = error?.message || String(error);
    }
    return res.status(500).json(payload);
  }
}
