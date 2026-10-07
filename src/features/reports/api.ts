import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { components } from '@/api/generated/schema';
import { adminClient } from '@/features/admin-access/adminClient';
import { unwrap } from '@/features/admin-access/problem';

type S = components['schemas'];
export type Report = S['Report'];
export type ReportStatus = S['ReportStatus'];
export type ReevaluationResult = S['ReevaluationResult'];
export type Verdict = S['Verdict'];

export const REPORTS_KEY = ['admin', 'reports'] as const;

/** The flag queue in the server's order (`listReports`, FR-41), filtered by `status` when given. */
export function useReports(status: ReportStatus | null) {
  return useQuery({
    queryKey: [...REPORTS_KEY, status ?? 'ALL'],
    queryFn: async () => unwrap(await adminClient.GET('/api/admin/reports', { params: { query: status ? { status } : {} } })),
    placeholderData: keepPreviousData,
  });
}

/** Re-checks the report's attached attempt with the task's current answer spec (`reevaluateReport`). */
export async function reevaluateReport(reportId: string): Promise<ReevaluationResult> {
  return unwrap(await adminClient.POST('/api/admin/reports/{reportId}/reevaluate', { params: { path: { reportId } } }));
}

/** Sets an open report to DISMISSED (`dismissReport`); nothing else changes. */
export async function dismissReport(reportId: string): Promise<Report> {
  return unwrap(await adminClient.POST('/api/admin/reports/{reportId}/dismiss', { params: { path: { reportId } } }));
}
