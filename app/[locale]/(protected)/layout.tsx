
import type {Metadata} from 'next';

import {AppShell} from '@/components/app/app-shell';

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false
  }
};

export default function ProtectedLayout({children}: {children: React.ReactNode}) {
  return <AppShell>{children}</AppShell>;
}
