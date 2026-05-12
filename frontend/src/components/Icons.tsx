import type { SVGProps } from 'react'

type IP = SVGProps<SVGSVGElement>

export const IconSearch = (p: IP) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
)
export const IconHeart = (p: IP) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" {...p}>
    <path d="M12 21s-7.5-4.6-9.7-9.4C.7 7.7 3 3.5 7 3.5c2 0 3.7 1.2 5 3 1.3-1.8 3-3 5-3 4 0 6.3 4.2 4.7 8.1C19.5 16.4 12 21 12 21z" />
  </svg>
)
export const IconHeartOutline = (p: IP) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" width="18" height="18" {...p}>
    <path d="M12 21s-7.5-4.6-9.7-9.4C.7 7.7 3 3.5 7 3.5c2 0 3.7 1.2 5 3 1.3-1.8 3-3 5-3 4 0 6.3 4.2 4.7 8.1C19.5 16.4 12 21 12 21z" />
  </svg>
)
export const IconPlus = (p: IP) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IconPen = (p: IP) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
)
export const IconFilter = (p: IP) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M3 5h18M6 12h12M10 19h4" />
  </svg>
)
export const IconSun = (p: IP) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)
export const IconMoon = (p: IP) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
)
export const IconArrow = (p: IP) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
export const IconBack = (p: IP) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
)
export const IconBookOpen = (p: IP) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" {...p}>
    <path d="M12 6.5C10.5 5 8 4 4.5 4v14c3.5 0 6 1 7.5 2.5M12 6.5C13.5 5 16 4 19.5 4v14c-3.5 0-6 1-7.5 2.5M12 6.5v14" />
  </svg>
)
export const IconBuilding = (p: IP) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1" />
  </svg>
)
export const IconExternal = (p: IP) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M15 3h6v6M10 14 21 3M21 14v7H3V3h7" />
  </svg>
)
export const IconCheck = (p: IP) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
export const IconClose = (p: IP) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)
export const IconGrid = (p: IP) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" {...p}>
    <rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" />
    <rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" />
  </svg>
)
export const IconList = (p: IP) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)
export const IconMenu = (p: IP) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)
