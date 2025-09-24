/**
 * WCAG 2.2 AA Color Contrast Utility
 * 
 * Provides functions for calculating color contrast ratios and ensuring accessibility compliance
 * according to WCAG 2.2 AA standards.
 * 
 * References:
 * - WCAG 2.2 SC 1.4.3 Contrast (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
 * - WCAG 2.2 Quick Reference: https://www.w3.org/WAI/WCAG22/quickref/
 * - WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
 * - MDN Color Contrast: https://developer.mozilla.org/en-US/docs/Web/Accessibility/Understanding_WCAG/Perceivable/Color_contrast
 * 
 * Thresholds:
 * - Normal text: 4.5:1
 * - Large text (≥18pt or ≥14pt bold): 3:1
 * - Essential UI components: 3:1
 */

// Constants for precision handling
const EPSILON = 1e-3; // For floating point comparisons
const NORMAL_TEXT_THRESHOLD = 4.5;
const LARGE_TEXT_THRESHOLD = 3.0;

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface ContrastOptions {
  isLargeText?: boolean;
  uiComponent?: boolean;
}

export interface SnapOptions extends ContrastOptions {
  lockHue?: boolean;
  lockChroma?: boolean;
  preferForegroundAdjust?: boolean;
  preferBackgroundAdjust?: boolean;
}

export interface SnapResult {
  fg: string;
  bg: string;
  ratio: number;
  clamped?: boolean; // True if no path could meet threshold
  adjusted?: 'fg' | 'bg'; // Which color was adjusted
  iterations?: number; // Total iterations used in binary search
}

/**
 * Converts hex color string to RGB object with validation
 * Supports 6-digit (#RRGGBB) and 3-digit (#RGB) hex formats
 */
function hexToRgb(hex: string): RGB {
  const cleanHex = hex.replace('#', '').toUpperCase();
  
  // Validate hex format
  if (!/^[0-9A-F]{3}$|^[0-9A-F]{6}$/.test(cleanHex)) {
    throw new Error(`Invalid hex color format: ${hex}. Expected #RGB or #RRGGBB format.`);
  }
  
  let r: number, g: number, b: number;
  
  if (cleanHex.length === 3) {
    // 3-digit hex (#RGB) - expand to 6-digit
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else {
    // 6-digit hex (#RRGGBB)
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  }
  
  return { r, g, b };
}

/**
 * Converts RGB object to hex string
 */
function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Calculates the relative luminance of a color according to WCAG guidelines
 * 
 * Implements the sRGB gamma correction formula from WCAG 2.2:
 * https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html#contrast-ratio
 * 
 * @param color RGB object or hex string
 * @returns Relative luminance value between 0 and 1
 */
export function relativeLuminance(color: RGB | string): number {
  const rgb = typeof color === 'string' ? hexToRgb(color) : color;
  
  // Convert to sRGB values (0-1)
  const rsRGB = rgb.r / 255;
  const gsRGB = rgb.g / 255;
  const bsRGB = rgb.b / 255;
  
  // Apply gamma correction
  const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);
  
  // Calculate relative luminance
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculates the contrast ratio between two colors
 * @param fgHex Foreground color as hex string
 * @param bgHex Background color as hex string
 * @returns Contrast ratio (1-21)
 */
export function contrastRatio(fgHex: string, bgHex: string): number {
  const fgLuminance = relativeLuminance(fgHex);
  const bgLuminance = relativeLuminance(bgHex);
  
  const lighter = Math.max(fgLuminance, bgLuminance);
  const darker = Math.min(fgLuminance, bgLuminance);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determines if a color pair passes WCAG 2.2 AA contrast requirements
 * 
 * Large text definition per WCAG 2.2 Understanding SC 1.4.3:
 * - ≥18pt (≈24px) regular text
 * - ≥14pt (≈18.66px) bold text
 * UI layer should set isLargeText accordingly based on actual font size/weight.
 * 
 * @param fgHex Foreground color as hex string
 * @param bgHex Background color as hex string
 * @param opts Options for text size and component type
 * @returns True if contrast meets requirements
 */
export function passesContrast(fgHex: string, bgHex: string, opts: ContrastOptions = {}): boolean {
  const ratio = contrastRatio(fgHex, bgHex);
  
  // Determine required threshold
  let threshold = NORMAL_TEXT_THRESHOLD; // Normal text default
  
  if (opts.isLargeText || opts.uiComponent) {
    threshold = LARGE_TEXT_THRESHOLD;
  }
  
  // Use epsilon comparison for floating point precision
  return ratio >= (threshold - EPSILON);
}

/**
 * Converts RGB to HSL for perceptual color adjustments
 */
function rgbToHsl(rgb: RGB): { h: number; s: number; l: number } {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (diff !== 0) {
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);
    
    switch (max) {
      case r: h = (g - b) / diff + (g < b ? 6 : 0); break;
      case g: h = (b - r) / diff + 2; break;
      case b: h = (r - g) / diff + 4; break;
    }
    h /= 6;
  }
  
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Converts HSL to RGB
 */
function hslToRgb(hsl: { h: number; s: number; l: number }): RGB {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;
  
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

/**
 * Binary search to find optimal lightness adjustment
 */
function binarySearchLightness(
  originalHsl: { h: number; s: number; l: number },
  otherRgb: RGB,
  threshold: number,
  isForeground: boolean,
  isLightening: boolean,
  maxIterations: number = 7
): { rgb: RGB; ratio: number; iterations: number } {
  let minL = isLightening ? originalHsl.l : 0;
  let maxL = isLightening ? 100 : originalHsl.l;
  let bestRgb = hslToRgb(originalHsl);
  let bestRatio = contrastRatio(rgbToHex(bestRgb), rgbToHex(otherRgb));
  let iterations = 0;
  
  for (let i = 0; i < maxIterations; i++) {
    iterations++;
    const midL = (minL + maxL) / 2;
    const testHsl = { ...originalHsl, l: midL };
    const testRgb = hslToRgb(testHsl);
    
    const fgRgb = isForeground ? testRgb : otherRgb;
    const bgRgb = isForeground ? otherRgb : testRgb;
    const testRatio = contrastRatio(rgbToHex(fgRgb), rgbToHex(bgRgb));
    
    if (testRatio >= threshold) {
      bestRgb = testRgb;
      bestRatio = testRatio;
      if (isLightening) {
        maxL = midL;
      } else {
        minL = midL;
      }
    } else {
      if (isLightening) {
        minL = midL;
      } else {
        maxL = midL;
      }
    }
    
    // Early termination if we're close enough
    if (Math.abs(maxL - minL) < 0.1) break;
  }
  
  return { rgb: bestRgb, ratio: bestRatio, iterations };
}

/**
 * Minimally adjusts colors to meet contrast requirements using deterministic binary search
 * 
 * Implements WCAG 2.2 SC 1.4.3 (Contrast Minimum) with deterministic tie-breaking.
 * When multiple adjustment paths achieve similar minimal change, preference flags
 * determine the selection order.
 * 
 * @param fgHex Foreground color as hex string
 * @param bgHex Background color as hex string
 * @param opts Options for adjustment behavior and preferences
 * @returns Object with adjusted colors, final contrast ratio, and metadata
 */
export function snapToPassingColor(
  fgHex: string, 
  bgHex: string, 
  opts: SnapOptions = {}
): SnapResult {
  let fgRgb = hexToRgb(fgHex);
  let bgRgb = hexToRgb(bgHex);
  
  // Determine required threshold
  let threshold = NORMAL_TEXT_THRESHOLD;
  if (opts.isLargeText || opts.uiComponent) {
    threshold = LARGE_TEXT_THRESHOLD;
  }
  
  // Check if already passing
  let currentRatio = contrastRatio(rgbToHex(fgRgb), rgbToHex(bgRgb));
  if (currentRatio >= (threshold - EPSILON)) {
    return {
      fg: rgbToHex(fgRgb),
      bg: rgbToHex(bgRgb),
      ratio: currentRatio
    };
  }
  
  // Special case: identical colors can never meet threshold > 1
  if (currentRatio === 1 && threshold > 1) {
    return {
      fg: rgbToHex(fgRgb),
      bg: rgbToHex(bgRgb),
      ratio: currentRatio,
      clamped: true
    };
  }
  
  const fgHsl = rgbToHsl(fgRgb);
  const bgHsl = rgbToHsl(bgRgb);
  
  // Try all four adjustment paths and pick the one with minimal change
  const candidates = [
    // Path A: Lighten foreground
    { ...binarySearchLightness(fgHsl, bgRgb, threshold, true, true), path: 'fg-lighten' as const },
    // Path B: Darken foreground  
    { ...binarySearchLightness(fgHsl, bgRgb, threshold, true, false), path: 'fg-darken' as const },
    // Path C: Darken background
    { ...binarySearchLightness(bgHsl, fgRgb, threshold, false, false), path: 'bg-darken' as const },
    // Path D: Lighten background
    { ...binarySearchLightness(bgHsl, fgRgb, threshold, false, true), path: 'bg-lighten' as const }
  ];
  
  // Find candidates that meet threshold
  const passingCandidates = candidates.filter(c => c.ratio >= (threshold - EPSILON));
  
  let bestCandidate: typeof candidates[0];
  let clamped = false;
  
  if (passingCandidates.length > 0) {
    // Calculate perceptual change (ΔL) for each candidate
    const candidatesWithChange = passingCandidates.map(candidate => {
      const change = candidate.path.startsWith('fg') 
        ? Math.abs(fgHsl.l - rgbToHsl(candidate.rgb).l)
        : Math.abs(bgHsl.l - rgbToHsl(candidate.rgb).l);
      return { ...candidate, change };
    });
    
    // Sort by minimal change
    candidatesWithChange.sort((a, b) => a.change - b.change);
    
    // Find candidates with similar minimal change (within 0.5 L units)
    // Engineering heuristic: 0.5 L units represents ~2.5% lightness change,
    // below which perceptual difference is negligible for tie-breaking purposes.
    // Future enhancement: Replace with ΔE-based criterion for Lab color space accuracy.
    const minChange = candidatesWithChange[0].change;
    const similarCandidates = candidatesWithChange.filter(c => 
      Math.abs(c.change - minChange) <= 0.5
    );
    
    // Apply tie-breaking logic
    if (similarCandidates.length > 1) {
      // Check preference flags
      if (opts.preferForegroundAdjust && !opts.preferBackgroundAdjust) {
        bestCandidate = similarCandidates.find(c => c.path.startsWith('fg')) || similarCandidates[0];
      } else if (opts.preferBackgroundAdjust && !opts.preferForegroundAdjust) {
        bestCandidate = similarCandidates.find(c => c.path.startsWith('bg')) || similarCandidates[0];
      } else {
        // Default: prefer foreground adjustment
        bestCandidate = similarCandidates.find(c => c.path.startsWith('fg')) || similarCandidates[0];
      }
    } else {
      bestCandidate = similarCandidates[0];
    }
  } else {
    // No path meets threshold - choose best achievable ratio
    bestCandidate = candidates.reduce((best, current) => 
      current.ratio > best.ratio ? current : best
    );
    clamped = true;
  }
  
  // Apply the best adjustment
  let adjusted: 'fg' | 'bg' | undefined;
  if (bestCandidate.path.startsWith('fg')) {
    fgRgb = bestCandidate.rgb;
    adjusted = 'fg';
  } else {
    bgRgb = bestCandidate.rgb;
    adjusted = 'bg';
  }
  
  const finalRatio = contrastRatio(rgbToHex(fgRgb), rgbToHex(bgRgb));
  
  return {
    fg: rgbToHex(fgRgb),
    bg: rgbToHex(bgRgb),
    ratio: finalRatio,
    clamped,
    adjusted,
    iterations: bestCandidate.iterations
  };
}

/**
 * Helper function to determine if text should be considered "large text" per WCAG 2.2
 * 
 * Large text definition per WCAG 2.2 Understanding SC 1.4.3:
 * - ≥18pt (≈24px) regular text
 * - ≥14pt (≈18.66px) bold text (font-weight ≥ 600)
 * 
 * @param fontSizePx Font size in pixels
 * @param fontWeight Font weight (400 = normal, 600+ = bold)
 * @returns True if text qualifies as large text
 */
export function isLargeTextFromCSS(fontSizePx: number, fontWeight: number = 400): boolean {
  const isBold = fontWeight >= 600;
  const largeTextThreshold = isBold ? 18.66 : 24; // px equivalents
  return fontSizePx >= largeTextThreshold;
}
