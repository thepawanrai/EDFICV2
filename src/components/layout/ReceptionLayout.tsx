import React from 'react';
import { StaffLayout } from './StaffLayout';

export function ReceptionLayout({
  title,
  breadcrumb = 'Reception Desk',
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
