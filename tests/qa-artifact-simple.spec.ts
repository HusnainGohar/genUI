import { describe, it, expect } from 'vitest';
import { 
  generateThemeQAArtifact, 
  generateQAArtifactFromResult,
  type ThemeAdjustmentLog 
} from '../src/a11y/theme-qa-artifact.js';
import { sanitizeThemeTokens } from '../src/a11y/theme-guard.js';

describe('QA Artifact Generator - Simple Tests', () => {
  it('should generate artifact from empty logs', () => {
    const artifact = generateThemeQAArtifact([]);
    
    expect(artifact.profileType).toBe('none');
    expect(artifact.severity).toBe(0);
    expect(artifact.guardAdjustedTokens).toEqual([]);
    expect(artifact.wcagCompliance.totalChecks).toBe(0);
  });

  it('should calculate accurate totals from real data', () => {
    const mockLogs: ThemeAdjustmentLog[] = [
      {
        profileType: 'test-profile',
        severity: 0.5,
        guardAdjustedTokens: ['--text-primary'],
        adjustments: [
          {
            semanticPair: '--text-primary vs --bg-primary',
            adjustedColor: 'fg',
            ratio: 4.6,
            clamped: false,
            thresholdUsed: 4.5,
            thresholdType: 'normal-text'
          }
        ],
        originalTokens: { '--text-primary': '#666666' },
        finalTokens: { '--text-primary': '#767676' },
        timestamp: Date.now()
      }
    ];

    const artifact = generateThemeQAArtifact(mockLogs);
    
    expect(artifact.profileType).toBe('test-profile');
    expect(artifact.wcagCompliance.totalChecks).toBe(1); // Real count
    expect(artifact.wcagCompliance.violations).toBe(0); // Ratio meets threshold
    expect(artifact.wcagCompliance.adjustments).toBe(1);
  });

  it('should count violations using actual thresholds', () => {
    const mockLogs: ThemeAdjustmentLog[] = [
      {
        profileType: 'test-profile',
        severity: 0.5,
        guardAdjustedTokens: ['--text-primary'],
        adjustments: [
          {
            semanticPair: '--text-primary vs --bg-primary',
            adjustedColor: 'fg',
            ratio: 4.3, // Below 4.5 threshold
            clamped: true,
            thresholdUsed: 4.5,
            thresholdType: 'normal-text'
          }
        ],
        originalTokens: { '--text-primary': '#666666' },
        finalTokens: { '--text-primary': '#666666' },
        timestamp: Date.now()
      }
    ];

    const artifact = generateThemeQAArtifact(mockLogs);
    
    expect(artifact.wcagCompliance.violations).toBe(1); // Below threshold
    expect(artifact.wcagCompliance.clamped).toBe(1);
  });

  it('should generate markdown from ThemeGuardResult', () => {
    const mockTokens = {
      '--text-primary': '#ffffff',
      '--bg-primary': '#000000'
    };

    const result = sanitizeThemeTokens(mockTokens, {
      logAdjustments: true,
      largeTextContext: { fontSize: 16, fontWeight: 400 }
    });

    const markdown = generateQAArtifactFromResult(result, 'test-profile', 0.5);
    
    // Basic structure checks
    expect(markdown).toContain('# Theme QA Report');
    expect(markdown).toContain('**Type**: test-profile');
    expect(markdown).toContain('## WCAG 2.2 AA Compliance');
    expect(markdown).toContain('### Success Criteria Coverage');
    
    // Check that it contains the main sections
    expect(markdown).toContain('## Manual Review Required');
    expect(markdown).toContain('## Action Items');
    
    // Check that it contains WCAG 2.2 AA criteria
    expect(markdown).toContain('SC 2.4.11');
    expect(markdown).toContain('SC 2.4.12');
    expect(markdown).toContain('SC 2.5.7');
    expect(markdown).toContain('SC 2.5.8');
    expect(markdown).toContain('SC 3.2.6');
    expect(markdown).toContain('SC 3.3.7');
    expect(markdown).toContain('SC 3.3.8');
  });

  it('should include Focus Not Obscured section', () => {
    const mockTokens = {
      '--text-primary': '#ffffff',
      '--bg-primary': '#000000'
    };

    const result = sanitizeThemeTokens(mockTokens, { logAdjustments: true });
    const markdown = generateQAArtifactFromResult(result, 'test-profile', 0.5);
    
    expect(markdown).toContain('### SC 2.4.11 Focus Not Obscured');
    expect(markdown).toContain('**Focus indicators must not be entirely hidden**');
    expect(markdown).toContain('WCAG 2.2 AA Levels');
    expect(markdown).toContain('SC 2.4.11 (Minimum)');
    expect(markdown).toContain('SC 2.4.12 (Enhanced)');
  });

  it('should include Focus Appearance requirements', () => {
    const mockTokens = {
      '--text-primary': '#ffffff',
      '--bg-primary': '#000000'
    };

    const result = sanitizeThemeTokens(mockTokens, { logAdjustments: true });
    const markdown = generateQAArtifactFromResult(result, 'test-profile', 0.5);
    
    expect(markdown).toContain('### SC 2.4.13 Focus Appearance');
    expect(markdown).toContain('**Focus Appearance Requirements**:');
    expect(markdown).toContain('**Size**: Focus indicator must be at least **2 CSS pixels thick**');
    expect(markdown).toContain('**Contrast**: Focus indicator must have **≥3:1 contrast**');
    expect(markdown).toContain('**Change**: Must show **≥3:1 change**');
  });
});
