import React from 'react';

export type LogoVariant =
  | 'primary'
  | 'secondary'
  | 'symbol'
  | 'app-icon'
  | 'bw'
  | 'monochrome';

interface LokmaLogoProps {
  variant?: LogoVariant;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  inverted?: boolean;
  showTagline?: boolean;
  className?: string;
}

const ChefHatSvg: React.FC<{ color: string; className?: string }> = ({
  color,
  className = 'w-6 h-5',
}) => (
  <svg
    viewBox="0 0 64 46"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M17 31C11 30 7 25 8 18.5C9 12.5 14.5 8.5 20.5 9.5C23 4.5 28.5 2 34 3C39.5 4 43.5 8.5 44.5 13.5C50 13 55.5 17 56 23C56.5 28.5 52 33 46 33.5L44 41.5C36 43 24 42.5 18 40L17 31Z"
      stroke={color}
      strokeWidth="3.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M18.5 34.5C26.5 36.5 37 37 45 35.5"
      stroke={color}
      strokeWidth="2.8"
      strokeLinecap="round"
    />
  </svg>
);

const SpoonCurveSvg: React.FC<{ color: string; className?: string }> = ({
  color,
  className = 'w-20 h-4',
}) => (
  <svg
    viewBox="0 0 180 34"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M12 14C48 25 102 26 144 17"
      stroke={color}
      strokeWidth="6.5"
      strokeLinecap="round"
    />
    <path
      d="M142 17C148 11 160 7 170 9.5C175 11 174 17 167 21C159 25 148 24 142 17Z"
      fill={color}
    />
    <path
      d="M150 14C155 12 162 11.5 166 13"
      stroke="#FFF7E6"
      strokeOpacity="0.6"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const LokmaSymbol: React.FC<{
  className?: string;
  primaryColor?: string;
  accentColor?: string;
}> = ({
  className = 'w-12 h-11',
  primaryColor = '#0B3D2E',
  accentColor = '#F7931E',
}) => (
  <svg
    viewBox="0 0 140 112"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="LOKMA Symbol"
  >
    {/* Radiating fresh energy dashes on left */}
    <path
      d="M14 40L24 44"
      stroke={accentColor}
      strokeWidth="4.2"
      strokeLinecap="round"
    />
    <path
      d="M19 30L27 37"
      stroke={accentColor}
      strokeWidth="4.2"
      strokeLinecap="round"
    />
    {/* Tilted chef hat above letter */}
    <g transform="translate(62 2) rotate(10)">
      <path
        d="M11 21C6.5 20 4 16 5 11.5C6 7.5 10 5 14.5 5.5C16.5 2 20.5 0.5 24.5 1.5C28.5 2.5 31 5.5 31.8 9C35.8 8.8 39.5 11.5 40 15.8C40.4 19.8 37.2 23 32.8 23.4L31.2 29C25.5 30.2 16.5 29.8 12 28L11 21Z"
        stroke={accentColor}
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 23.5C18.5 25 26 25.2 31.8 24.2"
        stroke={accentColor}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </g>
    {/* Crisp Arabic wordmark لقمة */}
    <text
      x="72"
      y="72"
      textAnchor="middle"
      fill={primaryColor}
      fontFamily="Cairo, system-ui, sans-serif"
      fontWeight="900"
      fontSize="43"
    >
      لقمة
    </text>
    {/* Curved orange spoon smile underneath */}
    <path
      d="M28 84C54 94 94 95 116 86"
      stroke={accentColor}
      strokeWidth="5.2"
      strokeLinecap="round"
    />
    <path
      d="M114 86C118.5 81.5 126.5 79.5 132.5 81.5C136 82.8 135 87.2 130.2 89.8C124.5 92.6 117.5 91.5 114 86Z"
      fill={accentColor}
    />
  </svg>
);

export const LokmaLogo: React.FC<LokmaLogoProps> = ({
  variant = 'primary',
  size = 'md',
  inverted = false,
  showTagline = false,
  className = '',
}) => {
  const isBW = variant === 'bw';
  const isMono = variant === 'monochrome';

  const primary = isBW
    ? inverted
      ? '#FFFFFF'
      : '#111111'
    : isMono
    ? inverted
      ? '#FFF7E6'
      : '#0B3D2E'
    : inverted
    ? '#FFF7E6'
    : '#0B3D2E';

  const accent = isBW
    ? inverted
      ? '#D4D4D4'
      : '#333333'
    : isMono
    ? primary
    : '#F7931E';

  const symbolDims =
    size === 'sm'
      ? 'w-12 h-10'
      : size === 'md'
      ? 'w-14 h-12'
      : size === 'lg'
      ? 'w-20 h-16'
      : 'w-24 h-20';

  if (variant === 'symbol') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        <LokmaSymbol
          className={symbolDims}
          primaryColor={primary}
          accentColor={accent}
        />
      </div>
    );
  }

  if (variant === 'app-icon') {
    const iconBox =
      size === 'sm'
        ? 'w-12 h-12 rounded-xl p-1.5'
        : size === 'md'
        ? 'w-16 h-16 rounded-2xl p-2'
        : size === 'lg'
        ? 'w-24 h-24 rounded-[26px] p-2.5'
        : 'w-28 h-28 rounded-[30px] p-3';

    const bgCls = inverted
      ? 'bg-[#FFF7E6] border border-[#0B3D2E]/12'
      : 'bg-[#0B3D2E]';
    const wordColor = inverted ? '#0B3D2E' : '#FFF7E6';

    return (
      <div
        className={`inline-flex items-center justify-center shadow-md ${bgCls} ${iconBox} ${className}`}
      >
        <LokmaSymbol
          className="w-full h-full"
          primaryColor={wordColor}
          accentColor="#F7931E"
        />
      </div>
    );
  }

  if (variant === 'secondary' || variant === 'bw' || variant === 'monochrome') {
    const arSize =
      size === 'sm'
        ? 'text-[1.9rem]'
        : size === 'lg'
        ? 'text-[3.1rem]'
        : size === 'xl'
        ? 'text-[3.8rem]'
        : 'text-[2.4rem]';
    const enSize =
      size === 'sm'
        ? 'text-sm'
        : size === 'lg'
        ? 'text-2xl'
        : size === 'xl'
        ? 'text-3xl'
        : 'text-lg';
    const hatSize =
      size === 'sm'
        ? 'w-7 h-5 -top-3.5'
        : size === 'lg'
        ? 'w-11 h-8 -top-5'
        : size === 'xl'
        ? 'w-14 h-10 -top-6'
        : 'w-9 h-7 -top-4';
    const spoonWidth =
      size === 'sm'
        ? 'w-20 h-3.5'
        : size === 'lg'
        ? 'w-32 h-5'
        : size === 'xl'
        ? 'w-40 h-6'
        : 'w-24 h-4';

    return (
      <div
        dir="ltr"
        className={`inline-flex flex-col items-center text-center select-none ${className}`}
      >
        <div className="relative inline-flex items-center justify-center pt-3">
          {/* Two orange motion dashes on the left */}
          <svg
            viewBox="0 0 22 22"
            fill="none"
            className="w-4 h-4 -me-1 -mt-3 shrink-0"
            aria-hidden="true"
          >
            <path d="M3 12L15 15" stroke={accent} strokeWidth="3.4" strokeLinecap="round" />
            <path d="M7 4L16 10" stroke={accent} strokeWidth="3.4" strokeLinecap="round" />
          </svg>

          <div className="relative inline-flex flex-col items-center">
            <div className={`absolute right-1 rotate-12 pointer-events-none ${hatSize}`}>
              <ChefHatSvg color={accent} className="w-full h-full" />
            </div>
            <span
              className={`font-black leading-[0.95] tracking-tight ${arSize}`}
              style={{ color: primary }}
            >
              لقمة
            </span>
          </div>
        </div>

        <SpoonCurveSvg color={accent} className={`${spoonWidth} -mt-0.5`} />

        <div
          className={`font-extrabold leading-none tracking-tight mt-0.5 ${enSize}`}
          style={{ color: primary }}
        >
          Lokma
        </div>

        {showTagline && (
          <div className="mt-2 inline-flex items-center gap-2 text-[11px] sm:text-xs font-bold">
            <span className="w-5 h-0.5 rounded-full" style={{ backgroundColor: accent }} />
            <span style={{ color: primary }}>أكل بيتك .. في أي مكان</span>
            <span className="w-5 h-0.5 rounded-full" style={{ backgroundColor: accent }} />
          </div>
        )}
      </div>
    );
  }

  // Primary horizontal lockup for Navbar & Footer
  const emblemDims =
    size === 'sm'
      ? 'w-12 h-10'
      : size === 'lg'
      ? 'w-16 h-13'
      : 'w-14 h-11';
  const wordSize =
    size === 'sm'
      ? 'text-[1.1rem]'
      : size === 'lg'
      ? 'text-2xl'
      : 'text-xl';

  return (
    <div
      dir="ltr"
      className={`inline-flex items-center gap-2 select-none shrink-0 ${className}`}
    >
      <LokmaSymbol
        className={emblemDims}
        primaryColor={primary}
        accentColor={accent}
      />
      <div className="flex flex-col leading-none">
        <span
          className={`font-extrabold tracking-tight leading-none ${wordSize}`}
          style={{ color: primary }}
        >
          Lokma
        </span>
      </div>
    </div>
  );
};
