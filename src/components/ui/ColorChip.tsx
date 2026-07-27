/**
 * A small color square with the app's standard hairline border. Size is set by
 * the caller via `className` (e.g. `h-6 w-6`) so Tailwind can see the classes.
 * Defaults its tooltip to the hex value.
 */
export function ColorChip({
  hex,
  className = '',
  title,
}: {
  hex: string
  className?: string
  title?: string
}) {
  return (
    <span
      className={`inline-block rounded border border-white/10 ${className}`}
      style={{ background: hex }}
      title={title ?? hex}
    />
  )
}
