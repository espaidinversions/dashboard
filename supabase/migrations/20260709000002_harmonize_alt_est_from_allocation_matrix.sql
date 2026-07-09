-- 20260709000002_harmonize_alt_est_from_allocation_matrix.sql
-- Single strategy per Alternatives vehicle, sourced from 260120_Allocation_Fons.xlsx
-- (Matrius sheet, dominant of Primari/FoF/Secundari/Coinversió). Applies ONLY to
-- vehicles already in the ALT section — RE / Search Fund / Participada are excluded,
-- because Matrius's strategy axis is orthogonal to the RE/ALT/SF section and would
-- otherwise flip Real-Estate funds (Meridia, Tectum, Espaiactiu, Inveractiva…) into
-- Primari. Name harmonization is exact-normalized (unaccent+lower+collapsed spaces)
-- plus one verified alias (ACP Secondaries 5 ⇄ "ACP Secondaries 5 FCR").
CREATE EXTENSION IF NOT EXISTS unaccent;
WITH alloc(nname, type) AS (VALUES
('inveready vfiii','Fons Primari'),('altamar x','Fons de Fons'),('galdana ventures ii','Fons de Fons'),
('invivo ventures','Fons Primari'),('altamar x midmarket','Fons Primari'),('pictet monte rosa v','Fons de Fons'),
('arcano xii','Fons de Fons'),('arcano earth','Fons de Fons'),('t2 energy-b.march','Fons de Coinversió'),
('inveractiva sia deuda','Fons Primari'),('pantheon co-inv','Fons de Coinversió'),('pictet co-inv iv','Fons de Coinversió'),
('cs seasons global','Fons de Fons'),('jp morgan vintage 2020','Fons de Coinversió'),('pictet tech','Fons de Fons'),
('inveractiva plus ii a s.l','Fons Primari'),('seedrocket 4founders','Fons Primari'),('ebn pre ipo us ii','Fons Primari'),
('samaipata ii','Fons Primari'),('qualitas mutual pe program iv','Fons de Fons'),('g squared v','Fons Primari'),
('cs climate innovation fund','Fons de Fons'),('suma capital growth ii','Fons Primari'),('jp morgan vintage 2018','Fons de Coinversió'),
('acp secondaries 4','Fons Secundari'),('seaya ventures iii','Fons Primari'),('inveractiva sia deuda ii','Fons Primari'),
('aldea ventures','Fons de Fons'),('galdana iii fcr','Fons de Fons'),('aurica growth fund capital iv','Fons Primari'),
('ebn pre ipo us iii','Fons Primari'),('galdana asia','Fons de Fons'),('qualitas funds direct i scr','Fons de Coinversió'),
('the extension fund scr-pyme','Fons Primari'),('mcwin - ebitda investmens fund i scsp','Fons de Fons'),('inveready hte infra scr','Fons Primari'),
('capital dynamics mid-market direct v','Fons de Coinversió'),('inveractiva plus iii a s.l','Fons Primari'),('pictet monte rosa co-invest. v','Fons de Coinversió'),
('pictet monte rosa vi fcr','Fons de Fons'),('qualitas funds v a scr','Fons de Fons'),('arcano pe investments 2022 scr sa','Fons Secundari'),
('jp morgan vintage 2022','Fons de Coinversió'),('q-energy sustainable v fcr','Fons Primari'),('lee equity partners fund iv, lp','Fons Primari'),
('bid equity fund iii scsp','Fons Primari'),('hg mercury 4 (lux), scsp','Fons Primari'),('ara fund iii-a, scsp','Fons Primari'),
('alpine investors ix-a, lp','Fons Primari'),('faso vi scsp','Fons Secundari'),('norvestor ix','Fons Primari'),
('adams street - asp lux raif global secondary fund 7','Fons Secundari'),('arcano earth ii 2021 scr','Fons de Fons'),('acp secondaries 5 fcr','Fons Secundari'),
('mpep fund sicav raif - mpep fund v north america scsp','Fons de Fons'),('mpep fund sicav raif - mpep fund v europe scsp','Fons de Fons'),('oakley capital origin ii-b2 scsp','Fons Primari'),
('qualitas funds vi scr a','Fons de Fons'),('casf v s.l.p.','Fons Secundari'),('naxicap investment opportunities iii','Fons Primari'),
('main capital viii cooperatief u.a.','Fons Primari'),('main foundation ii cooperatief u.a.','Fons Primari'),('alder iii (d) ab','Fons Primari'),
('invivo ventures iii parallel fund fcre','Fons Primari'),('inveractiva sia plus iv d','Fons Primari'),('nexxus iberia private equity fund ii fcr','Fons Primari'),
('qualitas funds direct ii a scr','Fons de Coinversió'),('espaiactiu','Fons Primari'),('nautic partners xi-a lp','Fons Primari'),
('montefiore investment vi slp','Fons Primari'),('ik partners x','Fons Primari'),('capital dynamics secondaries vi','Fons Secundari'),
('arcano pe co-investments 2024 scr','Fons de Coinversió'),('k6 private investors','Fons Primari'),('frontenac xiii (parallel)','Fons Primari'),
('ik small cap iv fund','Fons Primari'),('meridia real estate fund v ficc','Fons Primari'),('norvestor nova i scsp','Fons Primari'),
('arcano pe secondaries 2024 scr','Fons Secundari'),('veritas ix','Fons Primari'),('rcp fund xix (eu) scsp','Fons de Fons'),
('novacap tech vii-b','Fons Primari'),('chicago pacific founders fund iv-a lp','Fons Primari'),('magnum capital iv','Fons Primari'),
('tectum iii','Fons Primari'),('scipio swanlaab sf scr','Fons Primari'),('capital dynamics mid-market direct vi sca','Fons de Coinversió'),
('aurica search fund','Fons Primari')
),
alias(fons_exact, nname) AS (VALUES ('ACP Secondaries 5','acp secondaries 5 fcr')),
altfunds AS (
  SELECT fons FROM capital_calls GROUP BY fons
  HAVING bool_and(
    est IS NULL OR est IN ('Fons Primari','Fons de Fons','Fons Secundari','Fons de Coinversió')
    OR est ILIKE 'Fons%Sec_ndari%' OR est ILIKE 'Fons%Coinversi%' OR est ILIKE 'Coinversi%'
  )
),
nfons AS (
  SELECT DISTINCT fons, lower(btrim(regexp_replace(unaccent(fons),'\s+',' ','g'))) AS n
  FROM capital_calls
),
resolved AS (
  SELECT nf.fons, a.type
  FROM nfons nf
  JOIN altfunds af ON af.fons = nf.fons
  LEFT JOIN alias al ON al.fons_exact = nf.fons
  JOIN alloc a ON a.nname = COALESCE(al.nname, nf.n)
)
UPDATE capital_calls cc
SET est = r.type
FROM resolved r
WHERE cc.fons = r.fons
  AND cc.est IS DISTINCT FROM r.type;
