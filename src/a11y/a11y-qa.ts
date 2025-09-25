/**
 * A11y QA Page
 * 
 * Live accessibility testing page that shows contrast ratios and pass/fail status
 * for current theme tokens across common UI components.
 */

import { 
  passesContrast, 
  contrastRatio, 
  isLargeTextFromCSS 
} from './contrast.js';

export interface ContrastCheck {
  element: string;
  fg: string;
  bg: string;
  ratio: number;
  passes: boolean;
  threshold: number;
  type: 'normal-text' | 'large-text' | 'ui-component' | 'focus-indicator';
  note?: string;
  warning?: boolean;
}

export interface A11yQAResult {
  checks: ContrastCheck[];
  overallPass: boolean;
  violations: number;
  warnings: number;
  missingTokens: string[];
  timestamp: string;
  wcagVersion: string;
}

/**
 * Common UI component definitions for testing
 */
const UI_COMPONENTS = [
  // Text elements
  { element: 'Primary Text', fg: '--text-primary', bg: '--bg-primary', type: 'normal-text' as const },
  { element: 'Secondary Text', fg: '--text-secondary', bg: '--bg-primary', type: 'normal-text' as const },
  { element: 'Tertiary Text', fg: '--text-tertiary', bg: '--bg-primary', type: 'normal-text' as const },
  
  // Headings (large text)
  { element: 'H1 Heading', fg: '--text-heading', bg: '--bg-primary', type: 'large-text' as const },
  { element: 'H2 Heading', fg: '--text-title', bg: '--bg-primary', type: 'large-text' as const },
  
  // UI components
  { element: 'Primary Border', fg: '--border-primary', bg: '--bg-primary', type: 'ui-component' as const },
  { element: 'Secondary Border', fg: '--border-secondary', bg: '--bg-primary', type: 'ui-component' as const },
  { element: 'Primary Icon', fg: '--icon-primary', bg: '--bg-primary', type: 'ui-component' as const },
  { element: 'Secondary Icon', fg: '--icon-secondary', bg: '--bg-primary', type: 'ui-component' as const },
  
  // Focus indicators - validate against adjacent colors per WCAG 1.4.11
  { element: 'Focus Ring (Inset)', fg: '--focus-ring-inset', bg: '--bg-button', type: 'focus-indicator' as const },
  { element: 'Focus Ring (Outset)', fg: '--focus-ring-outset', bg: '--bg-primary', type: 'focus-indicator' as const },
  { element: 'Focus Ring (Legacy)', fg: '--focus-ring', bg: '--bg-primary', type: 'focus-indicator' as const },
  
  // Interactive elements
  { element: 'Button Text', fg: '--text-primary', bg: '--bg-button', type: 'normal-text' as const },
  { element: 'Button Hover', fg: '--text-primary', bg: '--bg-button-hover', type: 'normal-text' as const },
  { element: 'Button Active', fg: '--text-primary', bg: '--bg-button-active', type: 'normal-text' as const },
] as const;

/**
 * Runs comprehensive contrast checks on current theme with proper focus ring validation
 */
export function runA11yQA(): A11yQAResult {
  const checks: ContrastCheck[] = [];
  const missingTokens: string[] = [];
  const root = document.documentElement;
  
  for (const component of UI_COMPONENTS) {
    let fgValue = getComputedStyle(root).getPropertyValue(component.fg).trim();
    let bgValue = getComputedStyle(root).getPropertyValue(component.bg).trim();
    
    // Handle missing tokens with warnings instead of skipping
    if (!fgValue) {
      missingTokens.push(component.fg);
      checks.push({
        element: component.element,
        fg: component.fg,
        bg: component.bg,
        ratio: 0,
        passes: false,
        threshold: component.type === 'normal-text' ? 4.5 : 3.0,
        type: component.type,
        note: `Missing foreground token: ${component.fg}`,
        warning: true
      });
      continue;
    }
    
    if (!bgValue) {
      missingTokens.push(component.bg);
      checks.push({
        element: component.element,
        fg: fgValue,
        bg: component.bg,
        ratio: 0,
        passes: false,
        threshold: component.type === 'normal-text' ? 4.5 : 3.0,
        type: component.type,
        note: `Missing background token: ${component.bg}`,
        warning: true
      });
      continue;
    }
    
    // Special handling for focus ring adjacent color validation
    if (component.type === 'focus-indicator') {
      const focusRingResult = validateFocusRingAdjacentColors(component, fgValue, bgValue, root);
      if (focusRingResult) {
        checks.push(focusRingResult);
        continue;
      }
    }
    
    // Standard contrast validation
    const ratio = contrastRatio(fgValue, bgValue);
    const threshold = component.type === 'normal-text' ? 4.5 : 3.0;
    
    const passes = passesContrast(fgValue, bgValue, {
      isLargeText: component.type === 'large-text',
      uiComponent: component.type === 'ui-component' || component.type === 'focus-indicator'
    });
    
    // Large text sanity check - verify computed font size/weight if possible
    let largeTextNote: string | undefined;
    if (component.type === 'large-text') {
      // Try multiple selectors to find a sample element
      const selectors = [
        `[style*="${component.fg}"]`,
        `.${component.element.toLowerCase().replace(/\s+/g, '-')}`,
        'h1, h2, h3, h4, h5, h6',
        '.heading, .title, .large-text',
        '[class*="heading"], [class*="title"], [class*="large"]'
      ];
      
      let sampleElement: HTMLElement | null = null;
      for (const selector of selectors) {
        sampleElement = document.querySelector(selector) as HTMLElement;
        if (sampleElement) break;
      }
      
      if (sampleElement) {
        const computedStyle = getComputedStyle(sampleElement);
        const fontSize = parseFloat(computedStyle.fontSize);
        const fontWeight = computedStyle.fontWeight;
        const fontWeightNum = parseFloat(fontWeight) || 400;
        
        const isActuallyLarge = isLargeTextFromCSS(fontSize, fontWeightNum);
        if (!isActuallyLarge) {
          const requiredSize = fontWeightNum >= 700 ? '14pt+ (18.66px+)' : '18pt+ (24px+)';
          largeTextNote = `Large text threshold (3:1) used but computed font size ${fontSize}px/${fontWeight} may not qualify as "large text" per WCAG - verify ${requiredSize} for proper SC 1.4.3 compliance`;
        }
      } else {
        largeTextNote = `Large text threshold (3:1) used but could not verify computed font size/weight - ensure text is 18pt+ (24px+) or 14pt+ bold (18.66px+) per WCAG SC 1.4.3`;
      }
    }
    
    checks.push({
      element: component.element,
      fg: fgValue,
      bg: bgValue,
      ratio,
      passes,
      threshold,
      type: component.type,
      note: largeTextNote,
      warning: !!largeTextNote
    });
  }
  
  const violations = checks.filter(c => !c.passes).length;
  const warnings = checks.filter(c => c.warning).length;
  
  return {
    checks,
    overallPass: violations === 0,
    violations,
    warnings,
    missingTokens,
    timestamp: new Date().toISOString(),
    wcagVersion: '2.2 AA'
  };
}

/**
 * Validates focus ring against adjacent colors per WCAG 1.4.11
 */
function validateFocusRingAdjacentColors(
  component: { element: string; fg: string; bg: string; type: string }, 
  fgValue: string, 
  bgValue: string, 
  root: HTMLElement
): ContrastCheck | null {
  const { element, fg, bg } = component;
  
  // For inset focus rings, validate against component backgrounds
  if (fg.includes('focus-ring-inset')) {
    const componentBackgrounds = [
      '--bg-button', '--bg-button-hover', '--bg-button-active',
      '--bg-input', '--bg-card', '--bg-modal', '--bg-select'
    ];
    
    // Find the best available component background
    let bestBg: string = bg;
    let fallbackUsed = false;
    
    for (const bgToken of componentBackgrounds) {
      const bgTokenValue = getComputedStyle(root).getPropertyValue(bgToken).trim();
      if (bgTokenValue) {
        bestBg = bgToken;
        break;
      }
    }
    
    // If no component background found, use fallback
    if (bestBg === bg && !getComputedStyle(root).getPropertyValue(bg).trim()) {
      const fallbackBackgrounds = ['--bg-primary', '--bg-secondary', '--bg-container'];
      for (const fallbackBg of fallbackBackgrounds) {
        const fallbackValue = getComputedStyle(root).getPropertyValue(fallbackBg).trim();
        if (fallbackValue) {
          bestBg = fallbackBg;
          fallbackUsed = true;
          break;
        }
      }
    }
    
    const actualBgValue = getComputedStyle(root).getPropertyValue(bestBg).trim();
    if (!actualBgValue) {
      return {
        element,
        fg: fgValue,
        bg: bestBg,
        ratio: 0,
        passes: false,
        threshold: 3.0,
        type: 'focus-indicator',
        note: `No component backgrounds available for inset focus ring validation`,
        warning: true
      };
    }
    
    const ratio = contrastRatio(fgValue, actualBgValue);
    const passes = passesContrast(fgValue, actualBgValue, { uiComponent: true });
    
    return {
      element: `${element} (vs ${bestBg})`,
      fg: fgValue,
      bg: actualBgValue,
      ratio,
      passes,
      threshold: 3.0,
      type: 'focus-indicator',
      note: fallbackUsed ? `Using fallback background ${bestBg} for inset focus ring validation` : undefined,
      warning: fallbackUsed
    };
  }
  
  // For outset focus rings, validate against page/container backgrounds
  if (fg.includes('focus-ring-outset')) {
    const pageBackgrounds = [
      '--bg-primary', '--bg-secondary', '--bg-container',
      '--bg-page', '--bg-body', '--bg-main'
    ];
    
    // Find the best available page background
    let bestBg: string = bg;
    let fallbackUsed = false;
    
    for (const bgToken of pageBackgrounds) {
      const bgTokenValue = getComputedStyle(root).getPropertyValue(bgToken).trim();
      if (bgTokenValue) {
        bestBg = bgToken;
        break;
      }
    }
    
    // If no page background found, use fallback
    if (bestBg === bg && !getComputedStyle(root).getPropertyValue(bg).trim()) {
      const fallbackBackgrounds = ['--bg-primary', '--bg-secondary'];
      for (const fallbackBg of fallbackBackgrounds) {
        const fallbackValue = getComputedStyle(root).getPropertyValue(fallbackBg).trim();
        if (fallbackValue) {
          bestBg = fallbackBg;
          fallbackUsed = true;
          break;
        }
      }
    }
    
    const actualBgValue = getComputedStyle(root).getPropertyValue(bestBg).trim();
    if (!actualBgValue) {
      return {
        element,
        fg: fgValue,
        bg: bestBg,
        ratio: 0,
        passes: false,
        threshold: 3.0,
        type: 'focus-indicator',
        note: `No page backgrounds available for outset focus ring validation`,
        warning: true
      };
    }
    
    const ratio = contrastRatio(fgValue, actualBgValue);
    const passes = passesContrast(fgValue, actualBgValue, { uiComponent: true });
    
    return {
      element: `${element} (vs ${bestBg})`,
      fg: fgValue,
      bg: actualBgValue,
      ratio,
      passes,
      threshold: 3.0,
      type: 'focus-indicator',
      note: fallbackUsed ? `Using fallback background ${bestBg} for outset focus ring validation` : undefined,
      warning: fallbackUsed
    };
  }
  
  // For legacy focus rings, attempt adjacent validation where possible
  if (fg.includes('focus-ring') && !fg.includes('focus-ring-inset') && !fg.includes('focus-ring-outset')) {
    // Try to determine if this is likely an inset or outset ring based on available tokens
    const componentBackgrounds = [
      '--bg-button', '--bg-button-hover', '--bg-button-active',
      '--bg-input', '--bg-card', '--bg-modal', '--bg-select'
    ];
    
    const pageBackgrounds = [
      '--bg-primary', '--bg-secondary', '--bg-container',
      '--bg-page', '--bg-body', '--bg-main'
    ];
    
    // Check if component backgrounds are available (suggests inset usage)
    let hasComponentBg = false;
    let bestComponentBg = '';
    for (const bgToken of componentBackgrounds) {
      const bgTokenValue = getComputedStyle(root).getPropertyValue(bgToken).trim();
      if (bgTokenValue) {
        hasComponentBg = true;
        bestComponentBg = bgToken;
        break;
      }
    }
    
    // Check if page backgrounds are available (suggests outset usage)
    let hasPageBg = false;
    let bestPageBg = '';
    for (const bgToken of pageBackgrounds) {
      const bgTokenValue = getComputedStyle(root).getPropertyValue(bgToken).trim();
      if (bgTokenValue) {
        hasPageBg = true;
        bestPageBg = bgToken;
        break;
      }
    }
    
    // If both are available, validate against both and note the assumption
    if (hasComponentBg && hasPageBg) {
      const componentRatio = contrastRatio(fgValue, getComputedStyle(root).getPropertyValue(bestComponentBg).trim());
      const pageRatio = contrastRatio(fgValue, getComputedStyle(root).getPropertyValue(bestPageBg).trim());
      
      const componentPasses = passesContrast(fgValue, getComputedStyle(root).getPropertyValue(bestComponentBg).trim(), { uiComponent: true });
      const pagePasses = passesContrast(fgValue, getComputedStyle(root).getPropertyValue(bestPageBg).trim(), { uiComponent: true });
      
      // Return the worst case (most conservative validation)
      const worstRatio = Math.min(componentRatio, pageRatio);
      const worstPasses = componentPasses && pagePasses;
      
      return {
        element: `${element} (vs ${bestComponentBg} & ${bestPageBg})`,
        fg: fgValue,
        bg: `${getComputedStyle(root).getPropertyValue(bestComponentBg).trim()} / ${getComputedStyle(root).getPropertyValue(bestPageBg).trim()}`,
        ratio: worstRatio,
        passes: worstPasses,
        threshold: 3.0,
        type: 'focus-indicator',
        note: `Legacy focus ring validated against both component (${bestComponentBg}) and page (${bestPageBg}) backgrounds - consider using --focus-ring-inset/--focus-ring-outset for specific adjacent validation`,
        warning: true
      };
    }
    
    // If only one type is available, use that
    if (hasComponentBg) {
      const actualBgValue = getComputedStyle(root).getPropertyValue(bestComponentBg).trim();
      const ratio = contrastRatio(fgValue, actualBgValue);
      const passes = passesContrast(fgValue, actualBgValue, { uiComponent: true });
      
      return {
        element: `${element} (vs ${bestComponentBg})`,
        fg: fgValue,
        bg: actualBgValue,
        ratio,
        passes,
        threshold: 3.0,
        type: 'focus-indicator',
        note: `Legacy focus ring validated against component background ${bestComponentBg} - consider using --focus-ring-inset for explicit inset validation`,
        warning: true
      };
    }
    
    if (hasPageBg) {
      const actualBgValue = getComputedStyle(root).getPropertyValue(bestPageBg).trim();
      const ratio = contrastRatio(fgValue, actualBgValue);
      const passes = passesContrast(fgValue, actualBgValue, { uiComponent: true });
      
      return {
        element: `${element} (vs ${bestPageBg})`,
        fg: fgValue,
        bg: actualBgValue,
        ratio,
        passes,
        threshold: 3.0,
        type: 'focus-indicator',
        note: `Legacy focus ring validated against page background ${bestPageBg} - consider using --focus-ring-outset for explicit outset validation`,
        warning: true
      };
    }
    
    // Fallback to original bg with explicit assumption note
    const ratio = contrastRatio(fgValue, bgValue);
    const passes = passesContrast(fgValue, bgValue, { uiComponent: true });
    
    return {
      element: `${element} (assumed vs ${bg})`,
      fg: fgValue,
      bg: bgValue,
      ratio,
      passes,
      threshold: 3.0,
      type: 'focus-indicator',
      note: `Legacy focus ring validation assumed background ${bg} - define --focus-ring-inset (vs component bg) and --focus-ring-outset (vs page bg) for proper WCAG 1.4.11 adjacent color validation`,
      warning: true
    };
  }
  
  return null; // Use standard validation for non-focus elements
}

/**
 * Exports A11y QA result as JSON with schema validation
 */
export function exportA11yQAResult(result: A11yQAResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * JSON Schema for A11yQAResult
 * 
 * This schema defines the structure of the A11y QA result for validation and documentation:
 * 
 * ```json
 * {
 *   "$schema": "http://json-schema.org/draft-07/schema#",
 *   "type": "object",
 *   "properties": {
 *     "checks": {
 *       "type": "array",
 *       "items": {
 *         "type": "object",
 *         "properties": {
 *           "element": { "type": "string", "description": "UI element name" },
 *           "fg": { "type": "string", "description": "Foreground color value" },
 *           "bg": { "type": "string", "description": "Background color value" },
 *           "ratio": { "type": "number", "description": "Contrast ratio" },
 *           "passes": { "type": "boolean", "description": "Whether contrast passes WCAG threshold" },
 *           "threshold": { "type": "number", "description": "WCAG threshold (4.5 or 3.0)" },
 *           "type": { "enum": ["normal-text", "large-text", "ui-component", "focus-indicator"] },
 *           "note": { "type": "string", "description": "Additional context or warnings" },
 *           "warning": { "type": "boolean", "description": "Whether this check has warnings" }
 *         },
 *         "required": ["element", "fg", "bg", "ratio", "passes", "threshold", "type"]
 *       }
 *     },
 *     "overallPass": { "type": "boolean", "description": "Whether all checks pass" },
 *     "violations": { "type": "number", "description": "Number of failing checks" },
 *     "warnings": { "type": "number", "description": "Number of checks with warnings" },
 *     "missingTokens": { "type": "array", "items": { "type": "string" }, "description": "Missing CSS variables" },
 *     "timestamp": { "type": "string", "format": "date-time", "description": "When the check was performed" },
 *     "wcagVersion": { "type": "string", "description": "WCAG version used for validation" }
 *   },
 *   "required": ["checks", "overallPass", "violations", "warnings", "missingTokens", "timestamp", "wcagVersion"]
 * }
 * ```
 * 
 * Example result:
 * ```json
 * {
 *   "checks": [
 *     {
 *       "element": "Primary Text",
 *       "fg": "#333333",
 *       "bg": "#ffffff",
 *       "ratio": 12.63,
 *       "passes": true,
 *       "threshold": 4.5,
 *       "type": "normal-text"
 *     },
 *     {
 *       "element": "Focus Ring (Inset) (vs --bg-button)",
 *       "fg": "#4285f4",
 *       "bg": "#1a73e8",
 *       "ratio": 3.2,
 *       "passes": true,
 *       "threshold": 3.0,
 *       "type": "focus-indicator",
 *       "note": "Using fallback background --bg-button for inset focus ring validation",
 *       "warning": true
 *     }
 *   ],
 *   "overallPass": true,
 *   "violations": 0,
 *   "warnings": 1,
 *   "missingTokens": [],
 *   "timestamp": "2024-01-15T10:30:00.000Z",
 *   "wcagVersion": "2.2 AA"
 * }
 * ```
 */
export const A11Y_QA_RESULT_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    checks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          element: { type: "string", description: "UI element name" },
          fg: { type: "string", description: "Foreground color value" },
          bg: { type: "string", description: "Background color value" },
          ratio: { type: "number", description: "Contrast ratio" },
          passes: { type: "boolean", description: "Whether contrast passes WCAG threshold" },
          threshold: { type: "number", description: "WCAG threshold (4.5 or 3.0)" },
          type: { enum: ["normal-text", "large-text", "ui-component", "focus-indicator"] },
          note: { type: "string", description: "Additional context or warnings" },
          warning: { type: "boolean", description: "Whether this check has warnings" }
        },
        required: ["element", "fg", "bg", "ratio", "passes", "threshold", "type"]
      }
    },
    overallPass: { type: "boolean", description: "Whether all checks pass" },
    violations: { type: "number", description: "Number of failing checks" },
    warnings: { type: "number", description: "Number of checks with warnings" },
    missingTokens: { type: "array", items: { type: "string" }, description: "Missing CSS variables" },
    timestamp: { type: "string", format: "date-time", description: "When the check was performed" },
    wcagVersion: { type: "string", description: "WCAG version used for validation" }
  },
  required: ["checks", "overallPass", "violations", "warnings", "missingTokens", "timestamp", "wcagVersion"]
};

/**
 * Generates HTML for A11y QA page
 */
export function generateA11yQAHTML(result: A11yQAResult): string {
  const statusColor = result.overallPass ? '#22c55e' : '#ef4444';
  const statusText = result.overallPass ? 'PASS' : 'FAIL';
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>A11y QA - Contrast Check</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 20px;
                background: var(--bg-primary, #ffffff);
                color: var(--text-primary, #000000);
                line-height: 1.6;
            }
            
            .header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 24px;
                padding: 16px;
                border-radius: 8px;
                background: var(--bg-secondary, #f5f5f5);
                border: 1px solid var(--border-primary, #e0e0e0);
            }
            
            .status-badge {
                padding: 8px 16px;
                border-radius: 6px;
                font-weight: 600;
                font-size: 14px;
                color: white;
                background: ${statusColor};
            }
            
            .stats {
                display: flex;
                gap: 16px;
                margin-left: auto;
            }
            
            .stat {
                text-align: center;
            }
            
            .stat-value {
                font-size: 24px;
                font-weight: 700;
                color: var(--text-primary, #000000);
            }
            
            .stat-label {
                font-size: 12px;
                color: var(--text-secondary, #666666);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .checks-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 16px;
            }
            
            .check-card {
                padding: 16px;
                border-radius: 8px;
                border: 1px solid var(--border-primary, #e0e0e0);
                background: var(--bg-secondary, #f5f5f5);
            }
            
            .check-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            
            .check-title {
                font-weight: 600;
                color: var(--text-primary, #000000);
            }
            
            .check-badge {
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 600;
            }
            
            .check-badge.pass {
                background: #dcfce7;
                color: #166534;
            }
            
            .check-badge.fail {
                background: #fef2f2;
                color: #dc2626;
            }
            
            .check-details {
                font-size: 14px;
                color: var(--text-secondary, #666666);
            }
            
            .ratio {
                font-weight: 600;
                color: var(--text-primary, #000000);
            }
            
            .threshold {
                color: var(--text-tertiary, #999999);
            }
            
            .color-preview {
                display: flex;
                gap: 8px;
                margin-top: 8px;
            }
            
            .color-swatch {
                width: 24px;
                height: 24px;
                border-radius: 4px;
                border: 1px solid var(--border-primary, #e0e0e0);
            }
            
            .check-note {
                font-size: 12px;
                color: #f59e0b;
                background: #fef3c7;
                padding: 4px 8px;
                border-radius: 4px;
                margin: 4px 0;
                border-left: 3px solid #f59e0b;
            }
            
            .info-section {
                margin: 32px 0;
                padding: 20px;
                border-radius: 8px;
                background: var(--bg-secondary, #f5f5f5);
                border: 1px solid var(--border-primary, #e0e0e0);
            }
            
            .info-section h3 {
                margin: 0 0 16px 0;
                color: var(--text-primary, #000000);
                font-size: 18px;
            }
            
            .info-section p {
                margin: 0 0 12px 0;
                color: var(--text-secondary, #666666);
            }
            
            .info-section ul {
                margin: 0 0 16px 0;
                padding-left: 20px;
            }
            
            .info-section li {
                margin: 4px 0;
                color: var(--text-secondary, #666666);
            }
            
            .action-buttons {
                position: fixed;
                bottom: 20px;
                right: 20px;
                display: flex;
                gap: 12px;
            }
            
            .refresh-btn, .export-btn {
                padding: 12px 24px;
                border: none;
                border-radius: 6px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                transition: all 0.2s ease;
            }
            
            .refresh-btn {
                background: var(--bg-button, #007bff);
                color: var(--text-primary, #ffffff);
            }
            
            .export-btn {
                background: var(--bg-secondary, #f5f5f5);
                color: var(--text-primary, #000000);
                border: 1px solid var(--border-primary, #e0e0e0);
            }
            
            .refresh-btn:hover {
                background: var(--bg-button-hover, #0056b3);
                transform: translateY(-1px);
            }
            
            .export-btn:hover {
                background: var(--bg-secondary-hover, #e5e5e5);
                transform: translateY(-1px);
            }
            
            .refresh-btn:focus, .export-btn:focus {
                outline: 2px solid var(--focus-ring, #007bff);
                outline-offset: 2px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>A11y QA - Contrast Check</h1>
            <div class="status-badge">${statusText}</div>
            <div class="stats">
                <div class="stat">
                    <div class="stat-value">${result.checks.length}</div>
                    <div class="stat-label">Total</div>
                </div>
                <div class="stat">
                    <div class="stat-value" style="color: #ef4444;">${result.violations}</div>
                    <div class="stat-label">Violations</div>
                </div>
                <div class="stat">
                    <div class="stat-value" style="color: #f59e0b;">${result.warnings}</div>
                    <div class="stat-label">Warnings</div>
                </div>
                ${result.missingTokens.length > 0 ? `
                <div class="stat">
                    <div class="stat-value" style="color: #dc2626;">${result.missingTokens.length}</div>
                    <div class="stat-label">Missing Tokens</div>
                </div>
                ` : ''}
            </div>
        </div>
        
        <div class="checks-grid">
            ${result.checks.map(check => `
                <div class="check-card">
                    <div class="check-header">
                        <div class="check-title">${check.element}</div>
                        <div class="check-badge ${check.passes ? 'pass' : 'fail'}">
                            ${check.passes ? 'PASS' : 'FAIL'}
                        </div>
                    </div>
                    <div class="check-details">
                        <div>
                            Ratio: <span class="ratio">${check.ratio.toFixed(2)}:1</span>
                            <span class="threshold">(threshold: ${check.threshold}:1)</span>
                        </div>
                        <div>Type: ${check.type.replace('-', ' ')}</div>
                        ${check.note ? `<div class="check-note">${check.note}</div>` : ''}
                        <div class="color-preview">
                            <div class="color-swatch" style="background: ${check.fg}"></div>
                            <div class="color-swatch" style="background: ${check.bg}"></div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="info-section">
            <h3>WCAG 2.2 AA Compliance</h3>
            <p>This page validates color contrast according to WCAG 2.2 AA standards:</p>
            <ul>
                <li><strong>Normal text:</strong> 4.5:1 contrast ratio minimum</li>
                <li><strong>Large text:</strong> 3:1 contrast ratio minimum (18pt+ or 14pt+ bold)</li>
                <li><strong>UI components:</strong> 3:1 contrast ratio minimum (borders, icons, focus indicators)</li>
            </ul>
            <p><strong>Focus Indicators:</strong> Validated against adjacent colors (inset vs outset) per WCAG 1.4.11 Non-text Contrast.</p>
            <p><strong>Focus Appearance:</strong> Manual verification required for indicator size/visibility per WCAG 2.4.13 - automated contrast check completed.</p>
        </div>
        
        <div class="action-buttons">
            <button class="refresh-btn" onclick="location.reload()">
                Refresh Check
            </button>
            <button class="export-btn" onclick="exportResults()">
                Export JSON
            </button>
        </div>
        
        <script>
            // Export results as JSON
            function exportResults() {
                const result = ${JSON.stringify(result)};
                const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = \`a11y-qa-\${new Date().toISOString().split('T')[0]}.json\`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
            
            // Auto-refresh every 30 seconds in development
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                setTimeout(() => location.reload(), 30000);
            }
        </script>
    </body>
    </html>
  `;
}

/**
 * Creates and opens A11y QA page in a new window
 */
export function openA11yQA(): void {
  const result = runA11yQA();
  const html = generateA11yQAHTML(result);
  
  const newWindow = window.open('', '_blank', 'width=1200,height=800');
  if (newWindow) {
    newWindow.document.write(html);
    newWindow.document.close();
  }
}
