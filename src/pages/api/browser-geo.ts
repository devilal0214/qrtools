import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: "Latitude and longitude required" });
    }

    // Use reverse geocoding to get location from coordinates
    const geocodingServices = [
      {
        name: "openstreetmap",
        url: `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
        parser: (data: any) => ({
          city: data.address?.city || data.address?.town || data.address?.village || null,
          region: data.address?.state || data.address?.county || null,
          country: data.address?.country || null,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          source: "browser-geolocation"
        })
      }
    ];

    for (const service of geocodingServices) {
      try {
        console.log(`[browser-geo] Trying ${service.name} for coords: ${latitude}, ${longitude}`);
        
        const fetchRes = await fetch(service.url, {
          headers: {
            'User-Agent': 'QRCode-App/1.0'
          }
        });

        if (!fetchRes.ok) {
          console.log(`[browser-geo] ${service.name} returned status: ${fetchRes.status}`);
          continue;
        }

        const data = await fetchRes.json();
        console.log(`[browser-geo] ${service.name} response:`, data);
        
        const result = service.parser(data);
        
        if (result.city || result.country) {
          console.log(`[browser-geo] Success with ${service.name}:`, result);
          return res.status(200).json(result);
        }
      } catch (err) {
        console.error(`[browser-geo] ${service.name} failed:`, err);
        continue;
      }
    }

    // If all services fail, return coordinates only
    return res.status(200).json({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      source: "browser-geolocation"
    });

  } catch (error) {
    console.error("[browser-geo] Error:", error);
    return res.status(500).json({ error: "Failed to get location" });
  }
}