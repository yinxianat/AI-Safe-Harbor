import { planForProductId, stateFromNotification } from "../src/lib/apple-receipt.js";

/**
 * The apple-receipt module has two parts:
 *   - Cryptographic verification via Apple's library (not tested here;
 *     testing it would require fabricating a chain of certs Apple roots).
 *   - Plain translation functions that map App Store product ids to Leeway
 *     plans and notification types to downgrade decisions.
 *
 * The translation layer is where product-side bugs live, so pin it.
 */

describe("planForProductId", () => {
  it.each([
    ["leeway.plus.monthly", "plus"],
    ["leeway.plus.yearly", "plus"],
    ["leeway.pro.monthly", "pro"],
    ["leeway.pro.yearly", "pro"],
  ])("maps %s → %s", (pid, plan) => {
    expect(planForProductId(pid)).toBe(plan);
  });

  it("falls back to free on unknown ids", () => {
    expect(planForProductId("leeway.enterprise.annual")).toBe("free");
    expect(planForProductId("unknown.sku")).toBe("free");
  });

  it("safe on non-string input", () => {
    expect(planForProductId(null)).toBe("free");
    expect(planForProductId(undefined)).toBe("free");
    expect(planForProductId(42)).toBe("free");
  });
});

describe("stateFromNotification", () => {
  function tx({ product = "leeway.plus.monthly", expires = Date.now() + 86400_000 } = {}) {
    return {
      data: { transactionInfo: { productId: product, expiresDate: expires } },
    };
  }

  it.each([
    ["SUBSCRIBED", "plus"],
    ["DID_RENEW", "plus"],
    ["DID_CHANGE_RENEWAL_STATUS", "plus"],
    ["OFFER_REDEEMED", "plus"],
  ])("upgrade-type %s keeps plan=%s", (type, plan) => {
    const state = stateFromNotification({ ...tx(), notificationType: type });
    expect(state.plan).toBe(plan);
    expect(state.expiresAt).toBeInstanceOf(Date);
  });

  it.each([
    ["EXPIRED"],
    ["REFUND"],
    ["REVOKE"],
    ["GRACE_PERIOD_EXPIRED"],
  ])("downgrade-type %s forces plan=free", (type) => {
    const state = stateFromNotification({ ...tx(), notificationType: type });
    // Even though the transactionInfo still carries a Plus product, a
    // revocation or expiry must drop the user. This is what kept a
    // refunded user on plus in the webhook's first draft.
    expect(state.plan).toBe("free");
  });

  it("handles a Pro product correctly on renewal", () => {
    const state = stateFromNotification({
      notificationType: "DID_RENEW",
      ...tx({ product: "leeway.pro.yearly" }),
    });
    expect(state.plan).toBe("pro");
  });

  it("returns null expiresAt on a missing timestamp", () => {
    const state = stateFromNotification({
      notificationType: "SUBSCRIBED",
      data: { transactionInfo: { productId: "leeway.plus.monthly" } },
    });
    expect(state.expiresAt).toBeNull();
  });
});
