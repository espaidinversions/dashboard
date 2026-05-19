-- Merge duplicate private_entities created by the cc_import_append placeholder logic.
-- The placeholder IDs (VEHICLE:... slugs) map to existing entities with real fiscal names.
-- For each pair: reassign capital_calls.vehicle_id then delete the placeholder.

DO $$
DECLARE
  merge RECORD;
BEGIN
  FOR merge IN (
    SELECT loser_id, survivor_id, survivor_name FROM (VALUES
      -- Placeholder created from Excel alias name → real entity with matching fiscal_name
      ('VEHICLE:QUALITUR-CONSULTING-SL-FEEL-AT-HOME',         'B63907869',                                        'Feel at Home'),
      ('VEHICLE:THE-UMAI-GROUP-SUSHI',                        'B01755917',                                        'Umai'),
      ('VEHICLE:SALOMONTE-INVESTOR-POOLING-B-V-HOTEK',        'NLD14901645B',                                     'Hotek'),
      ('VEHICLE:EUROPEAN-SME-OPPORTUNITIES-III-L-P-IRMARFER', 'CAN1000362449',                                    'Irmafer'),
      ('VEHICLE:WORKTOGETHER-COLLECTIVE',                     'B67054338',                                        'Collective'),
      ('VEHICLE:ASF-PHARMA-ALFAVET-SEQOS-AURICA-SPV',        'B75554824',                                        'Alfavet'),
      -- Galdana III FCR is the shortened name for Galdana Ventures III FCR
      ('VEHICLE:GALDANA-III-FCR',                             'V05376298',                                        'Galdana Ventures III'),
      -- Ítaca Fire Coinvest and Grupo FIRE are the same entity
      ('VEHICLE:TACA-FIRE-COINVEST',                          'MOCKNIF:COMPANY:ÍTACA_FIRE_COINVEST',             'Grupo FIRE'),
      -- Alpha Nova Captal (typo) → Alpha Nova Capital (correct)
      ('VEHICLE:ALPHA-NOVA-CAPTAL',                           'MOCKNIF:COMPANY:ALPHA_NOVA_CAPTAL',               'Alpha Nova Capital'),
      -- Qualitas Funds Direct III SCR — clean name replaces the "?" placeholder
      ('MOCKNIF:VEHICLE:QUALITAS_FUNDS_DIRECT_III_?_SCR',     'VEHICLE:QUALITAS-FUNDS-DIRECT-III-SCR',           'Qualitas Funds Direct III SCR'),
      -- Main Foundation III — keep the fully-qualified name
      ('MOCKNIF:VEHICLE:MAIN-FOUNDATION-III',                 'MOCKNIF:VEHICLE:MAIN_FOUNDATION_III_COÖPERATIEF_U.A.', 'Main Foundation III Coöperatief U.A.')
    ) AS t(loser_id, survivor_id, survivor_name)
  )
  LOOP
    -- Reassign capital_calls
    UPDATE capital_calls
    SET vehicle_id = merge.survivor_id,
        fons       = merge.survivor_name
    WHERE vehicle_id = merge.loser_id;

    -- Reassign fund_meta (if any)
    UPDATE fund_meta
    SET vehicle_id = merge.survivor_id,
        fons       = merge.survivor_name
    WHERE vehicle_id = merge.loser_id;

    -- Reassign portfolio_companies (if any)
    UPDATE portfolio_companies
    SET entity_id = merge.survivor_id,
        nom       = merge.survivor_name
    WHERE entity_id = merge.loser_id;

    -- Delete the placeholder
    DELETE FROM private_entities WHERE id = merge.loser_id;

    RAISE NOTICE 'Merged % → %', merge.loser_id, merge.survivor_id;
  END LOOP;
END;
$$;
