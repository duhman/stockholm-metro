import express, { type Request, type Response } from "express";
import { createServer as createViteServer } from "vite";
import dns from "node:dns";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

import {
  parseSiteId,
  parseTimeWindow,
  parseSearchQuery,
  ValidationError,
} from "./src/server/validate.ts";
import { getSites, searchSites } from "./src/server/sites.ts";

// .env.local takes precedence over .env. Without `override`, the second
// dotenv.config() call would not overwrite values already loaded.
dotenv.config({ path: ".env.local", override: true });
dotenv.config();

// Fix for Node 18+ fetch IPv6 DNS resolution issues in some environments.
dns.setDefaultResultOrder("ipv4first");

const SL_BASE = "https://transport.integration.sl.se/v1";

function handleValidationError(err: unknown, res: Response): boolean {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
    return true;
  }
  return false;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  app.get("/api/departures", async (req: Request, res: Response) => {
    try {
      const siteId = parseSiteId(req.query.siteId ?? "9221");
      const timeWindow = parseTimeWindow(req.query.timeWindow);
      const url = `${SL_BASE}/sites/${siteId}/departures?transport_authority_id=1&timewindow=${timeWindow}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`SL API responded with status ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      if (handleValidationError(err, res)) return;
      console.error("Error fetching departures:", err);
      res.status(502).json({ error: "Failed to fetch departures" });
    }
  });

  app.get("/api/ai-search", async (req: Request, res: Response) => {
    if (!ai) {
      return res.status(503).json({
        error: "Search is unavailable: GEMINI_API_KEY is not configured.",
      });
    }
    try {
      const query = parseSearchQuery(req.query.q);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are an assistant for the Stockholm public transit system (SL). The user is searching for a location or address.
User query: "${query}"

1. Find the nearest **Stockholm Metro (Tunnelbana)** station to the user's queried location/address.
2. Return ONLY the exact, official name of that **subway station** (e.g., if they search 'Gärdeshöjden' or 'Värtavägen', return 'Gärdet'. If they say 'central station', return 'T-Centralen').
Do not return any extra text or punctuation. ONLY the name of the subway station.`,
      });

      const predicted = response.text?.trim() || query;
      const sites = await getSites();
      const results = searchSites(sites, predicted);

      res.json({
        StatusCode: 0,
        Message: null,
        ExecutionTime: 0,
        ResponseData: results,
        AiInterpretation: predicted,
      });
    } catch (err: any) {
      if (handleValidationError(err, res)) return;
      console.error("Error in AI search:", err);
      res.status(502).json({ error: "Failed to perform search" });
    }
  });

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
