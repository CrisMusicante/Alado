/** The song's key as a small chip; renders nothing when the song has no key. */
export default function KeyBadge({ songKey, className = '' }: { songKey?: string | null; className?: string }) {
  if (!songKey) return null
  return (
    <span
      title={`Tono: ${songKey}`}
      className={`shrink-0 inline-block px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-xs font-semibold font-mono leading-none ${className}`}
    >
      {songKey}
    </span>
  )
}
