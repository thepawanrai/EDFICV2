import { useEffect } from 'react';

interface SeoHeadProps {
  title: string;
  description: string;
  canonicalPath?: string;
  type?: 'website' | 'article';
  noIndex?: boolean;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
}

function upsertMetaTag(
  attrName: 'name' | 'property',
  attrValue: string,
  content: string
) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attrName}="${attrValue}"]`
  );
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function SeoHead({
  title,
  description,
  canonicalPath,
  type = 'website',
  noIndex = false,
  structuredData,
}: SeoHeadProps) {
  const serializedSchema = structuredData ? JSON.stringify(structuredData) : '';

  useEffect(() => {
    const origin = window.location.origin;
    const path = canonicalPath ?? window.location.pathname;
    const canonicalUrl = `${origin}${path}`;

    document.title = title;
    upsertMetaTag('name', 'description', description);
    upsertMetaTag(
      'name',
      'robots',
      noIndex ? 'noindex, nofollow' : 'index, follow'
    );
    upsertMetaTag('property', 'og:type', type);
    upsertMetaTag('property', 'og:title', title);
    upsertMetaTag('property', 'og:description', description);
    upsertMetaTag('property', 'og:url', canonicalUrl);
    upsertMetaTag(
      'property',
      'og:site_name',
      'EDFIC - EWA Diagnostic and Fetal Imaging Centre'
    );
    upsertMetaTag('name', 'twitter:card', 'summary_large_image');
    upsertMetaTag('name', 'twitter:title', title);
    upsertMetaTag('name', 'twitter:description', description);
    upsertCanonical(canonicalUrl);

    const existingScript = document.getElementById('edfic-jsonld');
    if (serializedSchema) {
      const script = existingScript ?? document.createElement('script');
      script.id = 'edfic-jsonld';
      script.setAttribute('type', 'application/ld+json');
      script.textContent = serializedSchema;
      if (!existingScript) {
        document.head.appendChild(script);
      }
    } else if (existingScript) {
      existingScript.remove();
    }
  }, [title, description, canonicalPath, type, noIndex, serializedSchema]);

  return null;
}

export function buildClinicJsonLd(params?: {
  primaryPhone?: string;
  officialEmail?: string;
}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalClinic',
    name: 'EDFIC - EWA Diagnostic and Fetal Imaging Centre',
    alternateName: 'EDFIC (A Unit of EWA DERMA)',
    medicalSpecialty: ['Radiology', 'Obstetric', 'Diagnostic'],
    url: origin || undefined,
    parentOrganization: {
      '@type': 'MedicalOrganization',
      name: 'EWA DERMA',
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Unit 10, Millennium Place, Sushant Golf City (Near Lulu Mall)',
      addressLocality: 'Lucknow',
      addressRegion: 'Uttar Pradesh',
      addressCountry: 'IN',
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ],
        opens: '09:00',
        closes: '20:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Sunday'],
        opens: '10:00',
        closes: '14:00',
      },
    ],
    sameAs: [
      'https://www.facebook.com/ewafetalimaging',
      'https://www.instagram.com/ewafetalimaging',
      'https://www.youtube.com/@ewafetalimaging',
    ],
    ...(params?.primaryPhone ? { telephone: params.primaryPhone } : {}),
    ...(params?.officialEmail ? { email: params.officialEmail } : {}),
  };
}
