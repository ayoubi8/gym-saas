import { useQuery } from '@tanstack/react-query';
import { qk } from '../../lib/query-keys';
import { fetchDashboardSummary, fetchExpiringPreview, fetchOwingPreview } from './api';

// Dashboard readers. Invalidated BY every write phase (members/plans/subscriptions/
// payments) via qk.dashboard; never invalidates others (DATA-CONTRACT.md row 05).

export function useDashboardSummary(gymId: string | undefined) {
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: () => fetchDashboardSummary(gymId as string),
    enabled: Boolean(gymId),
  });
}

export function useExpiringPreview(enabled = true) {
  return useQuery({ queryKey: qk.expiringPreview, queryFn: fetchExpiringPreview, enabled });
}

export function useOwingPreview(enabled = true) {
  return useQuery({ queryKey: qk.owingPreview, queryFn: fetchOwingPreview, enabled });
}
