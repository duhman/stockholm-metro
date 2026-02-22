import express from "express";
import { createServer as createViteServer } from "vite";
import dns from "node:dns";

// Fix for Node.js 18+ fetch IPv6 DNS resolution issues in some environments
dns.setDefaultResultOrder("ipv4first");

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Cache for sites to avoid fetching them on every search
  let sitesCache: any[] = [];
  let sitesCacheTime = 0;

  const getSites = async () => {
    if (sitesCache.length > 0 && Date.now() - sitesCacheTime < 1000 * 60 * 60 * 24) {
      return sitesCache;
    }
    try {
      const response = await fetch("https://transport.integration.sl.se/v1/sites");
      if (!response.ok) throw new Error("Failed to fetch sites");
      const data = await response.json();
      sitesCache = data;
      sitesCacheTime = Date.now();
      return sitesCache;
    } catch (error) {
      console.error("Error fetching sites:", error);
      return [];
    }
  };

  // API routes
  app.get("/api/departures", async (req, res) => {
    const siteId = req.query.siteId || "9203"; // Default to Gärdet
    const timeWindow = req.query.timeWindow || "60";

    try {
      const response = await fetch(
        `https://transport.integration.sl.se/v1/sites/${siteId}/departures?transport_authority_id=1&timewindow=${timeWindow}`
      );
      
      if (!response.ok) {
        throw new Error(`SL API responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching departures:", error);
      res.status(500).json({ error: "Failed to fetch departures: " + error.message });
    }
  });

  app.get("/api/search", async (req, res) => {
    const search = req.query.q as string;

    if (!search) {
      return res.status(400).json({ error: "Search query is required" });
    }

    try {
      const sites = await getSites();
      const searchLower = search.toLowerCase();
      
      // Filter sites by name
      const results = sites
        .filter(site => site.name.toLowerCase().includes(searchLower))
        .slice(0, 10)
        .map(site => ({
          SiteId: site.id.toString(),
          Name: site.name,
          Type: "Station",
          X: site.lon?.toString() || "0",
          Y: site.lat?.toString() || "0"
        }));
        
      res.json({
        StatusCode: 0,
        Message: null,
        ExecutionTime: 0,
        ResponseData: results
      });
    } catch (error: any) {
      console.error("Error searching locations:", error);
      res.status(500).json({ error: "Failed to search locations: " + error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
