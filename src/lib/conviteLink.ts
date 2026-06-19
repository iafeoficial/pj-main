/** Monta URL absoluta para aceitar convite in-app. */
export function conviteLink(token: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/empresas?convite=${token}`;
}
