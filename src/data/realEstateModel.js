export function splitRealEstateRows(rawCC) {
  const rows = Array.isArray(rawCC) ? rawCC : [];
  return {
    tx: rows.filter((row) => row.vcpe === "RE" && row.cat !== "Compromís"),
    compr: rows.filter((row) => row.vcpe === "RE" && row.cat === "Compromís"),
  };
}

export function buildRealEstateFundsMap(reCompr, reTx) {
  const map = {};

  (Array.isArray(reCompr) ? reCompr : []).forEach((row) => {
    map[row.id ?? row.fons] = {
      id: row.id ?? null,
      fons: row.fons,
      compr: row.eur,
      calls: 0,
      dist: 0,
      retorn: 0,
    };
  });

  (Array.isArray(reTx) ? reTx : []).forEach((row) => {
    const key = row.id ?? row.fons;
    if (!map[key]) {
      map[key] = {
        id: row.id ?? null,
        fons: row.fons,
        compr: 0,
        calls: 0,
        dist: 0,
        retorn: 0,
      };
    }
    if (row.cat === "Capital Call") map[key].calls += row.eur;
    if (row.cat === "Distribució") map[key].dist += Math.abs(row.eur);
    if (row.cat === "Retorn Capital") map[key].retorn += Math.abs(row.eur);
  });

  return Object.values(map).sort((a, b) => b.compr - a.compr);
}
