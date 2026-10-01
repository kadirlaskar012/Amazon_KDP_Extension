// src/components/Logo.tsx
import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  showBadge?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  size = 32,
  className = '',
  showBadge = false,
}) => {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-md"
      >
        <defs>
          {/* Base Background Gradient */}
          <linearGradient id="logoBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="45%" stopColor="#1E1B4B" />
            <stop offset="100%" stopColor="#0B0F19" />
          </linearGradient>

          {/* Premium Metallic Rim */}
          <linearGradient id="logoRim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818CF8" />
            <stop offset="25%" stopColor="#C084FC" />
            <stop offset="60%" stopColor="#F43F5E" />
            <stop offset="100%" stopColor="#FBBF24" />
          </linearGradient>

          {/* Left Wing Indigo */}
          <linearGradient id="logoLeftWing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#3730A3" />
          </linearGradient>

          {/* Right Wing Purple */}
          <linearGradient id="logoRightWing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#6B21A8" />
          </linearGradient>

          {/* Inner Pages */}
          <linearGradient id="logoPageLeft" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#818CF8" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>

          <linearGradient id="logoPageRight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#C084FC" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>

          {/* Golden Radiant Accent */}
          <linearGradient id="logoGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>

          {/* Cyan Glow */}
          <linearGradient id="logoCyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>

          {/* Growth Bars */}
          <linearGradient id="logoBar1" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#818CF8" />
          </linearGradient>
          <linearGradient id="logoBar2" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#818CF8" />
            <stop offset="100%" stopColor="#C084FC" />
          </linearGradient>
          <linearGradient id="logoBar3" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#F43F5E" />
            <stop offset="100%" stopColor="#FBBF24" />
          </linearGradient>

          <filter id="logoShadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="12" stdDeviation="16" floodColor="#000000" floodOpacity="0.45" />
          </filter>

          <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#F59E0B" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* Base Squircle */}
        <rect x="28" y="28" width="456" height="456" rx="112" fill="url(#logoBg)" filter="url(#logoShadow)" />
        <rect x="28" y="28" width="456" height="456" rx="112" stroke="url(#logoRim)" strokeWidth="12" strokeOpacity="0.9" />

        {/* Ambient Aura */}
        <circle cx="256" cy="230" r="160" fill="#6366F1" fillOpacity="0.15" />
        <circle cx="256" cy="150" r="100" fill="#F59E0B" fillOpacity="0.15" />

        {/* Top Arc Sheen */}
        <path d="M72 136 C110 76 180 44 256 44 C332 44 402 76 440 136 C376 112 316 100 256 100 C196 100 136 112 72 136 Z" fill="#FFFFFF" fillOpacity="0.07" />

        {/* Research Orbit Ring */}
        <ellipse cx="256" cy="275" rx="180" ry="52" stroke="url(#logoCyan)" strokeWidth="4.5" strokeDasharray="14 10" strokeOpacity="0.5" transform="rotate(-18 256 275)" />

        {/* Growth Analytics Bars Behind Book */}
        <g filter="url(#logoShadow)">
          <rect x="184" y="205" width="34" height="75" rx="8" fill="url(#logoBar1)" />
          <rect x="239" y="160" width="34" height="120" rx="8" fill="url(#logoBar2)" />
          <rect x="294" y="125" width="34" height="155" rx="8" fill="url(#logoBar3)" />
          <circle cx="201" cy="213" r="5" fill="#FFFFFF" fillOpacity="0.8" />
          <circle cx="256" cy="168" r="5" fill="#FFFFFF" fillOpacity="0.8" />
          <circle cx="311" cy="133" r="5" fill="#FFFFFF" fillOpacity="0.8" />
        </g>

        {/* Background page shadows */}
        <path d="M256 372 C210 348 140 346 92 364 C83 367 74 360 74 350 V245 C74 236 82 229 91 226 C143 209 211 216 256 242 Z" fill="#1E1B4B" fillOpacity="0.7" />
        <path d="M256 372 C302 348 372 346 420 364 C429 367 438 360 438 350 V245 C438 236 430 229 421 226 C369 209 301 216 256 242 Z" fill="#2E1065" fillOpacity="0.7" />

        {/* Middle Pages */}
        <path d="M256 360 C212 338 148 336 102 352 C94 355 86 348 86 339 V232 C86 224 93 218 101 215 C150 198 214 205 256 230 Z" fill="url(#logoPageLeft)" />
        <path d="M256 360 C300 338 364 336 410 352 C418 355 426 348 426 339 V232 C426 224 419 218 411 215 C362 198 298 205 256 230 Z" fill="url(#logoPageRight)" />

        {/* Front Cover Wings */}
        <path d="M256 348 C215 328 156 326 112 340 C104 343 96 336 96 328 V220 C96 212 103 206 111 204 C158 188 217 195 256 218 Z" fill="url(#logoLeftWing)" />
        <path d="M256 348 C297 328 356 326 400 340 C408 343 416 336 416 328 V220 C416 212 409 206 401 204 C354 188 295 195 256 218 Z" fill="url(#logoRightWing)" />

        {/* Spine */}
        <path d="M256 218 L256 352" stroke="#1E1B4B" strokeWidth="4" strokeLinecap="round" />

        {/* Gold Ribbon */}
        <path d="M246 222 L266 222 L266 382 L256 370 L246 382 Z" fill="url(#logoGold)" filter="url(#logoGlow)" />

        {/* Content text lines on pages */}
        <path d="M132 236 C168 226 208 230 236 244" stroke="#A5B4FC" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.75" />
        <path d="M132 260 C168 250 208 254 236 268" stroke="#A5B4FC" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.65" />
        <path d="M132 284 C168 274 208 278 236 292" stroke="#A5B4FC" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.55" />

        <path d="M380 236 C344 226 304 230 276 244" stroke="#E9D5FF" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.75" />
        <path d="M380 260 C344 250 304 254 276 268" stroke="#E9D5FF" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.65" />
        <path d="M380 284 C344 274 304 278 276 292" stroke="#E9D5FF" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.55" />

        {/* Bestseller Golden Crown Star */}
        <g filter="url(#logoGlow)">
          <path d="M256 76 Q256 112 280 112 Q256 112 256 148 Q256 112 232 112 Q256 112 256 76 Z" fill="url(#logoGold)" />
          <rect x="251" y="107" width="10" height="10" transform="rotate(45 256 112)" fill="#FFFFFF" />
          <path d="M242 98 L270 126 M270 98 L242 126" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Niche Gems Sparkles */}
        <path d="M120 120 Q120 134 130 134 Q120 134 120 148 Q120 134 110 134 Q120 134 120 120 Z" fill="#38BDF8" />
        <path d="M392 116 Q392 128 402 128 Q392 128 392 140 Q392 128 382 128 Q392 128 392 116 Z" fill="#FBBF24" />

        {/* PRO Badge */}
        <g transform="translate(322, 386)">
          <rect width="112" height="42" rx="21" fill="url(#logoGold)" />
          <rect x="2" y="2" width="108" height="38" rx="19" fill="#0F172A" />
          <text x="56" y="26" fill="url(#logoGold)" fontFamily="system-ui, -apple-system, sans-serif" fontSize="19" fontWeight="900" letterSpacing="3" textAnchor="middle">PRO</text>
        </g>
      </svg>
      {showBadge && (
        <span className="absolute -bottom-1 -right-1 text-[8px] font-black uppercase px-1 py-0.2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs">
          PRO
        </span>
      )}
    </div>
  );
};
