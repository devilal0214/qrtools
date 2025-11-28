import type { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase-admin";
import { UAParser } from "ua-parser-js";
import { FieldValue } from "firebase-admin/firestore";


 // Strip IPv6-prefixed IPv4 like ::ffff:1.2.3.4

function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let ip = raw.split(",")[0].trim(); // first from x-forwarded-for
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  return ip;
}

 // Detect private / local IP ranges – we don't call geo API for these

function isPrivateIp(ip: string | null): boolean {
  if (!ip) return true;

  if (ip === "127.0.0.1" || ip === "::1") return true;

  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;

  // 172.16.0.0 – 172.31.255.255
  if (ip.startsWith("172.")) {
    const second = parseInt(ip.split(".")[1] || "0", 10);
    if (second >= 16 && second <= 31) return true;
  }

  return false;
}


 //Get best-guess client IP behind proxies
 
function getClientIp(req: NextApiRequest): string | null {
  const xff = req.headers["x-forwarded-for"] as string | undefined;
  if (xff) {
    const parts = xff
      .split(",")
      .map((p) => normalizeIp(p))
      .filter(Boolean) as string[];

    // Pick first non-private IP if possible
    const publicIp = parts.find((ip) => !isPrivateIp(ip));
    if (publicIp) return publicIp;
    if (parts.length) return parts[0];
  }

  const xReal = normalizeIp(req.headers["x-real-ip"] as string | undefined);
  if (xReal) return xReal;

  const sock = normalizeIp(req.socket.remoteAddress || null);
  return sock;
}

/**
 * Geo lookup via ipapi.co
 */
async function getGeoFromIP(ip: string | null) {
  const cleanIp = normalizeIp(ip);
  if (!cleanIp) return null;

  // Don't waste geo lookup on local/private IPs – will always be "Unknown"
  if (isPrivateIp(cleanIp)) {
    return {
      ip: cleanIp,
      city: null,
      region: null,
      country: null,
      latitude: null,
      longitude: null,
      org: null,
    };
  }

  try {
    const res = await fetch(`https://ipapi.co/${cleanIp}/json/`);

    if (!res.ok) {
      console.error("ipapi.co non-OK:", res.status);
      return {
        ip: cleanIp,
        city: null,
        region: null,
        country: null,
        latitude: null,
        longitude: null,
        org: null,
      };
    }

    const data = await res.json();

    return {
      ip: cleanIp,
      city: data.city || null,
      region: data.region || null,
      country: data.country_name || data.country || null,
      latitude:
        typeof data.latitude === "number"
          ? data.latitude
          : parseFloat(data.latitude) || null,
      longitude:
        typeof data.longitude === "number"
          ? data.longitude
          : parseFloat(data.longitude) || null,
      org: data.org || null,
    };
  } catch (err) {
    console.error("Geo lookup failed:", err);
    return {
      ip: cleanIp,
      city: null,
      region: null,
      country: null,
      latitude: null,
      longitude: null,
      org: null,
    };
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

    // 1. Get client IP (handles x-forwarded-for / x-real-ip / remoteAddress)
    const clientIp = getClientIp(req);

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
    const geo = await getGeoFromIP(clientIp);

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
