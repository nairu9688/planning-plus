import { describe, expect, it } from "vitest";
import { sessionExpiresAt } from "../session-cookie";

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const json = JSON.stringify({ access_token: "x", expires_at: 1795600000, refresh_token: "r" });

describe("sessionExpiresAt — expiration du jeton lue dans les cookies Supabase", () => {
  it("cookie unique encodé base64-", () => {
    expect(sessionExpiresAt([{ name: "sb-abc-auth-token", value: `base64-${b64(json)}` }])).toBe(1795600000 * 1000);
  });

  it("cookie découpé en morceaux .0 .1 (dans le désordre)", () => {
    const v = `base64-${b64(json)}`;
    const cut = Math.floor(v.length / 2);
    expect(
      sessionExpiresAt([
        { name: "sb-abc-auth-token.1", value: v.slice(cut) },
        { name: "other", value: "1" },
        { name: "sb-abc-auth-token.0", value: v.slice(0, cut) },
      ]),
    ).toBe(1795600000 * 1000);
  });

  it("JSON brut (sans base64) et absence de cookie", () => {
    expect(sessionExpiresAt([{ name: "sb-abc-auth-token", value: encodeURIComponent(json) }])).toBe(1795600000 * 1000);
    expect(sessionExpiresAt([{ name: "x", value: "y" }])).toBeNull();
    expect(sessionExpiresAt([{ name: "sb-abc-auth-token", value: "base64-@@@" }])).toBeNull();
  });
});
