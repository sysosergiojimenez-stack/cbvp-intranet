let adminCredentials: { correo: string; contrasena: string } | null = null;

export function setAdminCredentials(correo: string, contrasena: string) {
  adminCredentials = { correo, contrasena };
}

export function clearAdminCredentials() {
  adminCredentials = null;
}

export function getAdminAuthHeader(): string | null {
  if (!adminCredentials) return null;
  const token = typeof btoa === 'function'
    ? btoa(`${adminCredentials.correo}:${adminCredentials.contrasena}`)
    : Buffer.from(`${adminCredentials.correo}:${adminCredentials.contrasena}`).toString('base64');
  return `Basic ${token}`;
}

export function getAdminCredentials() {
  return adminCredentials;
}
