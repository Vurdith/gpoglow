export default function SlotIcon({ slot, className = '', size = 24 }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {renderSlotGlyph(slot)}
    </svg>
  )
}

function renderSlotGlyph(slot) {
  switch (slot) {
    case 'Head':
      return (
        <>
          <path d="M4 17.5h16" />
          <path d="M5 17.5L6.5 7l5.5 4 5.5-4L19 17.5" />
        </>
      )
    case 'Face':
      return (
        <>
          <path d="M6.5 8.5c1.2-2.2 3.1-3.3 5.5-3.3s4.3 1.1 5.5 3.3v6.6c-1.2 2.2-3.1 3.3-5.5 3.3s-4.3-1.1-5.5-3.3z" />
          <path d="M9 11h.01" />
          <path d="M15 11h.01" />
          <path d="M9.5 14.5c1.4.7 3.6.7 5 0" />
        </>
      )
    case 'Forehead':
      return (
        <>
          <path d="M12 4.5l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" />
          <path d="M18.5 4.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" />
        </>
      )
    case 'Ear':
      return (
        <>
          <path d="M9.5 6.5a4.5 4.5 0 018.3 2.4c0 2.1-1 3.6-2.5 4.8-1 .8-1.6 1.4-1.6 2.7v.4" />
          <path d="M10.2 10.2c0-1.7 1.3-3 3-3 1.4 0 2.6 1 2.9 2.3" />
          <path d="M12.8 19.2h.01" />
        </>
      )
    case 'Neck':
      return (
        <>
          <path d="M7 6.5c1.2 2.6 2.9 4 5 4s3.8-1.4 5-4" />
          <path d="M12 10.5v7" />
          <path d="M9.5 17.5L12 20l2.5-2.5L12 15z" />
        </>
      )
    case 'All Seeing Eye':
      return (
        <>
          <path d="M2.8 12s3.2-5.5 9.2-5.5S21.2 12 21.2 12 18 17.5 12 17.5 2.8 12 2.8 12z" />
          <circle cx="12" cy="12" r="2.4" />
        </>
      )
    case 'Armor':
      return (
        <>
          <path d="M12 3.8l6 2.2v5.5c0 4.1-2.4 6.9-6 8.7-3.6-1.8-6-4.6-6-8.7V6z" />
          <path d="M9 9.5h6" />
          <path d="M12 9.5v6" />
        </>
      )
    case 'Back':
      return (
        <>
          <path d="M8 4.5h8v4l-2 1.8V19l-2-1.3L10 19v-8.7L8 8.5z" />
          <path d="M10 8.5h4" />
        </>
      )
    case 'Shoulder':
      return (
        <>
          <path d="M5 11c1.2-2.3 3.2-3.5 6-3.5h2c2.8 0 4.8 1.2 6 3.5" />
          <path d="M4.5 16.5L7 11h3l-1.8 5.5z" />
          <path d="M19.5 16.5L17 11h-3l1.8 5.5z" />
        </>
      )
    case 'Waist':
      return (
        <>
          <rect x="4.5" y="9" width="15" height="6" rx="2" />
          <rect x="10" y="9.8" width="4" height="4.4" rx="1" />
        </>
      )
    case 'Misc':
    default:
      return (
        <>
          <path d="M12 4.2l3.4 4.4L20 12l-4.6 3.4L12 19.8l-3.4-4.4L4 12l4.6-3.4z" />
          <path d="M12 8.8v6.4" />
          <path d="M8.8 12H15.2" />
        </>
      )
  }
}
