import React, { useEffect, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';

interface MealArtworkProps {
  slug?: string;
  alt: string;
  className?: string;
  lang?: 'ar' | 'en';
}

export const MealArtwork: React.FC<MealArtworkProps> = ({
  slug = '',
  alt,
  className = 'w-full h-44',
  lang,
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [slug]);

  const resolvedLang: 'ar' | 'en' =
    lang ?? (typeof document !== 'undefined' && document.documentElement.dir === 'ltr' ? 'en' : 'ar');

  const hasRealImage =
    !failed &&
    Boolean(slug) &&
    (slug.startsWith('data:image/') || slug.startsWith('https://'));

  if (hasRealImage) {
    return (
      <div className={`relative overflow-hidden bg-[#FBF0D9] ${className}`}>
        <img
          src={slug}
          alt={alt}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden flex flex-col items-center justify-center bg-[#FBF0D9] border-b border-[#0B3D2E]/10 text-[#4E6359] select-none ${className}`}
      role="img"
      aria-label={alt}
    >
      <div className="w-11 h-11 rounded-2xl bg-white border border-[#0B3D2E]/12 flex items-center justify-center text-[#0B3D2E]/70 mb-1.5">
        <UtensilsCrossed className="w-5 h-5" />
      </div>
      <span className="text-[11px] font-semibold text-[#4E6359]">
        {resolvedLang === 'ar' ? 'لا توجد صورة مرفوعة' : 'No meal photo uploaded'}
      </span>
    </div>
  );
};
