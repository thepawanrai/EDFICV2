import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface PublicClinicInfo {
  clinicName: string;
  fullName: string;
  parentUnitName: string;
  tagline: string;
  addressLine: string;
  landmark: string;
  cityStateCountry: string;
  primaryPhone: string;
  secondaryPhone: string;
  whatsappNumber: string;
  officialEmail: string;
  weekdayHours: string;
  sundayHours: string;
  morningSessionStart: string;
  morningSessionEnd: string;
}

export interface DoctorPublicInfo {
  name: string;
  qualification: string;
  designation: string;
  expertise: string[];
  availability: string;
}

export interface PublicServiceItem {
  id: string;
  slug: string;
  code: string;
  name: string;
  categoryId: string;
  summary: string;
  clinicalDescription: string;
  preparationNotes: string;
  durationMinutes: number;
  requiresDoctorMorning: boolean;
}

export interface PublicServiceCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  services: PublicServiceItem[];
}

export function usePublicClinic() {
  return useQuery({
    queryKey: ['public-clinic'],
    queryFn: () =>
      apiFetch<{ clinic: PublicClinicInfo; doctor: DoctorPublicInfo }>(
        '/api/v1/public/clinic'
      ),
    staleTime: 60_000,
  });
}

export function usePublicServices() {
  return useQuery({
    queryKey: ['public-services'],
    queryFn: () =>
      apiFetch<{ categories: PublicServiceCategory[] }>('/api/v1/public/services'),
    staleTime: 60_000,
  });
}
