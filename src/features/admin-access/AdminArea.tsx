import type { ReactNode } from 'react';
import { useT } from '@/i18n';
import { AdminGate } from './AdminGate';
import { AdminLayout } from './AdminLayout';
import './admin-access.css';

/** Route `/admin`: the admin home, with the links of the layout's navigation. */
function AdminHome() {
  const t = useT();
  return (
    <AdminLayout title={t('admin.home.title')}>
      <p>{t('admin.home.signedIn')}</p>
    </AdminLayout>
  );
}

/** The English admin app (NFR-9) behind the session gate; without children, the admin home. */
export function AdminArea({ children }: { children?: ReactNode }) {
  return (
    <div lang="en" className="admin-area">
      <AdminGate>{children ?? <AdminHome />}</AdminGate>
    </div>
  );
}
