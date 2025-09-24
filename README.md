# WCAG 2.2 AA Color Contrast Utility

A TypeScript utility for enforcing WCAG 2.2 AA color contrast requirements with deterministic color adjustment capabilities.

## Features

- **WCAG 2.2 AA Compliance**: Enforces 4.5:1 for normal text, 3:1 for large text and UI components
- **Deterministic Color Snapping**: Uses binary search to find minimal adjustments that meet contrast requirements
- **Robust Hex Parsing**: Supports both 3-digit (#RGB) and 6-digit (#RRGGBB) hex formats
- **Precision Handling**: Uses epsilon comparisons for floating-point precision
- **Focus Indicator Support**: Special handling for UI component contrast requirements

## Installation

```bash
npm install
```

## Usage

```typescript
import { 
  relativeLuminance, 
  contrastRatio, 
  passesContrast, 
  snapToPassingColor,
  isLargeTextFromCSS
} from './src/a11y/contrast.js';

// Check if colors meet contrast requirements
const passes = passesContrast('#777777', '#FFFFFF'); // false for normal text
const passesLarge = passesContrast('#777777', '#FFFFFF', { isLargeText: true }); // true

// Calculate contrast ratio
const ratio = contrastRatio('#000000', '#FFFFFF'); // 21:1

// Determine large text from CSS properties
const isLarge = isLargeTextFromCSS(24, 400); // true (24px regular text)
const isLargeBold = isLargeTextFromCSS(18, 600); // true (18px bold text)

// Snap failing colors to passing colors
const result = snapToPassingColor('#888888', '#FFFFFF');
console.log(result.fg); // Adjusted foreground color
console.log(result.bg); // Background color (unchanged)
console.log(result.ratio); // Final contrast ratio
console.log(result.clamped); // true if no path could meet threshold
```

## API Reference

### `relativeLuminance(color: RGB | string): number`
Calculates the relative luminance of a color according to WCAG guidelines.

### `contrastRatio(fgHex: string, bgHex: string): number`
Calculates the contrast ratio between two colors (1-21).

### `passesContrast(fgHex: string, bgHex: string, opts?: ContrastOptions): boolean`
Determines if a color pair passes WCAG 2.2 AA requirements.

**Options:**
- `isLargeText?: boolean` - Use 3:1 threshold for large text (≥18pt or ≥14pt bold)
- `uiComponent?: boolean` - Use 3:1 threshold for UI components (borders, icons, focus indicators)

### `snapToPassingColor(fgHex: string, bgHex: string, opts?: SnapOptions): SnapResult`
Minimally adjusts colors to meet contrast requirements using deterministic binary search.

**Options:**
- `isLargeText?: boolean` - Use 3:1 threshold
- `uiComponent?: boolean` - Use 3:1 threshold
- `lockHue?: boolean` - Prevent hue adjustments (future enhancement)
- `lockChroma?: boolean` - Prevent saturation adjustments (future enhancement)

**Returns:**
- `fg: string` - Adjusted foreground color
- `bg: string` - Adjusted background color
- `ratio: number` - Final contrast ratio
- `clamped?: boolean` - True if no path could meet threshold

### `isLargeTextFromCSS(fontSizePx: number, fontWeight?: number): boolean`
Helper function to determine if text should be considered "large text" per WCAG 2.2.

**Parameters:**
- `fontSizePx: number` - Font size in pixels
- `fontWeight?: number` - Font weight (400 = normal, 600+ = bold, defaults to 400)

**Returns:** True if text qualifies as large text (≥24px regular or ≥18.66px bold)

## Testing

```bash
npm test
```

The test suite covers:
- Known WCAG test cases
- Edge cases near thresholds
- Deterministic behavior
- Hex format validation
- Error handling

## Roadmap

### Future Enhancements

- **Perceptual Color Distance**: Replace ΔL with ΔE (Lab color space) for more accurate perceptual minimal-change selection
- **Color Space Support**: Add support for P3, Rec2020, and other wide-gamut color spaces
- **Batch Processing**: Optimize for theme-wide contrast validation with caching
- **Visual Diff**: Generate before/after color swatches for QA workflows
- **Advanced Tie-breaking**: Implement ΔE-based similarity threshold for Lab color space accuracy

### Current Limitations

- Uses HSL lightness adjustment only (hue/chroma locked by default)
- Limited to sRGB color space
- Binary search convergence limited to 7 iterations

## WCAG 2.2 AA Compliance

This utility enforces the following WCAG 2.2 AA success criteria:

- **1.4.3 Contrast (Minimum)**: 4.5:1 for normal text
- **1.4.3 Contrast (Minimum)**: 3:1 for large text (≥18pt or ≥14pt bold)
- **2.4.7 Focus Visible**: 3:1 minimum for focus indicators

### References

- [WCAG 2.2 SC 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [Understanding SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)
- [MDN Color Contrast](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Understanding_WCAG/Perceivable/Color_contrast)

## UI Component Contrast

For non-text UI elements (icons, borders, focus indicators, decorative elements), use the `uiComponent` flag to enforce the 3:1 minimum contrast requirement per WCAG 2.2:

```typescript
// Check icon contrast against background
const iconPasses = passesContrast('#CCCCCC', '#FFFFFF', { uiComponent: true });

// Validate focus ring contrast
const focusPasses = passesContrast('#FF0000', '#FFFFFF', { uiComponent: true });

// Snap UI element colors to meet requirements
const uiResult = snapToPassingColor('#DDDDDD', '#FFFFFF', { uiComponent: true });
```

**Important**: The `uiComponent` flag applies the 3:1 threshold, which is appropriate for:
- Focus indicators and outlines
- Icon graphics and symbols
- Border elements
- Decorative UI components
- Interactive element boundaries

This ensures consistent accessibility standards across all UI elements, not just text content.

## Focus Indicator Usage

Focus indicators are a specific type of UI component that require 3:1 minimum contrast. See the [UI Component Contrast](#ui-component-contrast) section above for implementation details and examples.

## Hex Color Support

The utility supports both hex formats:
- 6-digit: `#RRGGBB` (e.g., `#FF0000`)
- 3-digit: `#RGB` (e.g., `#F00`)

Invalid formats will throw descriptive errors.

## Deterministic Behavior

The `snapToPassingColor` function uses binary search and is fully deterministic:
- Same inputs always produce identical outputs
- No random adjustments
- Minimal perceptual change selection
- Bounded convergence (≤7 iterations)

## Error Handling

The utility provides clear error messages for invalid inputs:
- Invalid hex formats
- Malformed color strings
- Edge cases are handled gracefully

## License

MIT
