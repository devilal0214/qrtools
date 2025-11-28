import type { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase-admin";
import { UAParser } from "ua-parser-js";
import { FieldValue } from "firebase-admin/firestore";

// Helper: get geo/location info from IP with multiple fallback services
async function getGeoFromIP(ip: string | null) {
  if (!ip) {
    console.log("[getGeoFromIP] No IP provided");
    return null;
  }

  const cleanIp = ip.split(",")[0].trim();
  console.log("[getGeoFromIP] Attempting geolocation for IP:", cleanIp);

  // Skip localhost/private IPs
  if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp.startsWith('192.168.') || cleanIp.startsWith('10.') || cleanIp.startsWith('172.')) {
    console.log("[getGeoFromIP] Private/localhost IP detected:", cleanIp);
    return { ip: cleanIp, city: "Local", country: "Local Network" };
  }

  // Try multiple geolocation services
  const services = [
    {
      name: "ipapi.co",
      url: `https://ipapi.co/${cleanIp}/json/`,
      parser: (data: any) => ({
        ip: cleanIp,
        city: data.city || null,
        region: data.region || null,
        country: data.country_name || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        org: data.org || null,
      })
    },
    {
      name: "ip-api.com",
      url: `http://ip-api.com/json/${cleanIp}`,
      parser: (data: any) => ({
        ip: cleanIp,
        city: data.city || null,
        region: data.regionName || null,
        country: data.country || null,
        latitude: data.lat || null,
        longitude: data.lon || null,
        org: data.org || data.isp || null,
      })
    }
  ];

  for (const service of services) {
    try {
      console.log(`[getGeoFromIP] Trying ${service.name} for IP: ${cleanIp}`);
      const res = await fetch(service.url, { timeout: 5000 } as any);

      if (!res.ok) {
        console.log(`[getGeoFromIP] ${service.name} returned status: ${res.status}`);
        continue;
      }

      const data = await res.json();
      console.log(`[getGeoFromIP] ${service.name} response:`, data);
      
      const result = service.parser(data);
      
      // Validate we got useful data
      if (result.city || result.country) {
        console.log(`[getGeoFromIP] Success with ${service.name}:`, result);
        return result;
      }
    } catch (err) {
      console.error(`[getGeoFromIP] ${service.name} failed:`, err);
      continue;
    }
  }

  console.log("[getGeoFromIP] All services failed, returning IP only");
  return { ip: cleanIp };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { qrId, browserGeo } = req.body;

  if (!qrId || typeof qrId !== "string") {
    return res.status(400).json({ error: "qrId is required" });
  }

  try {
    console.log("[track-view] called for qrId:", qrId);

    if (!adminDb) {
      console.error("[track-view] adminDb not configured");
      return res.status(500).json({ error: "adminDb not configured" });
    }

    // 1. Get client IP - check multiple headers for mobile/proxy compatibility
    const ipHeader =
      (req.headers["x-forwarded-for"] as string | undefined) ||
      (req.headers["x-real-ip"] as string | undefined) ||
      (req.headers["cf-connecting-ip"] as string | undefined) || // Cloudflare
      (req.headers["x-client-ip"] as string | undefined) || // Mobile carriers
      (req.headers["x-forwarded"] as string | undefined) ||
      (req.headers["forwarded-for"] as string | undefined) ||
      (req.headers["forwarded"] as string | undefined) ||
      (req.connection?.remoteAddress as string | null) ||
      (req.socket.remoteAddress as string | null) ||
      null;
    
    console.log("[track-view] IP detection headers:", {
      "x-forwarded-for": req.headers["x-forwarded-for"],
      "x-real-ip": req.headers["x-real-ip"],
      "cf-connecting-ip": req.headers["cf-connecting-ip"],
      "x-client-ip": req.headers["x-client-ip"],
      "socket-remote": req.socket.remoteAddress,
      "final-ip": ipHeader
    });

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

    // 3. Approx location from IP (with browser geolocation fallback)
    let geo = await getGeoFromIP(ipHeader);
    
    // If IP geolocation failed and we have browser coordinates, use those
    if ((!geo || !geo.city) && browserGeo && browserGeo.latitude && browserGeo.longitude) {
      console.log("[track-view] IP geolocation failed, using browser geolocation");
      geo = {
        ip: ipHeader?.split(",")[0].trim() || null,
        city: browserGeo.city || null,
        region: browserGeo.region || null,
        country: browserGeo.country || null,
        latitude: browserGeo.latitude,
        longitude: browserGeo.longitude,
        source: "browser-geolocation"
      };
    }

    // 4. Add scan record in "scans" collection
    const scanData = {
      qrId,
      timestamp: new Date().toISOString(),
      userAgent: uaString,
      browser: browserInfo,
      os: osInfo,
      device: deviceInfo,
      ipInfo: geo,
      referrer: (req.headers.referer as string) || null,
    };
    
    console.log("[track-view] Saving scan data:", {
      qrId,
      device: deviceInfo,
      browser: browserInfo,
      ipInfo: geo,
      hasLocation: !!(geo?.city || geo?.country)
    });
    
    const scanDoc = await adminDb.collection("scans").add(scanData);

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
