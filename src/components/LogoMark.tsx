/** Minimal monochrome mountain mark. Slate via currentColor. */
export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M3.5 24.5 16 6.5l12.5 18H3.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M10 24.5 16 14l6 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M16 3.5v3.2M16 9.8v1.4M12.6 7.2l1.3 1.3M18.1 8.5l1.3-1.3M12.6 11.6l1.3-1.3M18.1 10.3l1.3 1.3"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}
