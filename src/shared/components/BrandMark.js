"use client";

import { useId } from "react";
import PropTypes from "prop-types";

// Product logo: a flag on a mast over the signal gradient.
export default function BrandMark({ className = "size-9", title }) {
  const gradientId = `brand-mark-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 40 40" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={gradientId} x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4F6BFF" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${gradientId})`} />
      <path d="M13.5 30.5V9.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M15 10.5h12.6c.95 0 1.45 1.1.83 1.82L25.1 16.4l3.33 4.08c.62.72.12 1.82-.83 1.82H15z" fill="#fff" />
      <circle cx="13.5" cy="30.5" r="2.2" fill="#fff" fillOpacity=".55" />
    </svg>
  );
}

BrandMark.propTypes = {
  className: PropTypes.string,
  title: PropTypes.string,
};
