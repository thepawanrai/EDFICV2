import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { SeoHead, buildClinicJsonLd } from '../../components/seo/SeoHead';
import { Input } from '../../components/ui/Input';
import { usePublicServices } from '../../hooks/usePublicClinic';

export function ServicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCat = searchParams.get('category') || 'all';
  const [activeCategory, setActiveCategory] = useState(initialCat);
  const [searchTerm, setSearchTerm] = useState('');
  const { data, isLoading } = usePublicServices();

  const categories = data?.categories ?? [];

  const filteredCategories = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return categories
      .filter((c) => activeCategory === 'all' || c.slug === activeCategory)
      .map((c) => ({
        ...c,
        services: c.services.filter(
          (s) =>
            !q ||
            s.name.toLowerCase().includes(q) ||
            s.summary.toLowerCase().includes(q) ||
            s.code.toLowerCase().includes(q)
        ),
      }))
      .filter((c) => c.services.length > 0);
  }, [categories, activeCategory, searchTerm]);

  const handleCategoryChange = (slug: string) => {
    setActiveCategory(slug);
    if (slug === 'all') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', slug);
    }
    setSearchParams(searchParams, { replace: true });
  };

  return (
    <PublicLayout>
      <SeoHead
        title="Diagnostic & Fetal Imaging Service Catalogue | EDFIC"
        description="Browse approved fetal medicine, general ultrasound, Color Doppler, breast, musculoskeletal, and pelvic diagnostic investigations at EDFIC, Sushant Golf City, Lucknow."
        canonicalPath="/services"
        structuredData={buildClinicJsonLd()}
      />
      <section className="border-b border-[#DCE7E9] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold text-[#287887]">
            EDFIC Service Catalogue · A Unit of EWA DERMA
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-[#083642]">
            Diagnostic &amp; Fetal Imaging Services
          </h1>
          <p className="mt-3 max-w-2xl text-sm sm:text-base text-[#65747B]">
            Explore clinical ultrasound investigations, preparation guidelines, and appointment session requirements. All examinations are conducted on an appointment basis.
          </p>

          {/* Search & Category Filter Controls */}
          <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#65747B]" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search scan (e.g., NT Scan, Doppler, KUB)..."
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 rounded-lg bg-[#E9F3F3] p-1">
              <button
                type="button"
                onClick={() => handleCategoryChange('all')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeCategory === 'all'
                    ? 'bg-white text-[#0D4A5A] shadow-sm'
                    : 'text-[#65747B] hover:text-[#24343B]'
                }`}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryChange(cat.slug)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    activeCategory === cat.slug
                      ? 'bg-white text-[#0D4A5A] shadow-sm'
                      : 'text-[#65747B] hover:text-[#24343B]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-36 rounded-lg border border-[#DCE7E9] bg-white animate-pulse" />
            ))}
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="rounded-lg border border-[#DCE7E9] bg-white p-8 text-center">
            <p className="text-sm font-medium text-[#24343B]">
              No matching diagnostic investigations found.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                handleCategoryChange('all');
              }}
              className="mt-3 text-xs font-medium text-[#0D4A5A] underline cursor-pointer"
            >
              Reset catalogue filters
            </button>
          </div>
        ) : (
          filteredCategories.map((cat) => (
            <div key={cat.id}>
              <div className="border-b border-[#DCE7E9] pb-3">
                <h2 className="font-display text-xl font-bold text-[#083642]">{cat.name}</h2>
                <p className="mt-1 text-sm text-[#65747B]">{cat.description}</p>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {cat.services.map((svc) => (
                  <div
                    key={svc.id}
                    className="edfic-card-interactive flex flex-col justify-between rounded-lg border border-[#DCE7E9] bg-white p-5 hover:border-[#287887] edfic-card-soft"
                  >
                    <div>
                      <p className="text-xs text-[#65747B]">
                        <span className="font-mono-tabular">{svc.code}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono-tabular">{svc.durationMinutes} min</span>
                        {svc.requiresDoctorMorning && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span className="text-[#0D4A5A] font-medium">Morning Specialist</span>
                          </>
                        )}
                      </p>
                      <h3 className="mt-2 font-display text-base font-semibold text-[#083642]">
                        <Link to={`/services/${svc.slug}`} className="hover:text-[#0D4A5A]">
                          {svc.name}
                        </Link>
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-[#65747B]">
                        {svc.summary}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#E9F3F3] flex items-center justify-between text-xs font-medium">
                      <Link
                        to={`/services/${svc.slug}`}
                        className="text-[#24343B] hover:text-[#0D4A5A] inline-flex items-center gap-1"
                      >
                        <span>Preparation &amp; Details</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        to={`/book?service=${svc.slug}`}
                        className="text-[#0D4A5A] hover:underline"
                      >
                        Schedule
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </PublicLayout>
  );
}
