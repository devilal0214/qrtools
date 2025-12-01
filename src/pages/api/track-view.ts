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
  // All possible IP headers in order of preference
  const possibleHeaders = [
    'cf-connecting-ip',        // Cloudflare
    'cf-pseudo-ipv4',         // Cloudflare alternative
    'x-client-ip',            // Mobile carriers, some proxies
    'x-forwarded-for',        // Standard proxy header
    'x-real-ip',              // Nginx proxy
    'x-cluster-client-ip',    // Cluster environments
    'x-forwarded',            // Variant
    'forwarded-for',          // Variant
    'forwarded',              // RFC 7239
    'x-appengine-remote-addr' // Google App Engine
  ];

  const headerValues: any = {};
  const allIps: string[] = [];

  // Collect all IP addresses from headers
  possibleHeaders.forEach(headerName => {
    const value = req.headers[headerName];
    if (value) {
      headerValues[headerName] = value;
      const ips = (Array.isArray(value) ? value.join(',') : value as string)
        .split(',').map(ip => normalizeIp(ip)).filter(Boolean) as string[];
      allIps.push(...ips);
    }
  });

  // Also check connection IPs
  if (req.connection?.remoteAddress) {
    headerValues['connection-remote'] = req.connection.remoteAddress;
    const ip = normalizeIp(req.connection.remoteAddress);
    if (ip) allIps.push(ip);
  }
  if (req.socket?.remoteAddress) {
    headerValues['socket-remote'] = req.socket.remoteAddress;
    const ip = normalizeIp(req.socket.remoteAddress);
    if (ip) allIps.push(ip);
  }

  console.log('[track-view] All IP headers:', headerValues);
  console.log('[track-view] All extracted IPs:', allIps);

  // First try to find any public IP
  for (const ip of allIps) {
    if (ip && !isPrivateIp(ip)) {
      console.log('[track-view] Found public IP:', ip);
      return ip;
    }
  }

  // If no public IP, try to get real IP from x-forwarded-for chain
  const xForwarded = req.headers['x-forwarded-for'];
  if (xForwarded) {
    const forwardedIps = (Array.isArray(xForwarded) ? xForwarded[0] : xForwarded)
      .split(',').map(ip => normalizeIp(ip)).filter(Boolean) as string[];
    
    console.log('[track-view] X-Forwarded-For chain:', forwardedIps);
    
    // The first IP in x-forwarded-for should be the original client
    for (const ip of forwardedIps) {
      if (ip && !isPrivateIp(ip)) {
        console.log('[track-view] Using first public IP from X-Forwarded-For:', ip);
        return ip;
      }
    }
  }

  // Use any available IP as fallback (even private)
  const fallbackIp = allIps.find(ip => ip) || null;
  console.log('[track-view] Using fallback IP:', fallbackIp);
  return fallbackIp;
}

// Helper: get geo/location info from IP with multiple fallback services
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
