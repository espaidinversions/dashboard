-- Canonicalize Wildlynx naming across Search Funds tables.
-- Correct display name confirmed: Wildlynx Capital, SL.

UPDATE public.searchers
SET nom = 'Wildlynx Capital, SL'
WHERE trim(nom) IN ('Wild Lynx Capital', 'Wild Lynx Capital, SL', 'Wildlynx Capital');

UPDATE public.capital_calls
SET fons = 'Wildlynx Capital, SL'
WHERE trim(fons) IN ('Wild Lynx Capital', 'Wild Lynx Capital, SL', 'Wildlynx Capital');

UPDATE public.private_entities
SET canonical_name = 'Wildlynx Capital, SL',
    source_name = 'Wildlynx Capital, SL',
    workbook_name = 'WILDLYNX CAPITAL, SL'
WHERE id = 'B70772108'
   OR trim(canonical_name) IN ('Wild Lynx Capital', 'Wild Lynx Capital, SL', 'Wildlynx Capital');

UPDATE public.portfolio_companies
SET nom = 'Wildlynx Capital, SL'
WHERE entity_id = 'B70772108'
   OR trim(nom) IN ('Wild Lynx Capital', 'Wild Lynx Capital, SL', 'Wildlynx Capital');
