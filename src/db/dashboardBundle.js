import {
  buildFallbackCompaniesFromCapitalCalls,
  buildPrivateEntitiesFromDashboardBundle,
  buildSearchFundInferrer,
  capitalCallToRow,
  companyToRow,
  fetchAllCapitalCallRows,
  fundMetaToRow,
  logAudit,
  mergePipelineDeals,
  mergeSearchersWithCapitalCalls,
  privateEntityToRow,
  rowToCapitalCall,
  rowToCompany,
  rowToDeal,
  rowToFundMeta,
  rowToSearcher,
  searcherToRow,
  setSnapshotInferrer,
  supabase,
} from "./_shared.js";

/**
 * Fetch the raw dashboard rows from Supabase (one query per table, in parallel).
 * Returns plain PostgREST rows — pure JSON, safe to cache in localStorage.
 * A table that errors is returned as `null` so the mapper degrades gracefully
 * (same behaviour as the previous inline error handling).
 *
 * @returns {Promise<{cc:object[]|null, fm:object[]|null, pl:object[]|null, co:object[]|null, sr:object[]|null, pe:object[]|null} | null>}
 */
export async function fetchRawDashboardRows() {
  if (!supabase) return null;
  const [cc, fm, pl, co, sr, pe] = await Promise.all([
    fetchAllCapitalCallRows(),
    supabase.from("fund_meta").select("vehicle_id,fons,tvpi,irr,fi_end"),
    supabase.from("pipeline").select("id,name,amount,currency,geography,strategy,sector,status,canal,active,estimated_closing,manager").order("id"),
    supabase.from("portfolio_companies").select("entity_id,nom,tipus,segment,entrepreneurs,origen,geo,ticket,tvpi,rvpi_eur,dpi_eur,rev,ebitda,dfn,gross_ev,mult_entry,data_compr,mesos_operant,is_mock,quarters").order("nom"),
    supabase.from("searchers").select("id,nom,tipus,modalitat,geo,status_screening_code,status_screening,form_entrada,status_cerca_code,status_cerca,status_adquisicio_code,status_adquisicio,intro_per,searcher1,searcher2,companyia_adquirida,escola1,escola2,web,comentaris,ticket,tvpi,data_inici,database_intro_date,data_compr,mesos_cercant,equity_stake,is_mock,is_legacy,nif,label,irr,dpi").order("nom"),
    supabase.from("private_entities").select("id,kind,canonical_name,source_name,workbook_name,match_type,vehicle_est,nif,fiscal_name"),
  ]);
  if (cc.error) console.error("loadAll capital_calls failed:", cc.error);
  if (fm.error) console.error("loadAll fund_meta failed:", fm.error);
  if (pl.error) console.error("loadAll pipeline failed:", pl.error);
  if (co.error) console.error("loadAll portfolio_companies failed:", co.error);
  if (sr.error) console.error("loadAll searchers failed:", sr.error);
  if (pe.error) console.error("loadAll private_entities failed:", pe.error);

  return {
    cc: cc.error || !Array.isArray(cc.data) ? null : cc.data,
    fm: fm.error || !Array.isArray(fm.data) ? null : fm.data,
    pl: pl.error || !Array.isArray(pl.data) ? null : pl.data,
    co: co.error || !Array.isArray(co.data) ? null : co.data,
    sr: sr.error || !Array.isArray(sr.data) ? null : sr.data,
    pe: pe.error || !Array.isArray(pe.data) ? null : pe.data,
  };
}

/**
 * Map raw dashboard rows into the shape the UI consumes. Pure and synchronous:
 * the same function maps both freshly-fetched rows and rows restored from the
 * browser cache, so cached and live renders are identical.
 *
 * Note: sets the module-level snapshot inferrer as a side effect (needed before
 * mapping capital-call strategies), mirroring the original loadAll().
 *
 * @param {{cc:object[]|null, fm:object[]|null, pl:object[]|null, co:object[]|null, sr:object[]|null, pe:object[]|null} | null} raw
 */
export function mapDashboardBundle(raw) {
  if (!raw) return null;
  const { cc, fm, pl, co, sr, pe } = raw;

  const privateEntities = Array.isArray(pe) ? pe : [];
  const entityMap = new Map(privateEntities.map((row) => [row.id, row]));
  const companies = Array.isArray(co)
    ? co.map((row) => rowToCompany(row, entityMap))
    : [];
  const fallbackCompanies = Array.isArray(cc)
    ? buildFallbackCompaniesFromCapitalCalls(cc, entityMap, companies)
    : [];
  const livePipelineDeals = (Array.isArray(pl) ? pl : []).map(rowToDeal);

  // Wire live data into the strategy inferrer before mapping capital calls
  if (Array.isArray(sr) && Array.isArray(co)) {
    setSnapshotInferrer(buildSearchFundInferrer(
      sr.map((r) => ({ nom: r.nom, statusScreening: r.status_screening })),
      co.map((r) => ({ nom: r.nom, tipus: r.tipus })),
    ));
  }

  const result = {
    privateEntities: privateEntities.map((row) => ({
      id: row.id,
      kind: row.kind,
      canonicalName: row.canonical_name,
      sourceName: row.source_name,
      workbookName: row.workbook_name,
      matchType: row.match_type,
      vehicleEst: row.vehicle_est ?? null,
      nif: row.nif ?? null,
      fiscalName: row.fiscal_name ?? null,
    })),
  };
  if (Array.isArray(cc)) result.rawCC = cc.map((row) => rowToCapitalCall(row, entityMap));
  if (Array.isArray(fm)) result.fundMeta = fm.map((row) => rowToFundMeta(row, entityMap));
  if (Array.isArray(pl)) result.funds0 = mergePipelineDeals(livePipelineDeals);
  if (Array.isArray(co)) result.companies = [...companies, ...fallbackCompanies];
  if (Array.isArray(sr)) {
    const searchers = sr.map(rowToSearcher);
    result.searchers = mergeSearchersWithCapitalCalls(searchers, cc);
  }
  if (!result.rawCC && !result.fundMeta && !result.funds0 && !result.companies && !result.searchers) {
    return null;
  }
  return result;
}

export async function loadAll() {
  return mapDashboardBundle(await fetchRawDashboardRows());
}

export async function saveDashboardBundle(bundle) {
  const { rawCC, funds0, companies, searchers, fundMeta } = bundle ?? {};
  if (!supabase) return { error: null };
  const privateEntities = bundle?.privateEntities ?? buildPrivateEntitiesFromDashboardBundle({ companies, rawCC, fundMeta });
  const tablesReplaced = [
    rawCC       != null && "capital_calls",
    funds0      != null && "pipeline",
    companies   != null && "portfolio_companies",
    searchers   != null && "searchers",
    fundMeta    != null && "fund_meta",
    bundle?.privateEntities != null && "private_entities",
  ].filter(Boolean);
  logAudit("replace", "dashboard_bundle", "bulk", { tables: tablesReplaced });
  const { error } = await supabase.rpc("replace_dashboard_bundle", {
    p_private_entities_rows: privateEntities == null ? null : privateEntities.map(privateEntityToRow),
    p_cc_rows: rawCC == null ? null : rawCC.map(r => {
      const row = capitalCallToRow(r);
      return {
        vehicle_id: row.vehicle_id,
        fons: r.fons,
        tipus: row.tipus,
        cat: row.cat,
        data: r.data,
        mes: r.mes,
        year: r.any,
        fy: r.fy,
        est: row.est,
        eur: row.eur,
        divisa: r.divisa,
        comentaris: r.comentaris ?? null,
        amount_native: row.amount_native ?? null,
        fx_rate: row.fx_rate ?? null,
        fx_source: row.fx_source ?? null,
        recallable:      (r.recallable      !== "" && r.recallable      != null) ? Number(r.recallable)      : null,
        non_recallable:  (r.non_recallable  !== "" && r.non_recallable  != null) ? Number(r.non_recallable)  : null,
        from_recallable: (r.from_recallable !== "" && r.from_recallable != null) ? Number(r.from_recallable) : null,
      };
    }),
    p_pl_rows: funds0 == null ? null : funds0.map(r => ({
      id: r.id,
      name: r.name,
      amount: r.amount,
      currency: r.currency,
      geography: r.geography,
      strategy: r.strategy,
      sector: r.sector,
      status: r.status,
      canal: r.canal,
      active: r.active,
      estimated_closing: r.estimatedClosing ?? null,
    })),
    p_companies_rows: companies == null ? null : companies.map(companyToRow),
    p_searchers_rows: searchers == null ? null : searchers.map(searcherToRow),
    p_fund_meta_rows: fundMeta == null ? null : fundMeta.map(fundMetaToRow),
  });
  return { error };
}
