/// <reference types="google.maps" />
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { ExternalLink, MapPin, Navigation } from 'lucide-react';
import { apiFetch } from '../../lib/api';

const GOOGLE_MAPS_SHARE_URL = 'https://share.google/W4AIbdXb02MrC3Ewv';

interface ClinicLocationMapProps {
  clinicName?: string;
  addressLine?: string;
  landmark?: string;
  cityStateCountry?: string;
}

interface ResolvedPlaceData {
  location: google.maps.LatLngLiteral;
  displayName?: string;
  formattedAddress?: string;
  googleMapsURI?: string;
}

function ClinicMapCanvas({
  clinicName,
  addressLine,
  landmark,
  cityStateCountry,
}: ClinicLocationMapProps) {
  const placesLib = useMapsLibrary('places');
  const loadingStatus = useApiLoadingStatus();
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [resolvedPlace, setResolvedPlace] = useState<ResolvedPlaceData | null>(null);
  const [resolving, setResolving] = useState(true);
  const [lookupError, setLookupError] = useState(false);
  const [infoOpen, setInfoOpen] = useState(true);
  const [mapTypeId, setMapTypeId] = useState<string>('satellite');

  useEffect(() => {
    let cancelled = false;

    async function resolveClinicLocation() {
      if (!placesLib) return;
      setResolving(true);
      setLookupError(false);

      const queries = [
        'EWA Diagnostic and Fetal Imaging Centre Sushant Golf City Lucknow',
        'Millennium Place Sushant Golf City Lucknow',
        'Sushant Golf City Lucknow',
      ];

      try {
        for (const textQuery of queries) {
          const { places } = await placesLib.Place.searchByText({
            textQuery,
            fields: ['displayName', 'formattedAddress', 'location', 'googleMapsURI'],
            language: 'en',
            region: 'in',
            maxResultCount: 1,
          });

          const first = places?.[0];
          if (first?.location) {
            if (!cancelled) {
              setResolvedPlace({
                location: {
                  lat: first.location.lat(),
                  lng: first.location.lng(),
                },
                displayName: first.displayName ?? undefined,
                formattedAddress: first.formattedAddress ?? undefined,
                googleMapsURI: first.googleMapsURI ?? undefined,
              });
              setResolving(false);
            }
            return;
          }
        }

        if (!cancelled) {
          setLookupError(true);
          setResolving(false);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.includes('RESOURCE_EXHAUSTED') ||
          message.includes('OVER_QUERY_LIMIT') ||
          message.includes('Quota') ||
          message.includes('429')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        if (!cancelled) {
          setLookupError(true);
          setResolving(false);
        }
      }
    }

    void resolveClinicLocation();
    return () => {
      cancelled = true;
    };
  }, [placesLib]);

  if (
    loadingStatus === APILoadingStatus.FAILED ||
    loadingStatus === APILoadingStatus.AUTH_FAILURE ||
    lookupError
  ) {
    return (
      <div className="flex h-[380px] sm:h-[440px] w-full flex-col items-center justify-center bg-[#062933] px-6 text-center text-white">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0D4A5A] text-[#9BE3F0] border border-[#287887]/50">
          <MapPin className="h-5 w-5" />
        </div>
        <h3 className="mt-4 font-display text-lg font-semibold text-white">
          {clinicName || 'EWA Diagnostic and Fetal Imaging Centre'}
        </h3>
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[#C2E3EC]">
          {addressLine || 'Unit 10, Millennium Place, Sushant Golf City'} (
          {landmark || 'Near Lulu Mall'}), {cityStateCountry || 'Lucknow, Uttar Pradesh, India'}
        </p>
        <a
          href={GOOGLE_MAPS_SHARE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-[#287887] px-5 text-xs font-semibold text-white transition-colors hover:bg-[#358F9F]"
        >
          <Navigation className="h-3.5 w-3.5" />
          <span>Open Pin in Google Maps</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }

  if (resolving || !resolvedPlace) {
    return (
      <div className="flex h-[380px] sm:h-[440px] w-full flex-col items-center justify-center bg-[#062933] text-[#9BE3F0]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#287887] border-t-[#9BE3F0]" />
        <p className="mt-3 text-xs font-medium tracking-wide text-[#C2E3EC]">
          Loading Sushant Golf City clinic map...
        </p>
      </div>
    );
  }

  const placeUrl = resolvedPlace.googleMapsURI || GOOGLE_MAPS_SHARE_URL;

  return (
    <div className="h-[380px] sm:h-[440px] w-full">
      <GoogleMap
        defaultCenter={resolvedPlace.location}
        defaultZoom={17}
        mapId="DEMO_MAP_ID"
        mapTypeId={mapTypeId}
        onMapTypeIdChanged={(ev) => {
          const next = ev.map.getMapTypeId();
          if (typeof next === 'string' && next !== mapTypeId) {
            setMapTypeId(next);
          }
        }}
        colorScheme="DARK"
        gestureHandling="cooperative"
        mapTypeControl={true}
        streetViewControl={false}
        fullscreenControl={true}
        zoomControl={true}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
      >
        <AdvancedMarker
          ref={markerRef}
          position={resolvedPlace.location}
          title={clinicName || resolvedPlace.displayName || 'EDFIC Sushant Golf City'}
          onClick={() => setInfoOpen((prev) => !prev)}
        >
          <Pin
            background="#0D4A5A"
            borderColor="#9BE3F0"
            glyphColor="#FFFFFF"
            scale={1.3}
          />
        </AdvancedMarker>

        {infoOpen && marker && (
          <InfoWindow
            anchor={marker}
            maxWidth={280}
            onCloseClick={() => setInfoOpen(false)}
          >
            <div className="edfic-map-infowindow p-1 text-[#083642]">
              <p className="font-display text-sm font-bold text-[#083642]">
                {clinicName || 'EWA Diagnostic & Fetal Imaging Centre'}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#455A64]">
                {addressLine || 'Unit 10, Millennium Place, Sushant Golf City'} ({landmark || 'Near Lulu Mall'})
              </p>
              <a
                href={GOOGLE_MAPS_SHARE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#0D4A5A] hover:underline"
              >
                <span>Open Directions</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              {placeUrl !== GOOGLE_MAPS_SHARE_URL && (
                <span className="sr-only">{placeUrl}</span>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}

export function ClinicLocationMap(props: ClinicLocationMapProps) {
  const clientEnvKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    (globalThis as { GOOGLE_MAPS_API_KEY?: string }).GOOGLE_MAPS_API_KEY ||
    '';

  const { data: mapsConfig, isLoading: loadingConfig } = useQuery({
    queryKey: ['public-maps-config'],
    queryFn: () => apiFetch<{ apiKey: string }>('/api/v1/public/maps-config'),
    enabled: !clientEnvKey,
    staleTime: 10 * 60 * 1000,
  });

  const apiKey = clientEnvKey || mapsConfig?.apiKey || '';

  return (
    <section
      aria-labelledby="clinic-map-heading"
      className="mt-12 overflow-hidden rounded-2xl border border-[#145869] bg-[#083642] text-white shadow-[0_24px_48px_-20px_rgba(8,54,66,0.45)]"
    >
      {/* Dark Teal Architectural Header Bar */}
      <div className="flex flex-col gap-4 border-b border-[#16596B] bg-gradient-to-r from-[#083642] via-[#0D4A5A] to-[#083642] px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9BE3F0]">
            SUSHANT GOLF CITY · NEAR LULU MALL
          </p>
          <h2
            id="clinic-map-heading"
            className="mt-1.5 font-display text-2xl sm:text-3xl font-bold text-white"
          >
            Find EDFIC on Google Maps
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[#CBE6EE]">
            {props.addressLine || 'Unit 10, Millennium Place, Sushant Golf City'},{' '}
            {props.cityStateCountry || 'Lucknow, Uttar Pradesh, India'}
          </p>
        </div>

        <a
          href={GOOGLE_MAPS_SHARE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-[#9BE3F0]/35 bg-[#0A3E4C] px-5 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-[#135E72] whitespace-nowrap"
        >
          <Navigation className="h-4 w-4 text-[#9BE3F0]" />
          <span>Get Directions</span>
          <ExternalLink className="h-3.5 w-3.5 text-[#9BE3F0]" />
        </a>
      </div>

      {/* Embedded Google Map Viewport */}
      <div className="relative bg-[#062933]">
        {loadingConfig && !apiKey ? (
          <div className="flex h-[380px] sm:h-[440px] w-full flex-col items-center justify-center text-[#9BE3F0]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#287887] border-t-[#9BE3F0]" />
            <p className="mt-3 text-xs text-[#C2E3EC]">Initializing map view...</p>
          </div>
        ) : apiKey ? (
          <APIProvider
            apiKey={apiKey}
            libraries={['marker', 'places']}
            language="en"
            region="IN"
          >
            <ClinicMapCanvas {...props} />
          </APIProvider>
        ) : (
          <div className="flex h-[380px] sm:h-[440px] w-full flex-col items-center justify-center px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0D4A5A] text-[#9BE3F0] border border-[#287887]/50">
              <MapPin className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold text-white">
              {props.clinicName || 'EWA Diagnostic and Fetal Imaging Centre'}
            </h3>
            <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[#C2E3EC]">
              {props.addressLine || 'Unit 10, Millennium Place, Sushant Golf City'} (
              {props.landmark || 'Near Lulu Mall'})
            </p>
            <a
              href={GOOGLE_MAPS_SHARE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-[#287887] px-5 text-xs font-semibold text-white transition-colors hover:bg-[#358F9F]"
            >
              <Navigation className="h-3.5 w-3.5" />
              <span>Open Location in Google Maps</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* Bottom Dark Teal Guidance Strip */}
      <div className="flex flex-col gap-2 border-t border-[#16596B] bg-[#072F39] px-6 py-4 text-xs text-[#CBE6EE] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-[#9BE3F0]" />
          <span>
            Landmark: {props.landmark || 'Near Lulu Mall'}, Sushant Golf City, Lucknow
          </span>
        </div>
        <a
          href={GOOGLE_MAPS_SHARE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#9BE3F0] hover:underline whitespace-nowrap"
        >
          Open exact Google Maps link
        </a>
      </div>
    </section>
  );
}
