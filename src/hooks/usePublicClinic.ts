import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import {
  FALLBACK_PUBLIC_CATEGORIES,
  FALLBACK_PUBLIC_CLINIC,
  FALLBACK_PUBLIC_DOCTOR,
} from '../lib/publicCatalogFallback';

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
    queryFn: async () => {
      try {
        const res = await apiFetch<{ clinic: PublicClinicInfo; doctor: DoctorPublicInfo }>(
          '/api/v1/public/clinic'
        );
        return {
          clinic: res?.clinic || FALLBACK_PUBLIC_CLINIC,
          doctor: res?.doctor || FALLBACK_PUBLIC_DOCTOR,
        };
      } catch {
        return {
          clinic: FALLBACK_PUBLIC_CLINIC,
          doctor: FALLBACK_PUBLIC_DOCTOR,
        };
      }
    },
    staleTime: 60_000,
    retry: 1,
  });
}

export function usePublicServices() {
  return useQuery({
    queryKey: ['public-services'],
    queryFn: async () => {
      try {
        const res = await apiFetch<{ categories: PublicServiceCategory[] }>(
          '/api/v1/public/services'
        );
        if (res?.categories && res.categories.length > 0) {
          return res;
        }
        return { categories: FALLBACK_PUBLIC_CATEGORIES };
      } catch {
        return { categories: FALLBACK_PUBLIC_CATEGORIES };
      }
    },
    staleTime: 60_000,
    retry: 1,
  });
}
