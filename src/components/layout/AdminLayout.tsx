import React from 'react';
import { StaffLayout } from './StaffLayout';

export function AdminLayout({
  title,
  breadcrumb = 'Administration',
  children,
}: {
  title: string;
  breadcrumb?: string;
  children: React.ReactNode;
}) {
  return (
    <StaffLayout title={title} breadcrumb={breadcrumb}>
      {children}
    </StaffLayout>
  );
}
