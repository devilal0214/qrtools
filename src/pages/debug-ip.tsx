import { useEffect, useState } from "react";

export default function DebugIP() {
  const [ipData, setIpData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const testIPDetection = async () => {
      try {
        // Test our track-view API
        const response = await fetch("/api/track-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrId: "debug-test" }),
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const result = await response.json();
        setIpData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    testIPDetection();
  }, []);

  const [clientInfo, setClientInfo] = useState<any>({});

  useEffect(() => {
    // Collect client-side info
    setClientInfo({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      language: navigator.language,
      languages: navigator.languages,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
      },
      window: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
      },
      location: {
        href: window.location.href,
        hostname: window.location.hostname,
        protocol: window.location.protocol,
      },
    });
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "monospace", fontSize: "12px" }}>
      <h1>IP Detection Debug Page</h1>
      
      <h2>Server-side IP Detection Result:</h2>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {ipData && (
        <pre style={{ background: "#f5f5f5", padding: "10px", overflow: "auto" }}>
          {JSON.stringify(ipData, null, 2)}
        </pre>
      )}

      <h2>Client-side Information:</h2>
      <pre style={{ background: "#f5f5f5", padding: "10px", overflow: "auto" }}>
        {JSON.stringify(clientInfo, null, 2)}
      </pre>

      <h2>Test External IP Services:</h2>
      <div>
        <button
          onClick={async () => {
            try {
              const res = await fetch("https://ipapi.co/json/");
              const data = await res.json();
              console.log("ipapi.co result:", data);
              alert("Check console for ipapi.co result");
            } catch (err) {
              alert("ipapi.co failed: " + err);
            }
          }}
        >
          Test ipapi.co
        </button>
        
        <button
          onClick={async () => {
            try {
              const res = await fetch("http://ip-api.com/json/");
              const data = await res.json();
              console.log("ip-api.com result:", data);
              alert("Check console for ip-api.com result");
            } catch (err) {
              alert("ip-api.com failed: " + err);
            }
          }}
          style={{ marginLeft: "10px" }}
        >
          Test ip-api.com
        </button>
      </div>

      <h2>Instructions:</h2>
      <ol>
        <li>Open this page on mobile device</li>
        <li>Check the "Server-side IP Detection Result" section</li>
        <li>Look for ipInfo data in the result</li>
        <li>Test the external IP services to see if they work from mobile</li>
        <li>Compare with desktop results</li>
      </ol>
    </div>
  );
}