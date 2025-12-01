import type { NextApiRequest, NextApiResponse } from "next";

// Test endpoint to debug IP geolocation
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get all possible IP headers for debugging
    const allHeaders = {
      'cf-connecting-ip': req.headers['cf-connecting-ip'],
      'cf-pseudo-ipv4': req.headers['cf-pseudo-ipv4'],
      'x-client-ip': req.headers['x-client-ip'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-real-ip': req.headers['x-real-ip'],
      'x-cluster-client-ip': req.headers['x-cluster-client-ip'],
      'x-forwarded': req.headers['x-forwarded'],
      'forwarded-for': req.headers['forwarded-for'],
      'forwarded': req.headers['forwarded'],
      'x-appengine-remote-addr': req.headers['x-appengine-remote-addr'],
      'connection-remote': req.connection?.remoteAddress,
      'socket-remote': req.socket?.remoteAddress
    };

    // Extract all possible IPs
    const allIps: string[] = [];
    Object.entries(allHeaders).forEach(([key, value]) => {
      if (value) {
        const ips = (Array.isArray(value) ? value.join(',') : value as string)
          .split(',').map(ip => {
            const cleaned = ip.trim();
            return cleaned.startsWith("::ffff:") ? cleaned.slice(7) : cleaned;
          }).filter(Boolean);
        allIps.push(...ips);
      }
    });

    // Find the first public IP
    const isPrivate = (ip: string) => {
      return ip === '127.0.0.1' || ip === '::1' || 
             ip.startsWith('10.') || ip.startsWith('192.168.') ||
             (ip.startsWith('172.') && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31);
    };

    const clientIp = allIps.find(ip => !isPrivate(ip)) || allIps[0] || null;

    // Test geolocation services
    const testResults = [];

    if (clientIp) {
      // Test ipapi.co
      try {
        const res1 = await fetch(`https://ipapi.co/${clientIp}/json/`);
        const data1 = await res1.json();
        testResults.push({
          service: "ipapi.co",
          status: res1.status,
          data: data1
        });
      } catch (err) {
        testResults.push({
          service: "ipapi.co",
          error: err instanceof Error ? err.message : "Unknown error"
        });
      }

      // Test ip-api.com
      try {
        const res2 = await fetch(`http://ip-api.com/json/${clientIp}`);
        const data2 = await res2.json();
        testResults.push({
          service: "ip-api.com", 
          status: res2.status,
          data: data2
        });
      } catch (err) {
        testResults.push({
          service: "ip-api.com",
          error: err instanceof Error ? err.message : "Unknown error"
        });
      }

      // Test ipinfo.io
      try {
        const res3 = await fetch(`https://ipinfo.io/${clientIp}/json`);
        const data3 = await res3.json();
        testResults.push({
          service: "ipinfo.io",
          status: res3.status, 
          data: data3
        });
      } catch (err) {
        testResults.push({
          service: "ipinfo.io",
          error: err instanceof Error ? err.message : "Unknown error"
        });
      }
    }

    return res.status(200).json({
      detectedIP: clientIp,
      allHeaders: allHeaders,
      allExtractedIPs: allIps,
      publicIPs: allIps.filter(ip => !isPrivate(ip)),
      privateIPs: allIps.filter(ip => isPrivate(ip)),
      geolocationTests: testResults
    });

  } catch (error) {
    return res.status(500).json({ 
      error: "Failed to test geolocation",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}