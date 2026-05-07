-- Migrate "Aportació Temporal" rows to "Aportació"
-- This concept has been removed; all three original types that mapped to it
-- (Aportació Temporal, Aportació Capital a gestionar (no equity), Aportació no capital)
-- are now normalised to "Aportació".

UPDATE capital_calls
SET tipus = 'Aportació'
WHERE tipus = 'Aportació Temporal';
