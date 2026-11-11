/**
 * CLU-011: the cluster facts the guest portal reads from the public listing payload
 * (`GET /listings/{id}`, `/listings/public` -> `PublicListingDto.ClusterId` / `.ClusterRole`).
 * API only - a listing whose payload carries no cluster role is NOT a Whole-Villa parent.
 * Nothing is guessed from the listing name.
 */

export type ClusterListingFields = {
  clusterRole: string | null;
  clusterId: number | null;
};

export function readClusterListingFields(raw: Record<string, unknown> | null | undefined): ClusterListingFields {
  if (!raw) return { clusterRole: null, clusterId: null };
  const role = raw.clusterRole ?? raw.ClusterRole;
  const id = Number(raw.clusterId ?? raw.ClusterId);
  return {
    clusterRole: typeof role === 'string' && role.trim() ? role.trim().toUpperCase() : null,
    clusterId: Number.isInteger(id) && id > 0 ? id : null,
  };
}
