/**
 * Theme QA Artifact Generator
 * 
 * Generates structured artifacts for PR review and default evolution tracking
 */

import { generateThemeGuardSummary, generateSCValidationSummary, type ThemeGuardResult } from './theme-guard.js';

export interface ThemeQAArtifact {
  timestamp: string;
  profileType: string;
  severity: number;
  guardAdjustedTokens: string[];
  recommendations: Array<{
    token: string;
    originalValue: string;
    finalValue: string;
    reason: string;
  }>;
  wcagCompliance: {
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
}

export interface ThemeAdjustmentLog {
  profileType: string;
  severity: number;
  guardAdjustedTokens: string[];
  adjustments: Array<{
    semanticPair: string;
    adjustedColor: 'fg' | 'bg';
    ratio: number;
    clamped: boolean;
    thresholdUsed: number; // Actual threshold used for this pair (3.0 or 4.5)
    thresholdType: 'normal-text' | 'large-text' | 'ui-component' | 'focus-indicator';
  }>;
  originalTokens: Record<string, string>;
  finalTokens: Record<string, string>;
  timestamp: number;
}

/**
 * Generates a QA artifact from theme adjustment logs
 * 
 * @param logs - Array of theme adjustment logs
 * @param totalChecksOverride - Optional override for total checks count (for accuracy)
 */
export function generateThemeQAArtifact(logs: ThemeAdjustmentLog[], totalChecksOverride?: number): ThemeQAArtifact {
  if (logs.length === 0) {
    return {
      timestamp: new Date().toISOString(),
      profileType: 'none',
      severity: 0,
      guardAdjustedTokens: [],
      recommendations: [],
      wcagCompliance: {
        totalChecks: 0,
        violations: 0,
        adjustments: 0,
        clamped: 0
      },
      focusRingValidation: {
        insetValidated: false,
        outsetValidated: false,
        warnings: []
      }
    };
  }

  // Aggregate data from all logs
  const allAdjustedTokens = new Set<string>();
  const recommendations: Array<{
    token: string;
    originalValue: string;
    finalValue: string;
    reason: string;
  }> = [];
  
  let totalViolations = 0;
  let totalAdjustments = 0;
  let totalClamped = 0;
  
  const focusRingWarnings: string[] = [];
  let insetValidated = false;
  let outsetValidated = false;

  logs.forEach(log => {
    // Collect adjusted tokens
    log.guardAdjustedTokens.forEach(token => allAdjustedTokens.add(token));
    
    // Generate recommendations
    log.guardAdjustedTokens.forEach(token => {
      const originalValue = log.originalTokens[token];
      const finalValue = log.finalTokens[token];
      
      if (originalValue && finalValue && originalValue !== finalValue) {
        recommendations.push({
          token,
          originalValue,
          finalValue,
          reason: getAdjustmentReason(token, log.adjustments)
        });
      }
    });
    
    // Aggregate compliance metrics
    log.adjustments.forEach(adj => {
      totalAdjustments++;
      if (adj.clamped) totalClamped++;
      // Use actual threshold per pair for accurate violation counting
      if (adj.ratio < adj.thresholdUsed) totalViolations++;
    });
    
    // Check focus ring validation
    const hasInset = Object.keys(log.originalTokens).some(key => key.includes('focus-ring-inset'));
    const hasOutset = Object.keys(log.originalTokens).some(key => key.includes('focus-ring-outset'));
    
    if (hasInset) insetValidated = true;
    if (hasOutset) outsetValidated = true;
    
    // Check for focus ring warnings
    log.adjustments.forEach(adj => {
      if (adj.semanticPair.includes('focus-ring') && adj.clamped) {
        focusRingWarnings.push(`Focus ring ${adj.semanticPair} clamped at ${adj.ratio.toFixed(2)}:1`);
      }
    });
  });

  // Use the most recent log for profile info
  const latestLog = logs[logs.length - 1];
  
  // Calculate accurate total checks
  const actualTotalChecks = totalChecksOverride ?? 
    logs.reduce((sum, log) => sum + log.adjustments.length, 0);
  
  return {
    timestamp: new Date().toISOString(),
    profileType: latestLog.profileType,
    severity: latestLog.severity,
    guardAdjustedTokens: Array.from(allAdjustedTokens),
    recommendations,
    wcagCompliance: {
      totalChecks: actualTotalChecks,
      violations: totalViolations,
      adjustments: totalAdjustments,
      clamped: totalClamped
    },
    focusRingValidation: {
      insetValidated,
      outsetValidated,
      warnings: focusRingWarnings
    }
  };
}

/**
 * Generates markdown report for PR review
 */
export function generateThemeQAMarkdown(artifact: ThemeQAArtifact & { 
  summary?: { wcagCompliance: string; focusRingStatus: string; recommendations: string[] };
  scValidation?: { sc143: { status: string; details: string }; sc1411: { status: string; details: string }; sc247: { status: string; details: string }; sc2413: { status: string; details: string } };
}): string {
  const { profileType, severity, guardAdjustedTokens, recommendations, wcagCompliance, focusRingValidation, summary, scValidation } = artifact;
  
  return `# Theme QA Report

## Profile Information
- **Type**: ${profileType}
- **Severity**: ${severity.toFixed(2)}
- **Generated**: ${artifact.timestamp}

## WCAG 2.2 AA Compliance
- **Total Checks**: ${wcagCompliance.totalChecks}
- **Violations**: ${wcagCompliance.violations}
- **Adjustments Made**: ${wcagCompliance.adjustments}
- **Clamped (Couldn't Fix)**: ${wcagCompliance.clamped}

### Success Criteria Coverage
#### Color & Contrast (Automated)
- **SC 1.4.3**: Text contrast (4.5:1 normal, 3:1 large text) ✅ *Checked*
- **SC 1.4.11**: Non-text contrast (3:1 for UI components) ✅ *Checked*
- **SC 2.4.7**: Focus indicators visible and accessible ✅ *Checked*
- **SC 2.4.13**: Focus appearance (size/area) ⚠️ *Manual review required*

#### New in WCAG 2.2 AA (Out of Scope)
- **SC 2.4.11**: Focus Not Obscured (Minimum) - focused item not entirely hidden by author content ⚠️ *Manual review required*
- **SC 2.4.12**: Focus Not Obscured (Enhanced) - no part of focused item hidden by author content ⚠️ *Manual review required*
- **SC 2.5.7**: Dragging Movements - dragging is not the only way to achieve a function ⚠️ *Manual review required*
- **SC 2.5.8**: Target Size (Minimum) - targets ≥ 24×24 CSS px or meet exceptions ⚠️ *Manual review required*
- **SC 3.2.6**: Consistent Help - help is available in the same relative order on all pages ⚠️ *Manual review required*
- **SC 3.3.7**: Redundant Entry - information previously entered is auto-populated or available ⚠️ *Manual review required*
- **SC 3.3.8**: Accessible Authentication - authentication does not rely on cognitive function tests ⚠️ *Manual review required*

**Note**: This artifact covers color/contrast and focus contrast validation only. Other WCAG 2.2 AA criteria require separate verification.

## Detailed SC Validation Results
${scValidation ? `
### SC 1.4.3 Text Contrast
**Status**: ${scValidation.sc143.status}
**Details**: ${scValidation.sc143.details}

### SC 1.4.11 Non-text Contrast
**Status**: ${scValidation.sc1411.status}
**Details**: ${scValidation.sc1411.details}

### SC 2.4.7 Focus Indicators
**Status**: ${scValidation.sc247.status}
**Details**: ${scValidation.sc247.details}

### SC 2.4.13 Focus Appearance
**Status**: ${scValidation.sc2413.status}
**Details**: ${scValidation.sc2413.details}
` : ''}

## Guard-Adjusted Tokens
${guardAdjustedTokens.length > 0 ? 
  guardAdjustedTokens.map(token => `- \`${token}\``).join('\n') : 
  'No tokens were adjusted by the guard ✅'
}

## Recommendations for Default Updates
${recommendations.length > 0 ? 
  recommendations.map(rec => 
    `- **${rec.token}**: \`${rec.originalValue}\` → \`${rec.finalValue}\` (${rec.reason})`
  ).join('\n') : 
  'No recommendations - all defaults are optimal ✅'
}

## Adjustment Log References
${recommendations.length > 0 ? 
  `For detailed adjustment information, refer to the following entries in the theme guard adjustment log:

${recommendations.map((rec, index) => 
  `**Adjustment #${index + 1}**: ${rec.token}
- Original: \`${rec.originalValue}\`
- Final: \`${rec.finalValue}\`
- Reason: ${rec.reason.split(' (Adjustment #')[0]}
- Threshold Used: ${rec.reason.includes('3:1') ? '3:1 (large text/UI)' : '4.5:1 (normal text)'}
`).join('\n')}` : 
  'No adjustments made - no log references needed ✅'
}

## Focus Ring Validation (SC 1.4.11)
- **Inset Focus Rings**: ${focusRingValidation.insetValidated ? '✅ Validated against component backgrounds' : '❌ Not validated'}
- **Outset Focus Rings**: ${focusRingValidation.outsetValidated ? '✅ Validated against page backgrounds' : '❌ Not validated'}
${focusRingValidation.warnings.length > 0 ? 
  `\n**Validation Warnings**:\n${focusRingValidation.warnings.map(w => `- ${w}`).join('\n')}` : 
  ''
}

## Manual Review Required
### SC 2.4.13 Focus Appearance
While contrast ratios are validated automatically, **focus indicator size and area** require manual verification:
- Focus indicators must be **at least 2px thick** (or equivalent area)
- Focus indicators must have **sufficient area** to be clearly visible
- Consider **focus indicator design patterns** for different component types

**Note**: This automated check validates contrast (SC 1.4.11) but cannot measure physical dimensions. Manual review of focus appearance is required for full WCAG 2.2 AA compliance.

**Focus Appearance Requirements**:
- **Size**: Focus indicator must be at least **2 CSS pixels thick** (or equivalent area)
- **Contrast**: Focus indicator must have **≥3:1 contrast** against adjacent colors (SC 1.4.11)
- **Change**: Must show **≥3:1 change** between focused and unfocused states
- **Area**: Focus indicator area must be **clearly visible** and distinguishable

### SC 2.4.11 Focus Not Obscured
**Focus indicators must not be entirely hidden** by other content:
- Focus indicators should not be **entirely hidden by sticky headers/footers**
- Focus indicators should not be **entirely hidden by overlays or modals**
- Focus indicators should remain **not entirely hidden during scrolling**
- Consider **focus indicator positioning** relative to fixed elements
- **Common failures**: Sticky navigation bars, floating action buttons, modal overlays

**Note**: This is separate from contrast validation and requires manual testing of focus visibility across different screen sizes and scroll positions. The criterion requires that focused items are "not entirely hidden" by author content.

**WCAG 2.2 AA Levels**:
- **SC 2.4.11 (Minimum)**: Focused item not entirely hidden - at least part must be visible
- **SC 2.4.12 (Enhanced)**: No part of focused item hidden - complete visibility required

## Theme Guard Summary
${summary ? 
  `### WCAG Compliance
${summary.wcagCompliance}

### Focus Ring Validation
${summary.focusRingStatus}

### Recommendations
${summary.recommendations.length > 0 ? 
  summary.recommendations.map(rec => `- ${rec}`).join('\n') : 
  'No specific recommendations'
}` : 
  ''
}

## Action Items
${guardAdjustedTokens.length > 0 ? 
  `1. **Update Defaults**: Consider updating the following tokens in profile-based defaults:
   ${guardAdjustedTokens.map(token => `\`${token}\``).join(', ')}
2. **Test Coverage**: Add tests for the adjusted token combinations
3. **Documentation**: Update theme documentation with new default values` : 
  '✅ No action items - theme defaults are optimal'
}

---
*Generated by GenUI-CB Theme Guard QA System*
`;
}

/**
 * Generates QA artifact from ThemeGuardResult
 */
export function generateQAArtifactFromResult(result: ThemeGuardResult, profileType: string = 'none', severity: number = 0): string {
  const summary = generateThemeGuardSummary(result);
  const scValidation = generateSCValidationSummary(result);
  
  const artifact = {
    timestamp: new Date().toISOString(),
    profileType,
    severity,
    guardAdjustedTokens: result.adjustments
      .filter(a => !a.clamped)
      .map(a => a.semanticPair.split(' vs ')[0])
      .filter((token, index, arr) => arr.indexOf(token) === index), // dedupe
    recommendations: result.adjustments
      .filter(a => !a.clamped)
      .map((a, index) => ({
        token: a.semanticPair.split(' vs ')[0],
        originalValue: a.original,
        finalValue: a.adjusted,
        reason: `${getAdjustmentReason(a.semanticPair.split(' vs ')[0], [a])} (Adjustment #${index + 1})`
      })),
    wcagCompliance: {
      totalChecks: result.summary.totalChecks,
      violations: result.summary.violations,
      adjustments: result.summary.adjustments,
      clamped: result.summary.clamped
    },
    focusRingValidation: result.focusRingValidation,
    summary: {
      wcagCompliance: summary.wcagCompliance,
      focusRingStatus: summary.focusRingStatus,
      recommendations: summary.recommendations
    },
    scValidation
  };
  
  return generateThemeQAMarkdown(artifact);
}

/**
 * Saves QA artifact to localStorage and returns markdown
 * 
 * @param totalChecksOverride - Optional override for total checks count (for accuracy)
 */
export function saveThemeQAArtifact(totalChecksOverride?: number): string {
  const logs = JSON.parse(localStorage.getItem('themeAdjustmentLogs') || '[]');
  const artifact = generateThemeQAArtifact(logs, totalChecksOverride);
  const markdown = generateThemeQAMarkdown(artifact);
  
  // Save artifact to localStorage
  localStorage.setItem('themeQAArtifact', JSON.stringify(artifact));
  
  // Also save markdown for easy copy-paste
  localStorage.setItem('themeQAMarkdown', markdown);
  
  return markdown;
}

/**
 * Helper function to determine adjustment reason
 */
function getAdjustmentReason(token: string, adjustments: Array<{
  semanticPair: string;
  adjustedColor: 'fg' | 'bg';
  ratio: number;
  clamped: boolean;
  thresholdUsed: number;
  thresholdType: 'normal-text' | 'large-text' | 'ui-component' | 'focus-indicator';
}>): string {
  const relevantAdjustment = adjustments.find(adj => 
    adj.semanticPair.includes(token)
  );
  
  if (!relevantAdjustment) return 'Unknown reason';
  
  if (relevantAdjustment.clamped) {
    return `Clamped at ${relevantAdjustment.ratio.toFixed(2)}:1 (couldn't meet ${relevantAdjustment.thresholdUsed}:1 threshold)`;
  }
  
  // Use threshold type for precise reason
  switch (relevantAdjustment.thresholdType) {
    case 'focus-indicator':
      return `Focus ring contrast adjustment for WCAG 1.4.11 (${relevantAdjustment.thresholdUsed}:1 threshold)`;
    case 'normal-text':
      return `Text contrast adjustment for WCAG 1.4.3 (${relevantAdjustment.thresholdUsed}:1 threshold)`;
    case 'large-text':
      return `Large text contrast adjustment for WCAG 1.4.3 (${relevantAdjustment.thresholdUsed}:1 threshold)`;
    case 'ui-component':
      return `UI component contrast adjustment for WCAG 1.4.11 (${relevantAdjustment.thresholdUsed}:1 threshold)`;
    default:
      return `Contrast adjustment for WCAG compliance (${relevantAdjustment.thresholdUsed}:1 threshold)`;
  }
}
