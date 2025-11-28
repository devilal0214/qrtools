import type { NextApiRequest, NextApiResponse } from "next";

// Test endpoint to debug IP geolocation
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get the client IP using the same logic as track-view
    const headers = [
      req.headers["cf-connecting-ip"],
      req.headers["x-client-ip"], 
      req.headers["x-forwarded-for"],
      req.headers["x-real-ip"],
      req.headers["x-forwarded"],
      req.headers["forwarded-for"],
      req.headers["forwarded"],
      req.connection?.remoteAddress,
      req.socket.remoteAddress
    ];

    let clientIp = null;
    for (const header of headers) {
      if (header) {
        const ip = (header as string).split(",")[0].trim();
        if (ip.startsWith("::ffff:")) {
          clientIp = ip.slice(7);
        } else {
          clientIp = ip;
        }
        if (clientIp) break;
      }
    }

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
      headers: {
        "cf-connecting-ip": req.headers["cf-connecting-ip"],
        "x-client-ip": req.headers["x-client-ip"],
        "x-forwarded-for": req.headers["x-forwarded-for"],
        "x-real-ip": req.headers["x-real-ip"],
        "socket-remote": req.socket.remoteAddress
      },
      geolocationTests: testResults
    });

  } catch (error) {
    return res.status(500).json({ 
      error: "Failed to test geolocation",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}