import {
  fetchAllCapitalCallRows,
  logAudit,
  mergeSearchersWithCapitalCalls,
  rowToSearcher,
  searcherToRow,
  supabase,
} from "./_shared.js";

export async function loadSearchers() {
  if (!supabase) return null;
  const [searchers, capitalCalls] = await Promise.all([
    supabase.from("searchers").select("*").order("nom"),
    fetchAllCapitalCallRows(),
  ]);
  if (searchers.error || capitalCalls.error) return null;
  return mergeSearchersWithCapitalCalls(searchers.data.map(rowToSearcher), capitalCalls.data);
}

export async function saveSearchers(rows) {
  if (!supabase) return;
  const { error: rpcError } = await supabase.rpc("replace_searchers", { p_rows: rows.map(searcherToRow) });
  if (rpcError) {
    if (rpcError.code === "PGRST202" || rpcError.message?.includes("replace_searchers")) {
      const { data: snapshot } = await supabase.from("searchers").select("*");
      const { error: delError } = await supabase.from("searchers").delete().neq("id", 0);
      if (delError) return { error: delError };
      if (rows.length) {
        const { error } = await supabase.from("searchers").insert(rows.map(searcherToRow));
        if (error) {
          if (snapshot?.length) {
            await supabase.from("searchers").insert(snapshot).catch(e => console.error("[saveSearchers] restore failed:", e));
          }
          return { error };
        }
      }
    } else {
      return { error: rpcError };
    }
  }
  return { error: null };
}

export async function upsertSearcher(searcher) {
  if (!supabase) return { data: searcher, error: null };
  try {
    await supabase.auth.refreshSession();
  } catch {}
  const row = searcherToRow(searcher);
  const query = supabase.from("searchers");
  const { data, error } = searcher.id
    ? await query.update(row).eq("id", searcher.id).select().single()
    : await query.insert(row).select().single();
  if (!error) logAudit("update", "searchers", data?.id ?? searcher.nom, { nom: searcher.nom });
  return { data: data ? rowToSearcher(data) : null, error };
}

