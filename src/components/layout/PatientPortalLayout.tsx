import React from 'react';
import { PublicLayout } from './PublicLayout';

export function PatientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicLayout>{children}</PublicLayout>;
}
