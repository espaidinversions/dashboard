import test from "node:test";
import assert from "node:assert/strict";

import {
  ACCESS_NONE,
  ACCESS_SUPERUSER,
  ACCESS_USER,
  buildSectionAccessMap,
  getSectionAccessLevel,
  hasSectionAccess,
} from "../src/permissions.js";

test("buildSectionAccessMap gives admins full section superuser access", () => {
  const access = buildSectionAccessMap({ role: "admin" });
  assert.equal(getSectionAccessLevel(access, "alternatives"), ACCESS_SUPERUSER);
  assert.equal(getSectionAccessLevel(access, "mercats-publics"), ACCESS_SUPERUSER);
  assert.equal(getSectionAccessLevel(access, "searchers"), ACCESS_SUPERUSER);
});

test("explicit section roles override the default user baseline", () => {
  const access = buildSectionAccessMap({
    role: "user",
    sectionRoles: {
      "mercats-publics": ACCESS_NONE,
      "real-estate": ACCESS_SUPERUSER,
      "searchers": ACCESS_NONE,
    },
  });

  assert.equal(getSectionAccessLevel(access, "mercats-publics"), ACCESS_NONE);
  assert.equal(getSectionAccessLevel(access, "real-estate"), ACCESS_SUPERUSER);
  assert.equal(getSectionAccessLevel(access, "searchers"), ACCESS_NONE);
  assert.equal(getSectionAccessLevel(access, "companies"), ACCESS_USER);
});

test("alternatives access caps its child sections", () => {
  const access = buildSectionAccessMap({
    role: "user",
    sectionRoles: {
      alternatives: ACCESS_NONE,
      searchers: ACCESS_SUPERUSER,
    },
  });

  assert.equal(getSectionAccessLevel(access, "alternatives"), ACCESS_NONE);
  assert.equal(getSectionAccessLevel(access, "searchers"), ACCESS_NONE);
  assert.equal(hasSectionAccess(access, "searchers"), false);
  assert.equal(getSectionAccessLevel(access, "tx-alt"), ACCESS_NONE);
});

test("real-estate and public-markets subsection access can be restricted independently", () => {
  const access = buildSectionAccessMap({
    role: "user",
    sectionRoles: {
      "real-estate": ACCESS_USER,
      "re-directe": ACCESS_NONE,
      "re-altres": ACCESS_SUPERUSER,
      "mercats-publics": ACCESS_USER,
      "mp-rf": ACCESS_NONE,
      "mp-rv": ACCESS_SUPERUSER,
    },
  });

  assert.equal(getSectionAccessLevel(access, "re-directe"), ACCESS_NONE);
  assert.equal(getSectionAccessLevel(access, "re-altres"), ACCESS_USER);
  assert.equal(getSectionAccessLevel(access, "mp-rf"), ACCESS_NONE);
  assert.equal(getSectionAccessLevel(access, "mp-rv"), ACCESS_USER);
});

test("transaction shortcut leaves can escalate independently from display subsections", () => {
  const access = buildSectionAccessMap({
    role: "user",
    sectionRoles: {
      txlog: ACCESS_NONE,
      "mp-transaccions": ACCESS_NONE,
      "tx-alt": ACCESS_SUPERUSER,
      "tx-mp": ACCESS_SUPERUSER,
    },
  });

  assert.equal(getSectionAccessLevel(access, "tx-alt"), ACCESS_SUPERUSER);
  assert.equal(getSectionAccessLevel(access, "tx-mp"), ACCESS_SUPERUSER);
  assert.equal(getSectionAccessLevel(access, "txlog"), ACCESS_NONE);
  assert.equal(getSectionAccessLevel(access, "mp-transaccions"), ACCESS_NONE);
});

test("inici is denied by default for regular users but can be granted explicitly", () => {
  const baseUser = buildSectionAccessMap({ role: "user" });
  assert.equal(getSectionAccessLevel(baseUser, "inici"), ACCESS_NONE);
  assert.equal(hasSectionAccess(baseUser, "inici"), false);

  const granted = buildSectionAccessMap({
    role: "user",
    sectionRoles: { inici: ACCESS_USER },
  });
  assert.equal(hasSectionAccess(granted, "inici"), true);
});

test("inici is allowed by default for admins and legacy superusers", () => {
  assert.equal(hasSectionAccess(buildSectionAccessMap({ role: "admin" }), "inici"), true);
  assert.equal(hasSectionAccess(buildSectionAccessMap({ role: "superuser" }), "inici"), true);
});

test("cash-model is denied by default but can be granted explicitly via sectionRoles", () => {
  const baseUser = buildSectionAccessMap({ role: "user" });
  assert.equal(getSectionAccessLevel(baseUser, "cash-model"), ACCESS_NONE);
  assert.equal(hasSectionAccess(baseUser, "cash-model"), false);

  // Since 55fbc48, regular users CAN be granted cash-model explicitly (see permissions.js).
  const userGrantedUser = buildSectionAccessMap({
    role: "user",
    sectionRoles: { "cash-model": ACCESS_USER },
  });
  assert.equal(getSectionAccessLevel(userGrantedUser, "cash-model"), ACCESS_USER);
  assert.equal(hasSectionAccess(userGrantedUser, "cash-model"), true);

  const userGrantedSuperuser = buildSectionAccessMap({
    role: "user",
    sectionRoles: { "cash-model": ACCESS_SUPERUSER },
  });
  assert.equal(getSectionAccessLevel(userGrantedSuperuser, "cash-model"), ACCESS_SUPERUSER);
  assert.equal(hasSectionAccess(userGrantedSuperuser, "cash-model"), true);
});
