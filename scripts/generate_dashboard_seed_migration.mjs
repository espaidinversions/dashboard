import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RAW_CC } from "../src/data/capital-calls.js";
import { buildPrivateEntitiesFromDashboardBundle, resolvePrivateEntity } from "../src/data/privateEntities.js";
import { FUNDS0 } from "../src/data/pipeline.js";
import { ACTIVE_SEARCHERS, ALL_SEARCHERS, PORTFOLIO_COMPANIES } from "../src/data/searchers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_PATH = path.resolve(__dirname, "../supabase/migrations/202604161430_seed_dashboard_baseline.sql");

const SEARCHER_STOPWORDS = new Set([
  "capital",
  "partners",
  "partner",
  "limited",
  "sl",
  "srl",
  "ltd",
  "group",
  "fund",
  "invest",
  "investments",
]);

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token && !SEARCHER_STOPWORDS.has(token))
    .join(" ");
}

function splitSearchers(value) {
  const parts = String(value ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    searcher1: parts[0] ?? null,
    searcher2: parts[1] ?? null,
  };
}

function isPresent(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

function chooseSeedValue(currentValue, nextValue) {
  if (!isPresent(currentValue)) return nextValue;
  if (!isPresent(nextValue)) return currentValue;
  if (typeof currentValue === "boolean" || typeof nextValue === "boolean") {
    return Boolean(currentValue || nextValue);
  }
  if (typeof currentValue === "string" && typeof nextValue === "string") {
    return nextValue.trim().length > currentValue.trim().length ? nextValue : currentValue;
  }
  return currentValue;
}

function normalizeSeedText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mergePairedNames(currentA, currentB, nextA, nextB) {
  const merged = [];
  for (const candidate of [currentA, currentB, nextA, nextB]) {
    if (!isPresent(candidate)) continue;
    const normalized = normalizeSeedText(candidate);
    const existingIndex = merged.findIndex((value) => normalizeSeedText(value) === normalized);
    if (existingIndex === -1) {
      merged.push(candidate);
      continue;
    }
    if (String(candidate).trim().length > String(merged[existingIndex]).trim().length) {
      merged[existingIndex] = candidate;
    }
  }
  return [merged[0] ?? null, merged[1] ?? null];
}

function mergeSearcherRows(currentRow, nextRow) {
  const merged = { ...currentRow };
  [merged.searcher1, merged.searcher2] = mergePairedNames(
    currentRow.searcher1,
    currentRow.searcher2,
    nextRow.searcher1,
    nextRow.searcher2,
  );
  for (const [key, nextValue] of Object.entries(nextRow)) {
    if (key === "nom" || key === "searcher1" || key === "searcher2") continue;
    merged[key] = chooseSeedValue(merged[key], nextValue);
  }
  return merged;
}

function dedupeSearchersByName(rows) {
  const mergedByName = new Map();
  for (const row of rows) {
    const existing = mergedByName.get(row.nom);
    mergedByName.set(row.nom, existing ? mergeSearcherRows(existing, row) : row);
  }
  return [...mergedByName.values()];
}

function buildSeedSearchers() {
  const searchers = ALL_SEARCHERS.map((row) => ({ ...row }));
  const indexByNom = new Map(searchers.map((row, index) => [row.nom, index]));
  const indexByNormalized = new Map(searchers.map((row, index) => [normalizeName(row.nom), index]));

  for (const active of ACTIVE_SEARCHERS) {
    const normalized = normalizeName(active.nom);
    const directIndex = indexByNom.get(active.nom);
    const normalizedIndex = directIndex ?? indexByNormalized.get(normalized);
    const basePatch = {
      modalitat: active.modalitat ?? null,
      geo: active.geo ?? null,
      ticket: active.ticket ?? null,
      dataCompr: active.dataCompr ?? null,
      mesosCercant: active.mesosCercant ?? null,
      equityStake: active.equityStake ?? null,
      isMock: active.isMock ?? false,
      ...splitSearchers(active.searchers),
    };

    if (normalizedIndex != null) {
      searchers[normalizedIndex] = {
        ...searchers[normalizedIndex],
        ...basePatch,
        statusScreening: searchers[normalizedIndex].statusScreening || "Invertit en fase de cerca",
      };
      continue;
    }

    searchers.push({
      nom: active.nom,
      tipus: null,
      modalitat: active.modalitat ?? null,
      geo: active.geo ?? null,
      statusScreening: "Invertit en fase de cerca",
      formEntrada: null,
      introPer: null,
      escola1: null,
      escola2: null,
      dataInici: null,
      ...basePatch,
    });
  }

  return dedupeSearchersByName(searchers);
}

function buildSeedFundMeta() {
  return [...new Set(RAW_CC.map((row) => row.fons))].sort().map((fons) => {
    const resolved = resolvePrivateEntity("vehicle", fons);
    return { vehicle_id: resolved?.id ?? null, fons, tvpi: null };
  });
}

function toCapitalCallRow(row) {
  const resolved = resolvePrivateEntity("vehicle", row.fons, row.id ?? null);
  return {
    vehicle_id: resolved?.id ?? null,
    fons: row.fons,
    tipus: row.tipus,
    cat: row.cat,
    data: row.data,
    mes: row.mes,
    year: row.any,
    fy: row.fy,
    vcpe: row.vcpe,
    est: row.est,
    eur: row.eur,
    divisa: row.divisa,
  };
}

function toPipelineRow(row) {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    currency: row.currency,
    geography: row.geography,
    strategy: row.strategy,
    sector: row.sector,
    status: row.status,
    canal: row.canal,
    active: row.active ?? true,
    estimated_closing: row.estimatedClosing ?? null,
  };
}

function toCompanyRow(row) {
  const resolved = resolvePrivateEntity("company", row.nom, row.id ?? null);
  return {
    entity_id: resolved?.id ?? null,
    nom: row.nom,
    tipus: row.tipus,
    segment: row.segment ?? null,
    entrepreneurs: row.entrepreneurs ?? null,
    origen: row.origen ?? null,
    geo: row.geo ?? null,
    ticket: row.ticket ?? null,
    tvpi: row.tvpi ?? null,
    rvpi_eur: row.rvpiEur ?? null,
    dpi_eur: row.dpiEur ?? null,
    rev: row.rev ?? null,
    ebitda: row.ebitda ?? null,
    dfn: row.dfn ?? null,
    gross_ev: row.grossEV ?? null,
    mult_entry: row.multEntry ?? null,
    data_compr: row.dataCompr ?? null,
    mesos_operant: row.mesosOperant ?? null,
    is_mock: row.isMock ?? false,
    quarters: row.quarters ?? [],
  };
}

function toSearcherRow(row) {
  return {
    nom: row.nom,
    tipus: row.tipus ?? null,
    modalitat: row.modalitat ?? null,
    geo: row.geo ?? null,
    status_screening: row.statusScreening ?? null,
    form_entrada: row.formEntrada ?? null,
    intro_per: row.introPer ?? null,
    searcher1: row.searcher1 ?? null,
    searcher2: row.searcher2 ?? null,
    escola1: row.escola1 ?? null,
    escola2: row.escola2 ?? null,
    ticket: row.ticket ?? null,
    data_inici: row.dataInici ?? null,
    data_compr: row.dataCompr ?? null,
    mesos_cercant: row.mesosCercant ?? null,
    equity_stake: row.equityStake ?? null,
    is_mock: row.isMock ?? false,
  };
}

function jsonbLiteral(tag, value) {
  return `$${tag}$${JSON.stringify(value)}$${tag}$::jsonb`;
}

const capitalCalls = RAW_CC.map(toCapitalCallRow);
const pipeline = FUNDS0.map(toPipelineRow);
const companies = PORTFOLIO_COMPANIES.map(toCompanyRow);
const searchers = buildSeedSearchers().map(toSearcherRow);
const fundMeta = buildSeedFundMeta();
const privateEntities = buildPrivateEntitiesFromDashboardBundle({
  companies: PORTFOLIO_COMPANIES.map((row) => ({ id: row.id ?? null, nom: row.nom })),
  rawCC: RAW_CC.map((row) => ({ id: row.id ?? null, fons: row.fons })),
  fundMeta,
});

const sql = `-- Migration: seed dashboard baseline data when remote tables are empty
-- Generated from in-repo legacy dashboard datasets on 2026-04-16

do $$
begin
  if not exists (select 1 from public.private_entities limit 1) then
    insert into public.private_entities (id, kind, canonical_name, source_name, workbook_name, match_type)
    select id, kind, canonical_name, source_name, workbook_name, match_type
    from jsonb_to_recordset(${jsonbLiteral("seed_private_entities", privateEntities.map((row) => ({
      id: row.id,
      kind: row.kind,
      canonical_name: row.canonicalName,
      source_name: row.sourceName ?? row.canonicalName,
      workbook_name: row.workbookName ?? null,
      match_type: row.matchType ?? null,
    })))})
      as x(id text, kind text, canonical_name text, source_name text, workbook_name text, match_type text);
  end if;

  if not exists (select 1 from public.capital_calls limit 1) then
    insert into public.capital_calls (vehicle_id, fons, tipus, cat, data, mes, year, fy, vcpe, est, eur, divisa)
    select vehicle_id, fons, tipus, cat, data, mes, year, fy, vcpe, est, eur, divisa
    from jsonb_to_recordset(${jsonbLiteral("seed_cc", capitalCalls)})
      as x(vehicle_id text, fons text, tipus text, cat text, data text, mes integer, year integer, fy text, vcpe text, est text, eur numeric, divisa text);
  end if;

  if not exists (select 1 from public.pipeline limit 1) then
    insert into public.pipeline (id, name, amount, currency, geography, strategy, sector, status, canal, active, estimated_closing)
    select id, name, amount, currency, geography, strategy, sector, status, canal, active, estimated_closing
    from jsonb_to_recordset(${jsonbLiteral("seed_pipeline", pipeline)})
      as x(id integer, name text, amount numeric, currency text, geography text, strategy text, sector text, status text, canal text, active boolean, estimated_closing text);
  end if;

  if not exists (select 1 from public.portfolio_companies limit 1) then
    insert into public.portfolio_companies (
      entity_id, nom, tipus, segment, entrepreneurs, origen, geo, ticket, tvpi, rvpi_eur, dpi_eur,
      rev, ebitda, dfn, gross_ev, mult_entry, data_compr, mesos_operant, is_mock, quarters
    )
    select
      entity_id, nom, tipus, segment, entrepreneurs, origen, geo, ticket, tvpi, rvpi_eur, dpi_eur,
      rev, ebitda, dfn, gross_ev, mult_entry, data_compr, mesos_operant, is_mock, coalesce(quarters, '[]'::jsonb)
    from jsonb_to_recordset(${jsonbLiteral("seed_companies", companies)})
      as x(
        entity_id text, nom text, tipus text, segment text, entrepreneurs text, origen text, geo text,
        ticket numeric, tvpi numeric, rvpi_eur numeric, dpi_eur numeric,
        rev numeric, ebitda numeric, dfn numeric, gross_ev numeric, mult_entry numeric,
        data_compr date, mesos_operant integer, is_mock boolean, quarters jsonb
      );
  end if;

  if not exists (select 1 from public.searchers limit 1) then
    insert into public.searchers (
      nom, tipus, modalitat, geo, status_screening, form_entrada, intro_per, searcher1, searcher2,
      escola1, escola2, ticket, data_inici, data_compr, mesos_cercant, equity_stake, is_mock
    )
    select
      nom, tipus, modalitat, geo, status_screening, form_entrada, intro_per, searcher1, searcher2,
      escola1, escola2, ticket, data_inici, data_compr, mesos_cercant, equity_stake, is_mock
    from jsonb_to_recordset(${jsonbLiteral("seed_searchers", searchers)})
      as x(
        nom text, tipus text, modalitat text, geo text, status_screening text, form_entrada text, intro_per text,
        searcher1 text, searcher2 text, escola1 text, escola2 text, ticket numeric, data_inici date, data_compr date,
        mesos_cercant integer, equity_stake numeric, is_mock boolean
      );
  end if;

  if not exists (select 1 from public.fund_meta limit 1) then
    insert into public.fund_meta (vehicle_id, fons, tvpi)
    select vehicle_id, fons, tvpi
    from jsonb_to_recordset(${jsonbLiteral("seed_fund_meta", fundMeta)})
      as x(vehicle_id text, fons text, tvpi numeric);
  end if;
end
$$;
`;

writeFileSync(OUTPUT_PATH, sql, "utf8");
console.log(`Wrote ${OUTPUT_PATH}`);
