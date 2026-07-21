import type { HeadingStylesInput, LegendValue } from '@md/shared/configs/style-data'
import {
  codeBlockThemeOptions,
  colorOptions,
  fontFamilyOptions,
  fontSizeOptions,
  legendOptions,
} from '@md/shared/configs/style-data'

export { type HeadingStylesInput, type LegendValue }

export const themeOptions = [
  { value: `default`, label: `经典`, desc: `` },
  { value: `grace`, label: `优雅`, desc: `@brzhang` },
  { value: `simple`, label: `简洁`, desc: `@okooo5km` },
  { value: `ink`, label: `黑印`, desc: `浓墨重彩，传统印刷` },
  { value: `newspaper`, label: `报刊`, desc: `报刊排版，粗黑分明` },
] as const

const allowedCodeBlockThemeUrls: Record<string, true> = Object.fromEntries(
  codeBlockThemeOptions.map(option => [option.value, true] as const),
)

export function assertAllowedCodeBlockThemeUrl(url: string): void {
  if (!(url in allowedCodeBlockThemeUrls)) {
    throw new Error(
      `codeBlockTheme must be a preset URL from list_code_block_themes. Received: ${url}`,
    )
  }
}

export const defaultRenderOptions = {
  theme: `default` as const,
  primaryColor: colorOptions[0].value,
  fontFamily: fontFamilyOptions[0].value,
  fontSize: fontSizeOptions[2].value,
  legend: legendOptions[3].value as LegendValue,
  codeBlockTheme: codeBlockThemeOptions[0].value,
  isMacCodeBlock: false,
  isShowLineNumber: false,
  citeStatus: false,
  countStatus: false,
  themeMode: `light` as const,
  isUseIndent: false,
  isUseJustify: false,
}
