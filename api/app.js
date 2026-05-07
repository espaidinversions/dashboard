import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getLatestDataVersion } from "./_dataVersion.js";
import { makeServiceClient, verifyUser, getUserRole } from "./_adminAuth.js";
import {
  applySecurityHeaders,
  enforceCors,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  sanitizeDomain,
  toFiniteNumber,
} from "./_security.js";
import {
  ACCESS_SUPERUSER,
  buildSectionAccessMap,
  hasSectionAccess,
} from "../src/permissions.js";
import { searcherToRow, rowToSearcher } from "../src/data/mappers.js";
import { normalizeSearcherName } from "../src/data/searcherModel.js";

const CANVAS_FILE = join(process.cwd(), "Dashboard.canvas");
const SRC_DATA = join(process.cwd(), "src", "data");

let rateCache = { rate: null, fetchedAt: 0 };
const RATE_TTL = 60 * 60 * 1000;

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function makeAnonClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
  );
}

function getRoute(req) {
  return String(req.query?.route ?? "").trim();
}

function serverError(res, error, context) {
  console.error(`[app:${context}]`, error);
  return res.status(500).json({ error: "Internal server error" });
}

async function canWriteSearchers(serviceClient, user) {
  const role = getUserRole(user);
  if (role === "admin" || role === "superuser") return true;

  const { data, error } = await serviceClient
    .from("user_permissions")
    .select("denied_sections, section_roles")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;

  const accessMap = buildSectionAccessMap({
    role,
    sectionRoles: data?.section_roles,
    deniedSections: data?.denied_sections,
  });
  return hasSectionAccess(accessMap, "searchers", ACCESS_SUPERUSER);
}

async function handleAuthSettings(_req, res) {
  const supabase = makeAnonClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "allowed_domains")
    .maybeSingle();
  if (error) throw error;
  const allowed_domains = Array.isArray(data?.value)
    ? data.value.map(domain => sanitizeDomain(domain))
    : [];
  return res.json({ allowed_domains });
}

async function handleBoard(req, res) {
  const user = await verifyUser(req, makeServiceClient());
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!existsSync(CANVAS_FILE)) {
    return res.status(404).json({ error: "Canvas not found" });
  }
  const raw = readFileSync(CANVAS_FILE, "utf-8");
  const canvas = JSON.parse(raw);
  return res.json({ nodes: canvas.nodes || [], edges: canvas.edges || [] });
}

async function handleDataVersion(req, res) {
  const user = await verifyUser(req, makeServiceClient());
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  return res.json({ version: getLatestDataVersion(SRC_DATA) });
}

async function handleEurUsd(req, res) {
  const user = await verifyUser(req, makeServiceClient());
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  if (Date.now() - rateCache.fetchedAt < RATE_TTL && rateCache.rate) {
    return res.json({ rate: rateCache.rate, source: "cache" });
  }
  try {
    const response = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD");
    const data = await response.json();
    rateCache = {
      rate: toFiniteNumber(data?.rates?.USD, { allowNull: false, min: 0.1, max: 10 }),
      fetchedAt: Date.now(),
    };
    return res.json({ rate: rateCache.rate, source: "live" });
  } catch {
    return res.json({ rate: 1.08, source: "fallback" });
  }
}

async function fetchEcbFxRate(date, base, quote) {
  const endPeriod = String(date ?? "").slice(0, 10);
  const baseCurrency = String(base ?? "").trim().toUpperCase();
  const quoteCurrency = String(quote ?? "").trim().toUpperCase();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endPeriod)) {
    throw new Error("Valid FX date is required");
  }
  if (!/^[A-Z]{3}$/.test(baseCurrency) || !/^[A-Z]{3}$/.test(quoteCurrency)) {
    throw new Error("Currencies must be ISO-3 codes");
  }
  if (baseCurrency === quoteCurrency) {
    return { rate: 1, observedAt: endPeriod, source: "identity" };
  }
  const seriesKey = `D.${baseCurrency}.${quoteCurrency}.SP00.A`;
  const url = `https://data-api.ecb.europa.eu/service/data/EXR/${seriesKey}?endPeriod=${encodeURIComponent(endPeriod)}&lastNObservations=1&format=csvdata`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`ECB FX request failed (${response.status})`);
  const csv = await response.text();
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("ECB returned no FX data for the requested date");
  const headers = parseCsvLine(lines[0]);
  const values = parseCsvLine(lines[lines.length - 1]);
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  return {
    rate: toFiniteNumber(row.OBS_VALUE, { allowNull: false, min: 0.000001, max: 100 }),
    observedAt: String(row.TIME_PERIOD ?? endPeriod).slice(0, 10),
    source: "ecb",
  };
}

async function handleFxRate(req, res) {
  const user = await verifyUser(req, makeServiceClient());
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const date = String(req.query?.date ?? "");
  const base = String(req.query?.base ?? "");
  const quote = String(req.query?.quote ?? "EUR");
  return res.json(await fetchEcbFxRate(date, base, quote));
}

async function handleSearchers(req, res) {
  if (!["POST", "PATCH", "DELETE"].includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const supabase = makeServiceClient();
  const user = await verifyUser(req, supabase);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const canWrite = await canWriteSearchers(supabase, user);
  if (!canWrite) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "PATCH") {
    const id = Number(req.query?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Valid searcher id is required" });
    }
    const { isLegacy } = req.body ?? {};
    if (typeof isLegacy !== "boolean") {
      return res.status(400).json({ error: "isLegacy must be a boolean" });
    }
    const { error } = await supabase
      .from("searchers")
      .update({ is_legacy: isLegacy })
      .eq("id", id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const id = Number(req.query?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Valid searcher id is required" });
    }
    const { error } = await supabase
      .from("searchers")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }

  if (String(req.query?.action ?? "") === "sync-capital-calls") {
    const sourceRows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const { data: existing, error: existingError } = await supabase
      .from("searchers")
      .select("nom,nif")
      .order("nom");
    if (existingError) throw existingError;

    const existingNames = new Set(
      (existing ?? [])
        .map((row) => normalizeSearcherName(row?.nom))
        .filter(Boolean)
    );
    const existingVehicleIds = new Set(
      (existing ?? [])
        .map((row) => String(row?.nif ?? "").trim())
        .filter(Boolean)
    );
    const pending = new Map();

    sourceRows.forEach((row) => {
      if (row?.vcpe !== "SF") return;
      const nom = String(row?.fons ?? "").trim();
      if (!nom) return;
      const vehicleId = String(row?.vehicle_id ?? row?.id ?? "").trim() || null;
      const nameKey = normalizeSearcherName(nom);
      if (!nameKey) return;
      if (existingNames.has(nameKey)) return;
      if (vehicleId && existingVehicleIds.has(vehicleId)) return;
      const candidateKey = vehicleId || nameKey;
      const current = pending.get(candidateKey) ?? {
        nom,
        tipus: null,
        modalitat: null,
        geo: null,
        statusScreening: "Invertit en fase de cerca",
        formEntrada: "Search Capital",
        introPer: null,
        searcher1: null,
        searcher2: null,
        escola1: null,
        escola2: null,
        ticket: null,
        dataInici: null,
        dataCompr: null,
        mesosCercant: null,
        equityStake: null,
        isMock: false,
        nif: vehicleId,
      };
      const date = String(row?.data ?? "").slice(0, 10);
      if (date && (!current.dataInici || date < current.dataInici)) current.dataInici = date;
      if ((row?.eur ?? 0) > 0 && ["Compromís", "Capital Call"].includes(row?.cat)) {
        if (!current.dataCompr || (date && date < current.dataCompr)) {
          current.dataCompr = date || current.dataCompr;
          current.ticket = Number(row?.eur ?? 0) || current.ticket;
        }
      }
      pending.set(candidateKey, current);
    });

    const rowsToInsert = [...pending.values()];
    if (rowsToInsert.length) {
      const { error } = await supabase
        .from("searchers")
        .insert(rowsToInsert.map(searcherToRow));
      if (error) throw error;
    }
    return res.status(200).json({ inserted: rowsToInsert.length });
  }

  const row = searcherToRow(req.body ?? {});
  if (!String(row.nom ?? "").trim()) {
    return res.status(400).json({ error: "Nom is required" });
  }

  const { data, error } = await supabase
    .from("searchers")
    .insert(row)
    .select()
    .single();
  if (error) throw error;

  return res.status(200).json({ data: rowToSearcher(data) });
}

async function handlePipeline(req, res) {
  if (!["DELETE"].includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const supabase = makeServiceClient();
  const user = await verifyUser(req, supabase);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const role = getUserRole(user);
  if (role !== "admin" && role !== "superuser") {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "DELETE") {
    const id = Number(req.query?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Valid pipeline id is required" });
    }
    const { error } = await supabase
      .from("pipeline")
      .update({ active: false })
      .eq("id", id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (!enforceHttps(req, res)) return;
  if (!enforceCors(req, res)) return;
  if (handlePreflight(req, res)) return;

  const route = getRoute(req);

  try {
    if (route === "auth-settings") {
      if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      if (!await enforceRateLimit(req, res, "auth")) return;
      return await handleAuthSettings(req, res);
    }
    if (route === "board") {
      if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      if (!await enforceRateLimit(req, res, "public")) return;
      return await handleBoard(req, res);
    }
    if (route === "data-version") {
      if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      if (!await enforceRateLimit(req, res, "public")) return;
      return await handleDataVersion(req, res);
    }
    if (route === "eur-usd") {
      if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      if (!await enforceRateLimit(req, res, "public")) return;
      return await handleEurUsd(req, res);
    }
    if (route === "fx-rate") {
      if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
      if (!await enforceRateLimit(req, res, "public")) return;
      return await handleFxRate(req, res);
    }
    if (route === "searchers") {
      if (!await enforceRateLimit(req, res, "default")) return;
      return await handleSearchers(req, res);
    }
    if (route === "pipeline") {
      if (!await enforceRateLimit(req, res, "default")) return;
      return await handlePipeline(req, res);
    }
    return res.status(404).json({ error: "Not found" });
  } catch (error) {
    return serverError(res, error, route || "unknown");
  }
}
