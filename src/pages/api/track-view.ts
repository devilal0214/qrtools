import type { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase-admin";
import { UAParser } from "ua-parser-js";
import { FieldValue } from "firebase-admin/firestore";

// Strip IPv6-prefixed IPv4 like ::ffff:1.2.3.4 & take first from comma list
function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let ip = raw.split(",")[0].trim();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  return ip || null;
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

// Get best-guess client IP behind proxies / CDNs
function getClientIp(req: NextApiRequest): string | null {
  // Check multiple headers commonly used by proxies and CDNs
  const headers = [
    req.headers["cf-connecting-ip"], // Cloudflare
    req.headers["x-client-ip"], // Mobile carriers
    req.headers["x-forwarded-for"], // Standard proxy
    req.headers["x-real-ip"], // Nginx
    req.headers["x-forwarded"],
    req.headers["forwarded-for"],
    req.headers["forwarded"],
    req.connection?.remoteAddress,
    req.socket.remoteAddress
  ];

  console.log("[track-view] IP detection headers:", {
    "cf-connecting-ip": req.headers["cf-connecting-ip"],
    "x-client-ip": req.headers["x-client-ip"],
    "x-forwarded-for": req.headers["x-forwarded-for"],
    "x-real-ip": req.headers["x-real-ip"],
    "socket-remote": req.socket.remoteAddress
  });

  // Try each header in order of preference
  for (const header of headers) {
    if (header) {
      const ip = normalizeIp(header as string);
      if (ip && !isPrivateIp(ip)) {
        console.log("[track-view] Using public IP from header:", ip);
        return ip;
      }
    }
  }

  // If no public IP found, use the first available IP (even if private)
  for (const header of headers) {
    if (header) {
      const ip = normalizeIp(header as string);
      if (ip) {
        console.log("[track-view] Using fallback IP:", ip);
        return ip;
      }
    }
  }

  console.log("[track-view] No IP found in any header");
  return null;
}

// Helper: get geo/location info from IP with multiple fallback services
async function getGeoFromIP(ip: string | null) {
  const cleanIp = normalizeIp(ip);
  if (!cleanIp) {
    console.log("[getGeoFromIP] No IP provided");
    return null;
  }

  console.log("[getGeoFromIP] Attempting geolocation for IP:", cleanIp);

  // Don't waste geo lookup on local/private IPs – will always be "Unknown"
  if (isPrivateIp(cleanIp)) {
    console.log("[getGeoFromIP] Private/localhost IP detected:", cleanIp);
    return { ip: cleanIp, city: "Local", country: "Local Network" };
  }

  // Try multiple geolocation services with better reliability
  const services = [
    {
      name: "ipapi.co",
      url: `https://ipapi.co/${cleanIp}/json/`,
      headers: { 'User-Agent': 'QRCode-Analytics/1.0' },
      parser: (data: any) => ({
        ip: cleanIp,
        city: data.city || data.district || null,
        region: data.region || data.region_code || null,
        country: data.country_name || data.country || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        org: data.org || data.isp || null,
      })
    },
    {
      name: "ip-api.com",
      url: `http://ip-api.com/json/${cleanIp}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`,
      headers: { 'User-Agent': 'QRCode-Analytics/1.0' },
      parser: (data: any) => ({
        ip: cleanIp,
        city: data.city || null,
        region: data.regionName || data.region || null,
        country: data.country || null,
        latitude: data.lat || null,
        longitude: data.lon || null,
        org: data.org || data.isp || data.as || null,
      })
    },
    {
      name: "ipinfo.io",
      url: `https://ipinfo.io/${cleanIp}/json`,
      headers: { 'User-Agent': 'QRCode-Analytics/1.0' },
      parser: (data: any) => {
        const [city, region] = (data.city || '').split(',').map((s: string) => s.trim());
        return {
          ip: cleanIp,
          city: city || null,
          region: region || data.region || null,
          country: data.country || null,
          latitude: data.loc ? parseFloat(data.loc.split(',')[0]) : null,
          longitude: data.loc ? parseFloat(data.loc.split(',')[1]) : null,
          org: data.org || null,
        };
      }
    }
  ];

  for (const service of services) {
    try {
      console.log(`[getGeoFromIP] Trying ${service.name} for IP: ${cleanIp}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const res = await fetch(service.url, {
        headers: service.headers,
        signal: controller.signal,
        method: 'GET'
      });
      
      clearTimeout(timeoutId);

      if (!res.ok) {
        console.log(`[getGeoFromIP] ${service.name} returned status: ${res.status}`);
        continue;
      }

      const data = await res.json();
      console.log(`[getGeoFromIP] ${service.name} response:`, JSON.stringify(data));
      
      // Check for API-specific error responses
      if (data.status === 'fail' || data.error || data.message === 'invalid query') {
        console.log(`[getGeoFromIP] ${service.name} API error:`, data.message || data.reason);
        continue;
      }
      
      const result = service.parser(data);
      
      // Validate we got useful data
      if (result && (result.city || result.country)) {
        console.log(`[getGeoFromIP] Success with ${service.name}:`, JSON.stringify(result));
        return result;
      } else {
        console.log(`[getGeoFromIP] ${service.name} returned no useful location data`);
      }
    } catch (err) {
      console.error(`[getGeoFromIP] ${service.name} failed:`, err instanceof Error ? err.message : err);
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

    // 1. Get client IP using enhanced detection
    const clientIp = getClientIp(req);
    console.log("[track-view] resolved client IP:", clientIp);

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
    let geo = await getGeoFromIP(clientIp);
    
    // If IP geolocation failed and we have browser coordinates, use those
    if ((!geo || !geo.city) && browserGeo && browserGeo.latitude && browserGeo.longitude) {
      console.log("[track-view] IP geolocation failed, using browser geolocation");
      geo = {
        ip: clientIp,
        city: browserGeo.city || null,
        region: browserGeo.region || null,
        country: browserGeo.country || null,
        latitude: browserGeo.latitude,
        longitude: browserGeo.longitude,
        org: "browser-geolocation"
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
