// The hosting edge rejects fetches to bare IPv4 hosts (Cloudflare error 1003), so map them to an
// sslip.io hostname that resolves to the same address.
export function viaHostname(base: string): string {
  return base.replace(/^(https?:\/\/)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?=[:/]|$)/, '$1$2-$3-$4-$5.sslip.io')
}
