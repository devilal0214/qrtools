import type { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase-admin";
import UAParser from "ua-parser-js";

async function getGeoFromIP(ip: string | null) {
  if (!ip) return null;

  // x-forwarded-for me multiple IPs ho sakte hain, first wala real client hota hai
  const cleanIp = ip.split(",")[0].trim();

  try {
    // Example using ipapi.co (you can switch to any other provider)
    const res = await fetch(`https://ipapi.co/${cleanIp}/json/`);

    if (!res.ok) return { ip: cleanIp };

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

  if (!qrId) {
    return res.status(400).json({ error: "qrId is required" });
  }

  try {
    // Get client IP
    const ipHeader =
      (req.headers["x-forwarded-for"] as string) ||
      (req.headers["x-real-ip"] as string) ||
      req.socket.remoteAddress ||
      null;

    // Get browser / device info
    const uaString = req.headers["user-agent"] || "";
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

    //  Get approx location from IP
    const geo = await getGeoFromIP(ipHeader);

    //  Add scan record
    await adminDb.collection("scans").add({
      qrId,
      timestamp: new Date().toISOString(),
      userAgent: uaString,
      browser: browserInfo,
      os: osInfo,
      device: deviceInfo,
      ipInfo: geo,
      referrer: req.headers.referer || null,
    });

    //  Optionally: increment total scan count on QR doc
    const qrRef = adminDb.collection("qrcodes").doc(qrId);
    await adminDb.runTransaction(async (transaction) => {
      const qrDoc = await transaction.get(qrRef);
      if (!qrDoc.exists) return;

      const currentScans = qrDoc.data()?.scans || 0;
      transaction.update(qrRef, { scans: currentScans + 1 });
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error tracking scan:", error);
    return res.status(500).json({ error: "Failed to track scan" });
  }
}
