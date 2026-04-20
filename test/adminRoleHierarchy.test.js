import test from "node:test";
import assert from "node:assert/strict";
import { verifyAdmin, verifyAdminOnly } from "../api/_adminAuth.js";

async function makeServiceClient(role) {
  return {
    auth: {
      async getUser(token) {
        if (!token) return { data: { user: null }, error: new Error("missing token") };
        return {
          data: {
            user: {
              id: "user-1",
              app_metadata: { role },
            },
          },
          error: null,
        };
      },
    },
  };
}

function makeReq() {
  return {
    headers: {
      authorization: "Bearer test-token",
    },
  };
}

test("verifyAdmin accepts both elevated roles", async () => {
  assert.ok(await verifyAdmin(makeReq(), await makeServiceClient("admin")));
  assert.ok(await verifyAdmin(makeReq(), await makeServiceClient("superuser")));
});

test("verifyAdminOnly accepts admin and rejects superuser", async () => {
  assert.ok(await verifyAdminOnly(makeReq(), await makeServiceClient("admin")));
  assert.equal(await verifyAdminOnly(makeReq(), await makeServiceClient("superuser")), null);
});
