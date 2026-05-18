import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split("\n")
      .filter((line) => line.includes("=") && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
}

const env = loadEnv(path.join(__dirname, "../.env.local"));
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Helper to subtract one calendar day — noon UTC anchor avoids DST/timezone shifts
function subtractOneCalendarDay(isoDate) {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Fetch ECB USD/EUR rate for a specific date
async function fetchEcbUsdEur(dateStr) {
  const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?endPeriod=${encodeURIComponent(dateStr)}&lastNObservations=1&format=csvdata`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ECB HTTP ${res.status} for date ${dateStr}`);
  const csv = await res.text();
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error(`ECB returned no data for date ${dateStr}`);
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const values = lines[lines.length - 1].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
  const row = Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  const rate = Number(row.OBS_VALUE);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100) {
    throw new Error(`Implausible ECB rate ${rate} for date ${dateStr}`);
  }
  return { rate, observedAt: String(row.TIME_PERIOD ?? dateStr).slice(0, 10) };
}

// Sleep function for rate limiting and retries
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main script
async function main() {
  console.log(DRY_RUN ? "DRY RUN MODE" : "LIVE MODE");

  // Fetch legacy rows
  const { data: rows, error } = await supabase
    .from("capital_calls")
    .select("id, data, eur, divisa, fx_source")
    .eq("divisa", "USD")
    .is("amount_native", null)
    .is("fx_rate", null)
    .order("data", { ascending: true });

  if (error) {
    console.error("Failed to fetch capital_calls:", error.message);
    process.exit(1);
  }

  const foundRows = rows ?? [];
  console.log(`Found ${foundRows.length} legacy USD rows.`);

  if (foundRows.length === 0) {
    console.log("No rows to process.");
    process.exit(0);
  }

  // Warn about suspect rows with very low eur values
  const suspectRows = foundRows.filter((row) => Number(row.eur) < 10_000);
  if (suspectRows.length > 0) {
    console.warn(
      `WARNING: ${suspectRows.length} row(s) have eur < 10,000 (may be manually corrected):`,
    );
    for (const row of suspectRows) {
      console.warn(`  - id=${row.id} eur=${row.eur}`);
    }
  }

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < foundRows.length; i++) {
    const row = foundRows[i];
    const rateDate = subtractOneCalendarDay(String(row.data).slice(0, 10));

    let rate;
    let observedAt;
    let retries = 0;

    // Retry logic for transient ECB errors
    while (true) {
      try {
        const result = await fetchEcbUsdEur(rateDate);
        rate = result.rate;
        observedAt = result.observedAt;
        break;
      } catch (err) {
        const isTransient = err.message.includes("ECB HTTP 5") || err.message.includes("fetch");
        retries++;

        if (isTransient && retries < 2) {
          console.warn(`Transient ECB error for date ${rateDate}, retrying in 2s...`);
          await sleep(2000);
        } else {
          console.error(
            `Failed to fetch ECB rate for id=${row.id} data=${row.data} rateDate=${rateDate}: ${err.message}`,
          );
          errorCount++;
          break;
        }
      }
    }

    // Skip this row if we couldn't fetch the rate
    if (!rate) {
      if (i < foundRows.length - 1) {
        await sleep(60);
      }
      continue;
    }

    const amountNative = Number(row.eur);
    // rate = USD per EUR (D.USD.EUR.SP00.A series); divide to get EUR from USD
    const eur = Math.round(amountNative / rate * 100) / 100;

    console.log(
      `id=${row.id} data=${row.data} rateDate=${rateDate} observedAt=${observedAt} USD ${amountNative} → EUR ${eur} (rate ${rate})`,
    );

    if (!DRY_RUN) {
      if (!row.id) {
        console.error(`Skipping row with missing id (data=${row.data})`);
        errorCount++;
        if (i < foundRows.length - 1) await sleep(60);
        continue;
      }
      const { error: updateError } = await supabase
        .from("capital_calls")
        .update({
          amount_native: amountNative,
          fx_rate: rate,
          eur: eur,
          fx_source: `ecb:${observedAt}`,
        })
        .eq("id", row.id);

      if (updateError) {
        console.error(`Failed to update id=${row.id}: ${updateError.message}`);
        errorCount++;
      } else {
        successCount++;
      }
    } else {
      successCount++;
    }

    // Rate limiting between rows
    if (i < foundRows.length - 1) {
      await sleep(60);
    }
  }

  console.log(`Done. Success: ${successCount} / ${foundRows.length}. Errors: ${errorCount}.`);
  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
