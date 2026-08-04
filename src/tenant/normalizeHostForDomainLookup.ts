/** Strip www. and port so from-domain lookups match bare-apex CustomDomain rows. */
export function normalizeHostForDomainLookup(host: string): string {
  const bare = host.split(':')[0].trim().toLowerCase();
  return bare.startsWith('www.') ? bare.slice(4) : bare;
}
