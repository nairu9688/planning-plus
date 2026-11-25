/**
 * Lit l'heure d'expiration (ms) du jeton d'accès dans les cookies de session Supabase
 * (`sb-<ref>-auth-token`, éventuellement découpé en `.0`, `.1`…, encodé `base64-` ou JSON).
 * Sans appel réseau : sert à éviter un rafraîchissement de session sur un simple préchargement.
 */
export function sessionExpiresAt(cookies: { name: string; value: string }[]): number | null {
  const parts = cookies
    .map((c) => ({ c, m: /^sb-.+-auth-token(?:\.(\d+))?$/.exec(c.name) }))
    .filter((x) => x.m)
    .sort((a, b) => Number(a.m![1] ?? 0) - Number(b.m![1] ?? 0));
  if (!parts.length) return null;
  let raw = parts.map((x) => x.c.value).join("");
  try {
    if (raw.startsWith("base64-")) {
      const b = raw.slice(7).replace(/-/g, "+").replace(/_/g, "/");
      raw = new TextDecoder().decode(Uint8Array.from(atob(b), (ch) => ch.charCodeAt(0)));
    } else raw = decodeURIComponent(raw);
    const exp = JSON.parse(raw)?.expires_at;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}
