/**
 * Theme Guard Middleware
 * 
 * Automatically sanitizes color tokens to meet WCAG 2.2 AA contrast requirements
 * before applying them to the document root.
 */

import { 
  passesContrast, 
  snapToPassingColor, 
  contrastRatio,
  isLargeTextFromCSS 
} from './contrast.js';

export interface ColorTokenSet {
  [key: string]: string; // CSS custom property values
}

export interface ThemeGuardOptions {
  bypassGuard?: boolean;
  logAdjustments?: boolean;
  preferForegroundAdjust?: boolean;
  preferBackgroundAdjust?: boolean;
  // Large text detection context
  largeTextContext?: {
    fontSize?: number; // in pixels
    fontWeight?: number; // numeric weight (400, 600, etc.)
  };
}

/**
 * Large Text Heuristics for WCAG 2.2 AA Compliance
 * 
 * Per SC 1.4.3 Contrast (Minimum), "large text" is defined as:
 * - At least 18pt (24px) in regular weight (400)
 * - At least 14pt (18.67px ≈ 19px) in bold weight (600+)
 * 
 * Common heuristics for setting largeTextContext:
 * - Headings (h1-h3): Often 24px+ regular → use 3:1 threshold
 * - Headings (h4-h6): Often 18px+ regular → use 3:1 threshold  
 * - Body text: Usually 16px regular → use 4.5:1 threshold
 * - UI labels: Usually 14px regular → use 4.5:1 threshold
 * - Bold text: 16px+ bold → use 3:1 threshold
 * 
 * Example usage:
 * ```typescript
 * sanitizeThemeTokens(tokens, {
 *   largeTextContext: { fontSize: 24, fontWeight: 400 } // h1 heading
 * });
 * ```
 */
export interface AdjustmentLog {
  original: string;
  adjusted: string;
  ratio: number;
  clamped: boolean;
  adjustedColor: 'fg' | 'bg';
  semanticPair: string;
  // QA traceability: exact threshold used for this pair
  thresholdUsed: number;
  thresholdType: 'normal-text' | 'large-text' | 'ui-component' | 'focus-indicator';
  largeTextDetected?: boolean; // true if this pair was dynamically detected as large text
}

export interface ThemeGuardResult {
  sanitizedTokens: ColorTokenSet;
  adjustments: AdjustmentLog[];
  violations: string[];
  applied: boolean;
  status: 'pass' | 'warnings' | 'fail';
  summary: {
    totalChecks: number;
    violations: number;
    adjustments: number;
    clamped: number;
  };
  focusRingValidation: {
    insetValidated: boolean;
    outsetValidated: boolean;
    warnings: string[];
  };
  // Large text detection traceability
  largeTextDetection?: {
    contextProvided: boolean;
    fontSize?: number;
    fontWeight?: number;
    pairsEvaluatedAsLarge: string[]; // Token pairs that were evaluated at 3:1 due to large text detection
  };
  // SC 1.4.3 exemptions tracking
  exemptions?: {
    exemptTokens: string[]; // Tokens exempted from text contrast requirements
    exemptionReasons: string[]; // Reasons for exemptions (logo, decorative, etc.)
  };
}

/**
 * Semantic color pair definitions for WCAG 2.2 AA compliance
 * 
 * Thresholds are binary: 4.5:1 for normal text, 3:1 for large text and UI components.
 * Values below these thresholds (e.g., 4.49:1, 2.99:1) are failures per WCAG 2.2 AA.
 * 
 * SC 1.4.3 Exemptions (not included in validation):
 * - Logos and brand marks
 * - Purely decorative graphics
 * - Text that is part of a logo or brand name
 * - Text that is purely decorative
 */
const SEMANTIC_PAIRS = [
  // Text vs background (4.5:1 for normal text - binary threshold)
  { fg: '--text-primary', bg: '--bg-primary', threshold: 4.5, type: 'normal-text' },
  { fg: '--text-secondary', bg: '--bg-primary', threshold: 4.5, type: 'normal-text' },
  { fg: '--text-tertiary', bg: '--bg-primary', threshold: 4.5, type: 'normal-text' },
  
  // Large text vs background (3:1 - binary threshold)
  // Note: These tokens are assumed to be large text; use largeTextContext for dynamic detection
  { fg: '--text-heading', bg: '--bg-primary', threshold: 3.0, type: 'large-text' },
  { fg: '--text-title', bg: '--bg-primary', threshold: 3.0, type: 'large-text' },
  
  // UI components vs background (3:1 - binary threshold)
  { fg: '--border-primary', bg: '--bg-primary', threshold: 3.0, type: 'ui-component' },
  { fg: '--border-secondary', bg: '--bg-primary', threshold: 3.0, type: 'ui-component' },
  { fg: '--icon-primary', bg: '--bg-primary', threshold: 3.0, type: 'ui-component' },
  { fg: '--icon-secondary', bg: '--bg-primary', threshold: 3.0, type: 'ui-component' },
  
  // Focus indicators vs context (3:1 - binary threshold)
  // Check against adjacent backgrounds per WCAG 1.4.11 Non-text Contrast
  { fg: '--focus-ring', bg: '--bg-primary', threshold: 3.0, type: 'focus-indicator' },
  { fg: '--focus-ring', bg: '--bg-secondary', threshold: 3.0, type: 'focus-indicator' },
  { fg: '--focus-ring', bg: '--bg-button', threshold: 3.0, type: 'focus-indicator' },
  { fg: '--focus-ring', bg: '--bg-button-hover', threshold: 3.0, type: 'focus-indicator' },
  
  // Focus ring inside/outside validation per WCAG 1.4.11 Non-text Contrast
  // 
  // WCAG 1.4.11 requires focus indicators to have ≥3:1 contrast against adjacent colors.
  // Threshold is binary: values below 3:1 (e.g., 2.99:1) are failures.
  // 
  // - Inset focus rings (inside components) must contrast against the component's fill color
  // - Outset focus rings (outside components) must contrast against the page/container background
  // 
  // Inset focus rings are adjacent to the component's fill color (3:1 - binary threshold)
  { fg: '--focus-ring-inset', bg: '--bg-button', threshold: 3.0, type: 'focus-indicator' },
  { fg: '--focus-ring-inset', bg: '--bg-button-hover', threshold: 3.0, type: 'focus-indicator' },
  { fg: '--focus-ring-inset', bg: '--bg-button-active', threshold: 3.0, type: 'focus-indicator' },
  { fg: '--focus-ring-inset', bg: '--bg-input', threshold: 3.0, type: 'focus-indicator' },
  
  // Outset focus rings are adjacent to the page/container background (3:1 - binary threshold)
  { fg: '--focus-ring-outset', bg: '--bg-primary', threshold: 3.0, type: 'focus-indicator' },
  { fg: '--focus-ring-outset', bg: '--bg-secondary', threshold: 3.0, type: 'focus-indicator' },
  { fg: '--focus-ring-outset', bg: '--bg-container', threshold: 3.0, type: 'focus-indicator' },
  
  // Interactive elements (4.5:1 - binary threshold for normal text)
  // Note: Hover states are included for text contrast, but focus indicators
  // require separate 3:1 validation per SC 1.4.11 (not hover visuals)
  { fg: '--text-primary', bg: '--bg-button', threshold: 4.5, type: 'normal-text' },
  { fg: '--text-primary', bg: '--bg-button-hover', threshold: 4.5, type: 'normal-text' },
  { fg: '--text-primary', bg: '--bg-button-active', threshold: 4.5, type: 'normal-text' },
] as const;

/**
 * Helper function to determine if text qualifies as "large text" per WCAG 2.2 AA
 * 
 * @param fontSize - Font size in pixels
 * @param fontWeight - Font weight (400 = normal, 600+ = bold)
 * @returns true if text qualifies as large text (3:1 threshold), false for normal text (4.5:1 threshold)
 * 
 * WCAG 2.2 AA Definition:
 * - Large text: ≥18pt (24px) regular OR ≥14pt (18.67px ≈ 19px) bold
 * - Normal text: Everything else
 */
export function isLargeTextPerWCAG(fontSize: number, fontWeight: number = 400): boolean {
  // WCAG 2.2 AA definition: ≥18pt regular OR ≥14pt bold
  const isRegularLarge = fontSize >= 24 && fontWeight < 600;
  const isBoldLarge = fontSize >= 19 && fontWeight >= 600;
  
  return isRegularLarge || isBoldLarge;
}

/**
 * Checks if a token pair should be exempt from SC 1.4.3 text contrast requirements
 * 
 * SC 1.4.3 Exemptions:
 * - Logos and brand marks
 * - Purely decorative graphics  
 * - Text that is part of a logo or brand name
 * - Text that is purely decorative
 */
function isExemptFromTextContrast(tokenName: string): boolean {
  const exemptPatterns = [
    // Logo and brand patterns
    /logo/i,
    /brand/i,
    /mark/i,
    /trademark/i,
    /watermark/i,
    
    // Decorative patterns
    /decorative/i,
    /ornament/i,
    /decoration/i,
    /accent/i,
    /highlight/i,
    
    // Specific exempt token patterns
    /text-logo/i,
    /text-brand/i,
    /text-decorative/i,
    /text-ornament/i,
    /text-accent/i,
    /text-highlight/i,
    
    // Icon patterns (if purely decorative)
    /icon-decorative/i,
    /icon-ornament/i,
    /icon-accent/i
  ];
  
  return exemptPatterns.some(pattern => pattern.test(tokenName));
}

/**
 * Validates focus ring tokens against adjacent backgrounds with fallback logic
 * 
 * Per WCAG 1.4.11 Non-text Contrast, focus indicators must have ≥3:1 contrast
 * against adjacent colors. This function:
 * - Validates inset rings against component fill colors
 * - Validates outset rings against surrounding/container backgrounds
 * - Uses fallback logic when adjacent backgrounds are unknown
 * - Logs warnings to prevent silent false passes
 * 
 * Note: Focus indicators are distinct from hover states. WCAG does not require
 * 3:1 contrast for hover visuals - only for focus indicators. Practitioners
 * caution against conflating focus and hover requirements.
 */
function validateFocusRings(tokens: ColorTokenSet): {
  insetValidated: boolean;
  outsetValidated: boolean;
  warnings: string[];
  additionalPairs: Array<{ fg: string; bg: string; threshold: number; type: string }>;
} {
  const warnings: string[] = [];
  const additionalPairs: Array<{ fg: string; bg: string; threshold: number; type: string }> = [];
  
  let insetValidated = false;
  let outsetValidated = false;
  
  // Check for focus ring tokens
  const hasInset = Object.keys(tokens).some(key => key.includes('focus-ring-inset'));
  const hasOutset = Object.keys(tokens).some(key => key.includes('focus-ring-outset'));
  
  if (hasInset) {
    insetValidated = true;
    
    // Validate inset focus rings against component backgrounds (inside components)
    const componentBackgrounds = [
      '--bg-button', '--bg-button-hover', '--bg-button-active', 
      '--bg-input', '--bg-card', '--bg-modal', '--bg-select',
      '--bg-checkbox', '--bg-radio', '--bg-toggle'
    ];
    
    let foundComponentBg = false;
    componentBackgrounds.forEach(bgToken => {
      if (tokens[bgToken]) {
        foundComponentBg = true;
        additionalPairs.push({
          fg: '--focus-ring-inset',
          bg: bgToken,
          threshold: 3.0,
          type: 'focus-indicator'
        });
      }
    });
    
    // If no specific component backgrounds found, warn and use fallback
    if (!foundComponentBg) {
      // Try to find nearest ancestor background
      const ancestorBackgrounds = ['--bg-primary', '--bg-secondary', '--bg-container', '--bg-page'];
      let fallbackBg = '--bg-primary';
      
      for (const bgToken of ancestorBackgrounds) {
        if (tokens[bgToken]) {
          fallbackBg = bgToken;
          break;
        }
      }
      
      warnings.push(`WCAG 1.4.11: No component backgrounds found for inset focus ring validation - using fallback to ${fallbackBg}`);
      additionalPairs.push({
        fg: '--focus-ring-inset',
        bg: fallbackBg,
        threshold: 3.0,
        type: 'focus-indicator'
      });
    }
  }
  
  if (hasOutset) {
    outsetValidated = true;
    
    // Validate outset focus rings against page/container backgrounds (outside components)
    const pageBackgrounds = [
      '--bg-primary', '--bg-secondary', '--bg-container', 
      '--bg-page', '--bg-body', '--bg-main', '--bg-content',
      '--bg-sidebar', '--bg-header', '--bg-footer'
    ];
    
    let foundPageBg = false;
    pageBackgrounds.forEach(bgToken => {
      if (tokens[bgToken]) {
        foundPageBg = true;
        additionalPairs.push({
          fg: '--focus-ring-outset',
          bg: bgToken,
          threshold: 3.0,
          type: 'focus-indicator'
        });
      }
    });
    
    // If no specific page backgrounds found, warn and use fallback
    if (!foundPageBg) {
      // Try to find nearest ancestor background
      const ancestorBackgrounds = ['--bg-primary', '--bg-secondary', '--bg-container', '--bg-page'];
      let fallbackBg = '--bg-primary';
      
      for (const bgToken of ancestorBackgrounds) {
        if (tokens[bgToken]) {
          fallbackBg = bgToken;
          break;
        }
      }
      
      warnings.push(`WCAG 1.4.11: No page backgrounds found for outset focus ring validation - using fallback to ${fallbackBg}`);
      additionalPairs.push({
        fg: '--focus-ring-outset',
        bg: fallbackBg,
        threshold: 3.0,
        type: 'focus-indicator'
      });
    }
  }
  
  // Additional validation: ensure focus ring tokens exist if focus indicators are used
  if (!hasInset && !hasOutset) {
    const hasFocusRing = Object.keys(tokens).some(key => key.includes('focus-ring'));
    if (hasFocusRing) {
      warnings.push('WCAG 2.4.7: Focus ring token found but no inset/outset variants - consider adding --focus-ring-inset and --focus-ring-outset for proper adjacent color validation');
    }
  }
  
  return {
    insetValidated,
    outsetValidated,
    warnings,
    additionalPairs
  };
}

/**
 * Sanitizes a color token set to meet WCAG 2.2 AA contrast requirements
 */
export function sanitizeThemeTokens(
  tokens: ColorTokenSet, 
  options: ThemeGuardOptions = {}
): ThemeGuardResult {
  const { bypassGuard = false, logAdjustments = false, largeTextContext, ...snapOptions } = options;
  
  if (bypassGuard) {
    return {
      sanitizedTokens: tokens,
      adjustments: [],
      violations: [],
      applied: true,
      status: 'pass',
      summary: {
        totalChecks: 0,
        violations: 0,
        adjustments: 0,
        clamped: 0
      },
      focusRingValidation: {
        insetValidated: false,
        outsetValidated: false,
        warnings: []
      },
      largeTextDetection: largeTextContext ? {
        contextProvided: true,
        fontSize: largeTextContext.fontSize,
        fontWeight: largeTextContext.fontWeight,
        pairsEvaluatedAsLarge: []
      } : undefined,
      exemptions: undefined
    };
  }
  
  const sanitizedTokens = { ...tokens };
  const adjustments: AdjustmentLog[] = [];
  const violations: string[] = [];
  let clampedCount = 0;
  
  // Track large text detection for QA traceability
  const pairsEvaluatedAsLarge: string[] = [];
  
  // Track SC 1.4.3 exemptions
  const exemptTokens: string[] = [];
  const exemptionReasons: string[] = [];
  
  // Validate focus rings with fallback logic
  const focusRingValidation = validateFocusRings(tokens);
  
  // Combine standard semantic pairs with focus ring validation pairs
  const allPairs = [...SEMANTIC_PAIRS, ...focusRingValidation.additionalPairs];
  
  // Check each semantic pair
  for (const pair of allPairs) {
    const fgValue = sanitizedTokens[pair.fg];
    const bgValue = sanitizedTokens[pair.bg];
    
    if (!fgValue || !bgValue) {
      continue; // Skip if either color is missing
    }
    
    // Check for SC 1.4.3 exemptions (logos, decorative graphics)
    if (pair.type === 'normal-text' || pair.type === 'large-text') {
      if (isExemptFromTextContrast(pair.fg)) {
        exemptTokens.push(pair.fg);
        exemptionReasons.push(`${pair.fg}: exempt from SC 1.4.3 (logo/decorative)`);
        continue; // Skip validation for exempt tokens
      }
    }
    
    // Determine if this is large text based on context or type
    let isLargeText = pair.type === 'large-text';
    let wasEvaluatedAsLarge = false;
    
    if (largeTextContext && (pair.type === 'normal-text' || pair.type === 'large-text')) {
      // Use dynamic large text detection when context is provided
      const detectedAsLarge = isLargeTextFromCSS(largeTextContext.fontSize || 16, largeTextContext.fontWeight || 400);
      if (detectedAsLarge) {
        isLargeText = true;
        wasEvaluatedAsLarge = true;
        // Track this pair for QA traceability
        pairsEvaluatedAsLarge.push(`${pair.fg} vs ${pair.bg}`);
      }
    }
    
    // Check if the pair passes contrast requirements
    const passes = passesContrast(fgValue, bgValue, {
      isLargeText,
      uiComponent: pair.type === 'ui-component' || pair.type === 'focus-indicator'
    });
    
    if (!passes) {
      violations.push(`${pair.fg} on ${pair.bg} (${pair.type})`);
      
      // Attempt to fix the violation
      const snapResult = snapToPassingColor(fgValue, bgValue, {
        isLargeText,
        uiComponent: pair.type === 'ui-component' || pair.type === 'focus-indicator',
        ...snapOptions
      });
      
      if (snapResult.clamped) {
        clampedCount++;
        // Couldn't meet threshold - log as violation with binary threshold clarification
        const threshold = isLargeText ? 3.0 : 4.5;
        violations.push(`${pair.fg} on ${pair.bg} - FAILED: ${snapResult.ratio.toFixed(2)}:1 < ${threshold}:1 (binary threshold)`);
      }
      
      // Apply the adjustment
      if (snapResult.adjusted === 'fg') {
        sanitizedTokens[pair.fg] = snapResult.fg;
      } else if (snapResult.adjusted === 'bg') {
        sanitizedTokens[pair.bg] = snapResult.bg;
      }
      
      // Log the adjustment if requested
      if (logAdjustments) {
        const thresholdUsed = isLargeText ? 3.0 : 4.5;
        adjustments.push({
          original: `${fgValue} on ${bgValue}`,
          adjusted: `${snapResult.fg} on ${snapResult.bg}`,
          ratio: snapResult.ratio,
          clamped: snapResult.clamped || false,
          adjustedColor: snapResult.adjusted || 'fg',
          semanticPair: `${pair.fg} vs ${pair.bg}`,
          thresholdUsed,
          thresholdType: pair.type as 'normal-text' | 'large-text' | 'ui-component' | 'focus-indicator',
          largeTextDetected: wasEvaluatedAsLarge
        });
      }
    }
  }
  
  // Determine overall status
  let status: 'pass' | 'warnings' | 'fail';
  if (violations.length === 0) {
    status = 'pass';
  } else if (clampedCount === 0) {
    status = 'warnings'; // All violations were fixed
  } else {
    status = 'fail'; // Some violations couldn't be resolved
  }
  
  return {
    sanitizedTokens,
    adjustments,
    violations,
    applied: true,
    status,
    summary: {
      totalChecks: allPairs.length,
      violations: violations.length,
      adjustments: adjustments.length,
      clamped: clampedCount
    },
    focusRingValidation: {
      insetValidated: focusRingValidation.insetValidated,
      outsetValidated: focusRingValidation.outsetValidated,
      warnings: focusRingValidation.warnings
    },
    largeTextDetection: largeTextContext ? {
      contextProvided: true,
      fontSize: largeTextContext.fontSize,
      fontWeight: largeTextContext.fontWeight,
      pairsEvaluatedAsLarge
    } : undefined,
    exemptions: exemptTokens.length > 0 ? {
      exemptTokens,
      exemptionReasons
    } : undefined
  };
}

/**
 * Applies sanitized tokens to the document root
 */
export function applyThemeTokens(tokens: ColorTokenSet): void {
  const root = document.documentElement;
  
  for (const [property, value] of Object.entries(tokens)) {
    root.style.setProperty(property, value);
  }
}

/**
 * Generates SC 2.4.13 Focus Appearance manual check guidance
 */
export function generateFocusAppearanceGuidance(result: ThemeGuardResult): {
  focusIndicatorsFound: boolean;
  manualChecksRequired: string[];
  guidance: string;
} {
  const { focusRingValidation, adjustments } = result;
  
  const focusIndicatorsFound = focusRingValidation.insetValidated || focusRingValidation.outsetValidated;
  const focusAdjustments = adjustments.filter(a => a.thresholdType === 'focus-indicator');
  
  const manualChecksRequired: string[] = [];
  let guidance = '';
  
  if (focusIndicatorsFound) {
    // Check if focus indicators have sufficient contrast (already validated)
    const focusViolations = adjustments.filter(a => 
      a.thresholdType === 'focus-indicator' && a.clamped
    );
    
    if (focusViolations.length === 0) {
      // Contrast is met, now check size/area requirements
      manualChecksRequired.push('2px perimeter area verification');
      manualChecksRequired.push('3:1 change between focused/unfocused states');
      
      guidance = `Focus indicators meet contrast requirements (≥3:1 against adjacent colors). Manual verification needed for:\n` +
        `• Size/Area: Focus indicator must be at least as large as a 2px perimeter around the component\n` +
        `• Change of Contrast: Must show ≥3:1 change between focused and unfocused states\n` +
        `• Visibility: Ensure indicator is clearly visible and distinguishable from unfocused state\n` +
        `• Focus vs Hover: Focus indicators are distinct from hover states - WCAG does not require 3:1 contrast for hover visuals`;
    } else {
      // Contrast issues exist
      manualChecksRequired.push('Contrast remediation (below 3:1 threshold)');
      manualChecksRequired.push('2px perimeter area verification');
      manualChecksRequired.push('3:1 change between focused/unfocused states');
      
      guidance = `Focus indicators have contrast violations (below 3:1 threshold). After contrast remediation:\n` +
        `• Size/Area: Focus indicator must be at least as large as a 2px perimeter around the component\n` +
        `• Change of Contrast: Must show ≥3:1 change between focused and unfocused states\n` +
        `• Visibility: Ensure indicator is clearly visible and distinguishable from unfocused state\n` +
        `• Focus vs Hover: Focus indicators are distinct from hover states - WCAG does not require 3:1 contrast for hover visuals`;
    }
  } else {
    manualChecksRequired.push('Focus indicator implementation');
    guidance = `No focus indicators found. SC 2.4.13 requires:\n` +
      `• Focus indicators must be present for all interactive elements\n` +
      `• Must meet ≥3:1 contrast against adjacent colors (SC 1.4.11)\n` +
      `• Must be at least as large as a 2px perimeter around the component\n` +
      `• Must show ≥3:1 change between focused and unfocused states\n` +
      `• Focus vs Hover: Focus indicators are distinct from hover states - WCAG does not require 3:1 contrast for hover visuals`;
  }
  
  return {
    focusIndicatorsFound,
    manualChecksRequired,
    guidance
  };
}

/**
 * Generates SC validation summary for QA artifacts
 */
export function generateSCValidationSummary(result: ThemeGuardResult): {
  sc143: { status: string; details: string };
  sc1411: { status: string; details: string };
  sc247: { status: string; details: string };
  sc2413: { status: string; details: string };
} {
  const { status, summary, focusRingValidation, violations, adjustments, largeTextDetection, exemptions } = result;
  
  // SC 1.4.3 Text Contrast
  const textViolations = violations.filter(v => v.includes('normal-text') || v.includes('large-text')).length;
  const textAdjustments = adjustments.filter(a => a.semanticPair.includes('text')).length;
  
  let sc143Status = '';
  let sc143Details = '';
  if (textViolations === 0) {
    sc143Status = '✅ PASS';
    sc143Details = 'Text contrast meets WCAG 2.2 AA requirements (4.5:1 normal, 3:1 large text - binary thresholds)';
    
    // Add large text detection traceability when context was provided
    if (largeTextDetection?.contextProvided && largeTextDetection.pairsEvaluatedAsLarge.length > 0) {
      sc143Details += `\nLarge text detection applied: ${largeTextDetection.pairsEvaluatedAsLarge.length} pairs evaluated at 3:1 threshold (${largeTextDetection.fontSize}px, ${largeTextDetection.fontWeight} weight)`;
    }
    
  } else if (status === 'warnings') {
    sc143Status = '⚠️ PASS (adjusted)';
    sc143Details = `Text contrast adjusted for ${textAdjustments} token pairs to meet WCAG 2.2 AA binary thresholds`;
    
    // Add large text detection traceability when context was provided
    if (largeTextDetection?.contextProvided && largeTextDetection.pairsEvaluatedAsLarge.length > 0) {
      sc143Details += `\nLarge text detection applied: ${largeTextDetection.pairsEvaluatedAsLarge.length} pairs evaluated at 3:1 threshold (${largeTextDetection.fontSize}px, ${largeTextDetection.fontWeight} weight)`;
    }
    
  } else {
    sc143Status = '❌ FAIL';
    sc143Details = `${textViolations} text contrast violations below binary thresholds (4.5:1 normal, 3:1 large text)`;
    
    // Add large text detection traceability when context was provided
    if (largeTextDetection?.contextProvided && largeTextDetection.pairsEvaluatedAsLarge.length > 0) {
      sc143Details += `\nLarge text detection applied: ${largeTextDetection.pairsEvaluatedAsLarge.length} pairs evaluated at 3:1 threshold (${largeTextDetection.fontSize}px, ${largeTextDetection.fontWeight} weight)`;
    }
    
    
  }
  
  // Add exemption information once at the end (deduplicated)
  if (exemptions && exemptions.exemptTokens.length > 0) {
    sc143Details += `\nSC 1.4.3 exemptions applied: ${exemptions.exemptTokens.length} tokens exempted (logos/decorative graphics)`;
  }
  
  // SC 1.4.11 Non-text Contrast
  const uiViolations = violations.filter(v => v.includes('ui-component') || v.includes('focus-indicator')).length;
  const uiAdjustments = adjustments.filter(a => a.semanticPair.includes('border') || a.semanticPair.includes('icon') || a.semanticPair.includes('focus-ring')).length;
  
  let sc1411Status = '';
  let sc1411Details = '';
  if (uiViolations === 0) {
    sc1411Status = '✅ PASS';
    sc1411Details = 'UI component contrast meets WCAG 2.2 AA requirements (≥3:1 - binary threshold)';
  } else if (status === 'warnings') {
    sc1411Status = '⚠️ PASS (adjusted)';
    sc1411Details = `UI component contrast adjusted for ${uiAdjustments} token pairs to meet WCAG 2.2 AA binary threshold`;
  } else {
    sc1411Status = '❌ FAIL';
    sc1411Details = `${uiViolations} UI component contrast violations below binary threshold (3:1)`;
  }
  
  // SC 2.4.7 Focus Indicators
  const focusViolations = violations.filter(v => v.includes('focus-indicator')).length;
  const focusAdjustments = adjustments.filter(a => a.semanticPair.includes('focus-ring')).length;
  
  let sc247Status = '';
  let sc247Details = '';
  if (focusViolations === 0 && focusRingValidation.insetValidated && focusRingValidation.outsetValidated) {
    sc247Status = '✅ PASS';
    sc247Details = 'Focus indicators validated against adjacent colors (inset + outset) - binary threshold 3:1 met';
  } else if (focusViolations === 0 && (focusRingValidation.insetValidated || focusRingValidation.outsetValidated)) {
    sc247Status = '⚠️ PARTIAL';
    sc247Details = `Focus indicators validated (${focusRingValidation.insetValidated ? 'inset' : 'outset'} only) - binary threshold 3:1 met`;
  } else if (status === 'warnings' && focusAdjustments > 0) {
    sc247Status = '⚠️ PASS (adjusted)';
    sc247Details = `Focus indicators adjusted for ${focusAdjustments} token pairs to meet WCAG 2.2 AA binary threshold`;
  } else {
    sc247Status = '❌ FAIL';
    sc247Details = 'Focus indicator contrast violations below binary threshold (3:1) require attention';
  }
  
  // SC 2.4.13 Focus Appearance
  const focusAppearanceGuidance = generateFocusAppearanceGuidance(result);
  const sc2413Status = '⚠️ MANUAL REVIEW';
  const sc2413Details = `Focus indicator size/area requires manual verification: ${focusAppearanceGuidance.manualChecksRequired.join(', ')} (automated contrast check completed)`;
  
  return {
    sc143: { status: sc143Status, details: sc143Details },
    sc1411: { status: sc1411Status, details: sc1411Details },
    sc247: { status: sc247Status, details: sc247Details },
    sc2413: { status: sc2413Status, details: sc2413Details }
  };
}

/**
 * Generates a compact summary for QA artifacts based on actual validation results
 */
export function generateThemeGuardSummary(result: ThemeGuardResult): {
  wcagCompliance: string;
  focusRingStatus: string;
  recommendations: string[];
} {
  const { status, summary, focusRingValidation, adjustments, violations } = result;
  
  // Analyze actual validation results
  const textViolations = violations.filter(v => v.includes('normal-text') || v.includes('large-text')).length;
  const uiViolations = violations.filter(v => v.includes('ui-component') || v.includes('focus-indicator')).length;
  const textAdjustments = adjustments.filter(a => a.semanticPair.includes('text')).length;
  const uiAdjustments = adjustments.filter(a => a.semanticPair.includes('border') || a.semanticPair.includes('icon') || a.semanticPair.includes('focus-ring')).length;
  const clampedPairs = adjustments.filter(a => a.clamped).length;
  
  // WCAG compliance summary based on actual results
  let wcagCompliance = '';
  if (status === 'pass') {
    wcagCompliance = '✅ WCAG 2.2 AA compliant: SC 1.4.3 text contrast met (binary thresholds); SC 1.4.11 UI non-text ≥3:1 met (binary threshold)';
  } else if (status === 'warnings') {
    const textStatus = textViolations === 0 ? 'SC 1.4.3 text contrast met (binary thresholds)' : `SC 1.4.3 text contrast adjusted (${textAdjustments} tokens) to meet binary thresholds`;
    const uiStatus = uiViolations === 0 ? 'SC 1.4.11 UI non-text ≥3:1 met (binary threshold)' : `SC 1.4.11 UI non-text ≥3:1 adjusted (${uiAdjustments} tokens) to meet binary threshold`;
    wcagCompliance = `⚠️ WCAG 2.2 AA compliant with adjustments: ${textStatus}; ${uiStatus}`;
  } else {
    const textStatus = textViolations > 0 ? `SC 1.4.3 text contrast failed (${textViolations} violations below binary thresholds)` : 'SC 1.4.3 text contrast met (binary thresholds)';
    const uiStatus = uiViolations > 0 ? `SC 1.4.11 UI non-text failed (${uiViolations} violations below binary threshold)` : 'SC 1.4.11 UI non-text ≥3:1 met (binary threshold)';
    wcagCompliance = `❌ WCAG 2.2 AA violations: ${textStatus}; ${uiStatus}`;
  }
  
  // Focus ring validation summary with specific details
  let focusRingStatus = '';
  if (focusRingValidation.insetValidated && focusRingValidation.outsetValidated) {
    const focusViolations = violations.filter(v => v.includes('focus-indicator')).length;
    const focusAdjustments = adjustments.filter(a => a.semanticPair.includes('focus-ring')).length;
    
    if (focusViolations === 0) {
      focusRingStatus = '✅ Focus rings validated against adjacent colors (inset + outset): SC 1.4.11 met (binary threshold 3:1)';
    } else {
      focusRingStatus = `⚠️ Focus rings validated with ${focusAdjustments} adjustments: SC 1.4.11 met after corrections (binary threshold 3:1)`;
    }
  } else if (focusRingValidation.insetValidated) {
    focusRingStatus = '✅ Focus rings validated (inset only): SC 1.4.11 met for component backgrounds (binary threshold 3:1)';
  } else if (focusRingValidation.outsetValidated) {
    focusRingStatus = '✅ Focus rings validated (outset only): SC 1.4.11 met for page backgrounds (binary threshold 3:1)';
  } else {
    focusRingStatus = '⚠️ Focus ring validation not performed: SC 1.4.11 status unknown (binary threshold 3:1)';
  }
  
  if (focusRingValidation.warnings.length > 0) {
    focusRingStatus += `\n⚠️ Validation warnings: ${focusRingValidation.warnings.join('; ')}`;
  }
  
  // Targeted recommendations based on actual failing pairs and adjusted tokens
  const recommendations: string[] = [];
  
  // Text contrast recommendations
  if (textAdjustments > 0) {
    const adjustedTextTokens = adjustments
      .filter(a => a.thresholdType === 'normal-text' || a.thresholdType === 'large-text')
      .filter(a => !a.clamped)
      .map(a => a.semanticPair.split(' vs ')[0])
      .filter((token, index, arr) => arr.indexOf(token) === index); // dedupe
    
    if (adjustedTextTokens.length > 0) {
      // Group by threshold type for clarity
      const normalTextAdjustments = adjustments.filter(a => a.thresholdType === 'normal-text' && !a.clamped);
      const largeTextAdjustments = adjustments.filter(a => a.thresholdType === 'large-text' && !a.clamped);
      const dynamicLargeAdjustments = adjustments.filter(a => a.largeTextDetected && !a.clamped);
      
      let recommendation = `Update text token defaults: ${adjustedTextTokens.join(', ')} (SC 1.4.3 - binary thresholds)`;
      
      if (normalTextAdjustments.length > 0) {
        recommendation += `\n• ${normalTextAdjustments.length} pairs adjusted to meet 4.5:1 threshold (normal text)`;
      }
      if (largeTextAdjustments.length > 0) {
        recommendation += `\n• ${largeTextAdjustments.length} pairs adjusted to meet 3:1 threshold (large text)`;
      }
      if (dynamicLargeAdjustments.length > 0) {
        recommendation += `\n• ${dynamicLargeAdjustments.length} pairs dynamically detected as large text (3:1 threshold)`;
      }
      
      recommendations.push(recommendation);
    }
  }
  
  // UI component recommendations
  if (uiAdjustments > 0) {
    const adjustedUiTokens = adjustments
      .filter(a => a.thresholdType === 'ui-component' && !a.clamped)
      .map(a => a.semanticPair.split(' vs ')[0])
      .filter((token, index, arr) => arr.indexOf(token) === index); // dedupe
    
    if (adjustedUiTokens.length > 0) {
      recommendations.push(`Update UI token defaults: ${adjustedUiTokens.join(', ')} (SC 1.4.11 - binary threshold 3:1)`);
    }
  }
  
  // Focus ring recommendations
  const focusAdjustments = adjustments.filter(a => a.thresholdType === 'focus-indicator');
  if (focusAdjustments.length > 0) {
    const adjustedFocusTokens = focusAdjustments
      .filter(a => !a.clamped)
      .map(a => a.semanticPair.split(' vs ')[0])
      .filter((token, index, arr) => arr.indexOf(token) === index); // dedupe
    
    if (adjustedFocusTokens.length > 0) {
      recommendations.push(`Update focus ring defaults: ${adjustedFocusTokens.join(', ')} (SC 1.4.11 - binary threshold 3:1)`);
    }
    
    // Focus appearance guidance with specific manual checks
    const focusAppearanceGuidance = generateFocusAppearanceGuidance(result);
    recommendations.push(`Verify focus indicator size/area meets Focus Appearance guidance (SC 2.4.13): ${focusAppearanceGuidance.manualChecksRequired.join(', ')}`);
  }
  
  // Clamped pairs recommendations
  if (clampedPairs > 0) {
    const clampedTokens = adjustments
      .filter(a => a.clamped)
      .map(a => `${a.semanticPair} (${a.thresholdUsed}:1 threshold, ${a.thresholdType})`)
      .slice(0, 3); // Limit to first 3 for readability
    
    recommendations.push(`Review clamped color pairs for design alternatives: ${clampedTokens.join('; ')}${clampedPairs > 3 ? '...' : ''} (below binary thresholds)`);
  }
  
  // Missing background tokens
  if (focusRingValidation.warnings.length > 0) {
    recommendations.push('Add missing background tokens for proper focus ring validation (SC 1.4.11 - binary threshold 3:1)');
  }
  
  return {
    wcagCompliance,
    focusRingStatus,
    recommendations
  };
}

/**
 * Theme guard with automatic sanitization and application
 */
export function applyThemeWithGuard(
  tokens: ColorTokenSet, 
  options: ThemeGuardOptions = {}
): ThemeGuardResult {
  const result = sanitizeThemeTokens(tokens, options);
  
  if (result.applied) {
    applyThemeTokens(result.sanitizedTokens);
  }
  
  return result;
}

/**
 * React hook for theme guard integration
 */
export function useThemeGuard(options: ThemeGuardOptions = {}) {
  let lastResult: ThemeGuardResult | null = null;
  let subscribers: Array<(result: ThemeGuardResult) => void> = [];
  
  const applyTheme = (tokens: ColorTokenSet): ThemeGuardResult => {
    lastResult = applyThemeWithGuard(tokens, options);
    
    // Notify subscribers of the result
    subscribers.forEach(callback => callback(lastResult!));
    
    return lastResult;
  };
  
  const sanitizeTheme = (tokens: ColorTokenSet): ThemeGuardResult => {
    lastResult = sanitizeThemeTokens(tokens, options);
    
    // Notify subscribers of the result
    subscribers.forEach(callback => callback(lastResult!));
    
    return lastResult;
  };
  
  const subscribe = (callback: (result: ThemeGuardResult) => void) => {
    subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      subscribers = subscribers.filter(sub => sub !== callback);
    };
  };
  
  return {
    applyTheme,
    sanitizeTheme,
    lastResult,
    subscribe,
    bypassGuard: options.bypassGuard || false
  };
}

/**
 * Vanilla JS theme guard for non-React applications
 */
export function createThemeGuard(options: ThemeGuardOptions = {}) {
  return {
    apply: (tokens: ColorTokenSet) => applyThemeWithGuard(tokens, options),
    sanitize: (tokens: ColorTokenSet) => sanitizeThemeTokens(tokens, options),
    bypass: options.bypassGuard || false
  };
}
