/**
 * Message lisible pour une erreur remontée par une Server Action. En production, Next.js masque
 * le message réel (« An error occurred in the Server Components render… ») : on le remplace.
 */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (!msg || /Server Components render|digest|unexpected response/i.test(msg)) {
    return "Ça n'a pas marché. Vérifie les champs ; si ça recommence, recharge la page (tu as peut-être été déconnecté).";
  }
  if (/fetch failed|Failed to fetch|NetworkError|Load failed/i.test(msg)) return "Pas de connexion. Réessaie dans un instant.";
  return msg;
}
