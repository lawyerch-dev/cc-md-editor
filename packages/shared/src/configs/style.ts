import type { HeadingStyles } from './style-data'
import {
  codeBlockThemeOptions,
  colorOptions,
  defaultHeadingStyles,
  fontFamilyOptions,
  fontSizeOptions,
  legendOptions,
} from './style-data'
import { themeOptions } from './theme'

export * from './style-data'

export const defaultStyleConfig = {
  isCiteStatus: false,
  isMacCodeBlock: true,
  isShowLineNumber: false,
  isCountStatus: false,
  theme: themeOptions[0].value,
  fontFamily: fontFamilyOptions[0].value,
  fontSize: fontSizeOptions[2].value,
  primaryColor: colorOptions[0].value,
  backgroundColor: `#ffffff`,
  backgroundPattern: `none`,
  codeBlockTheme: codeBlockThemeOptions[23].value,
  legend: legendOptions[3].value,
  headingStyles: defaultHeadingStyles as HeadingStyles,
}
