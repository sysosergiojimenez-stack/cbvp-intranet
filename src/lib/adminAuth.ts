let adminCredentials: { codigo: string; contrasena: string } | null = null;

export function setAdminCredentials(codigo: string, contrasena: string) {
  adminCredentials = { codigo, contrasena };
}

export function clearAdminCredentials() {
  adminCredentials = null;
}

export function getAdminAuthHeader(): string | null {
  if (!adminCredentials) return null;
  const token = typeof btoa === 'function'
    ? btoa(`${adminCredentials.codigo}:${adminCredentials.contrasena}`)
    : Buffer.from(`${adminCredentials.codigo}:${adminCredentials.contrasena}`).toString('base64');
  return `Basic ${token}`;
}

export function getAdminCredentials() {
  return adminCredentials;
}
