import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/design-system';
import { useT } from '@/i18n';
import { format } from '@/i18n/format';
import { fetchSourceFile } from './api';
import { parsePage } from './page';
import type { PdfDocument } from './pdf';
import './sources.css';

/** Loads the PDF of a source (through the admin client) and opens it with pdf.js, loaded lazily. */
function usePdf(sourceId: string) {
  return useQuery({
    queryKey: ['admin', 'source-file', sourceId],
    queryFn: async (): Promise<PdfDocument> => {
      const [{ loadPdf }, bytes] = await Promise.all([import('./pdf'), fetchSourceFile(sourceId)]);
      return loadPdf(bytes);
    },
    // Not kept after the viewer closes: the document is destroyed with it.
    gcTime: 0,
    retry: false,
  });
}

/**
 * The PDF of a source, one page at a time, with previous / next and a page field (FR-2). A page that
 * is not a whole number from 1 to `pageCount` keeps the current page and shows the valid range. The
 * page state is the viewer's own, so paging never touches a form next to it.
 */
export function PdfViewer({ sourceId, pageCount, initialPage }: { sourceId: string; pageCount: number; initialPage: number }) {
  const t = useT();
  const fieldId = useId();
  const pdf = usePdf(sourceId);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(initialPage);
  const [rendered, setRendered] = useState<number | null>(null);
  const [typed, setTyped] = useState(String(initialPage));
  const [invalid, setInvalid] = useState(false);
  const [failed, setFailed] = useState(false);

  /** The render in flight: pdf.js cannot draw two renders into one canvas, so each waits for the last. */
  const chain = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const doc = pdf.data;
    if (!doc) return;
    return () => doc.destroy();
  }, [pdf.data]);

  useEffect(() => {
    const doc = pdf.data;
    if (!doc) return;
    let current = true;
    chain.current = chain.current
      .then(() => (current ? doc.renderPage(page, canvas.current as HTMLCanvasElement).then(() => (current ? setRendered(page) : undefined)) : undefined))
      .catch(() => setFailed(true));
    return () => {
      current = false;
    };
  }, [pdf.data, page]);

  function show(next: number) {
    setPage(next);
    setTyped(String(next));
    setInvalid(false);
  }

  function jump(event: FormEvent) {
    event.preventDefault();
    const next = parsePage(typed, pageCount);
    if (next === null) setInvalid(true);
    else show(next);
  }

  return (
    <div className="pdf-viewer">
      <form className="pdf-controls" onSubmit={jump} noValidate>
        <Button disabled={page <= 1} onClick={() => show(page - 1)}>
          {t('admin.viewer.prev')}
        </Button>
        <Button disabled={page >= pageCount} onClick={() => show(page + 1)}>
          {t('admin.viewer.next')}
        </Button>
        <label htmlFor={fieldId}>{t('admin.viewer.page')}</label>
        <input
          id={fieldId}
          className="admin-field pdf-page-field"
          inputMode="numeric"
          value={typed}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${fieldId}-error` : undefined}
          onChange={(e) => setTyped(e.target.value)}
        />
        <Button type="submit">{t('admin.viewer.go')}</Button>
        <span className="admin-numeric">{format(t('admin.viewer.status'), { page, count: pageCount })}</span>
      </form>
      {invalid && (
        <p id={`${fieldId}-error`} className="admin-error" role="alert">
          {format(t('admin.viewer.invalid'), { count: pageCount })}
        </p>
      )}
      {(pdf.isError || failed) && <p role="alert">{t('admin.viewer.failed')}</p>}
      {pdf.isPending && <p>{t('admin.viewer.loading')}</p>}
      {/* Scrolls when the page is larger than the pane, so it takes keyboard focus (arrow keys scroll). */}
      <div className="pdf-page" role="region" aria-label={t('admin.viewer.label')} tabIndex={0}>
        <canvas
          ref={canvas}
          className="admin-canvas"
          role="img"
          hidden={rendered === null}
          data-rendered-page={rendered ?? undefined}
          aria-label={format(t('admin.viewer.canvas'), { page: rendered ?? page })}
        />
      </div>
    </div>
  );
}
