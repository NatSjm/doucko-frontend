import { queryParam } from '@/app/route-paths';
import { AdminLayout, LoadState } from '@/features/admin-access/AdminLayout';
import { ApiError } from '@/features/admin-access/problem';
import { useT } from '@/i18n';
import { useSource } from './api';
import { parsePage } from './page';
import { PdfViewer } from './PdfViewer';

/** Route `/admin/sources/view?sourceId=…&page=…`: a source's PDF opened at a page (FR-2, FR-13). */
export function SourceViewerScreen() {
  const t = useT();
  const sourceId = queryParam('sourceId');
  const source = useSource(sourceId);
  const notFound = !sourceId || (source.error instanceof ApiError && source.error.status === 404);

  if (notFound)
    return (
      <AdminLayout title={t('admin.sources.title')}>
        <p role="alert">{t('admin.sources.notFound')}</p>
        <p>
          <a className="admin-link" href="/admin/sources">
            {t('admin.sources.back')}
          </a>
        </p>
      </AdminLayout>
    );
  if (!source.data)
    return (
      <AdminLayout title={t('admin.sources.title')}>
        <LoadState error={source.isError} onRetry={() => void source.refetch()} />
      </AdminLayout>
    );
  const { title, pageCount } = source.data;
  const initialPage = parsePage(queryParam('page') ?? '', pageCount) ?? 1;
  return (
    <AdminLayout title={<span data-content>{title}</span>} wide>
      <PdfViewer sourceId={source.data.sourceId} pageCount={pageCount} initialPage={initialPage} />
    </AdminLayout>
  );
}
