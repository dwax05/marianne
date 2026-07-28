import type { Palette } from './types'

/** Export every swatch as a uniquely named CSS custom property. */
export function paletteToCss(palette: Palette): string {
  const roleCounts = new Map<string, number>()
  const declarations = palette.map((swatch, index) => {
    const baseName =
      swatch.role === 'unset' ? `${index + 1}` : swatch.role
    const count = (roleCounts.get(baseName) ?? 0) + 1
    roleCounts.set(baseName, count)
    const suffix = count > 1 ? `-${count}` : ''
    return `  --color-${baseName}${suffix}: ${swatch.hex};`
  })
  return `:root {\n${declarations.join('\n')}\n}`
}
