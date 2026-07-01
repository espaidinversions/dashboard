const { PM_MODEL } = require('./src/data/publicMarketsModel.js');
const fp = require('./src/generated/prices/fundPrices.js');
const fundPrices = fp.FUND_PRICES ?? fp.default ?? {};
const { buildPmVehicleCoverageReport } = require('./src/data/pmVehicleCoverage.js');

const allPriceSeries = Object.fromEntries(Object.entries(fundPrices).map(([isin, pts]) => [isin, pts]));
const report = buildPmVehicleCoverageReport({ pmModel: PM_MODEL, allPriceSeries, fundPrices, estimatedPriceIsins: new Set() });

console.log(JSON.stringify({
  reportEndMonth: report.reportEndMonth,
  summary: {
    total: report.summary.total,
    withPrice: report.summary.withPrice,
    withUnits: report.summary.withUnits,
    fullCoverage: report.summary.fullCoverage,
    totalLifecycle: report.summary.totalLifecycle,
    totalValueMonths: report.summary.totalValueMonths,
  },
  rows: report.rows,
  active: PM_MODEL.holdings.active.map(p => ({
    isin: p.isin,
    nom: p.nom,
    custodian: p.custodian,
    tipus: p.tipus,
    dataCompra: p.dataCompra,
    valorMercat: p.valorMercat,
    costEur: p.costEur,
    rendInici: p.rendInici,
    rend2026: p.rend2026,
    rend2025: p.rend2025,
    rend2024: p.rend2024,
    rend2023: p.rend2023,
    rend2022: p.rend2022,
  })),
  closed: PM_MODEL.holdings.closed.map(p => ({
    isin: p.isin,
    nom: p.nom,
    custodian: p.custodian,
    tipus: p.tipus,
    dataCompra: p.dataCompra,
    endDate: p.endDate,
    costEur: p.costEur,
    rendInici: p.rendInici,
    any: p.any,
  })),
}));
