/**
 * Theme Guard Usage Examples
 * 
 * Examples showing how to integrate the theme guard into your application
 */

import { 
  applyThemeWithGuard, 
  sanitizeThemeTokens, 
  useThemeGuard,
  createThemeGuard,
  generateThemeGuardSummary,
  type ThemeGuardResult
} from '../src/a11y/theme-guard.js';
import { openA11yQA } from '../src/a11y/a11y-qa.js';
import { createThemeGuardToast, createThemeGuardBadge } from '../src/a11y/theme-guard-ui.js';
import { saveThemeQAArtifact, generateQAArtifactFromResult } from '../src/a11y/theme-qa-artifact.js';

// Example 1: Basic theme application with guard and UI feedback
export function applyThemeExample() {
  const tokens = {
    '--bg-primary': '#0B0B0B',
    '--text-primary': '#F2F2F2',
    '--text-secondary': '#9AA0A6',
    '--accent': '#4F8FF7',
    '--border-primary': '#3C4043',
    '--focus-ring': '#4285F4',
    '--focus-ring-inset': '#4285F4', // Focus ring inside elements
    '--focus-ring-outset': '#4285F4', // Focus ring outside elements
    '--bg-button': '#1A73E8',
    '--text-heading': '#E8EAED'
  };
  
  const result = applyThemeWithGuard(tokens, {
    logAdjustments: true,
    preferForegroundAdjust: false
  });
  
  // Show UI notification based on result
  if (result.status === 'fail') {
    // Show toast for critical issues
    const toast = createThemeGuardToast(result);
    document.body.appendChild(toast);
  } else if (result.status === 'warnings') {
    // Show badge for adjustments made
    const badge = createThemeGuardBadge(result);
    document.body.appendChild(badge);
  }
  
  console.log('Theme applied:', result.applied);
  console.log('Status:', result.status);
  console.log('Summary:', result.summary);
  console.log('Adjustments made:', result.adjustments);
  console.log('Violations:', result.violations);
  
  return result;
}

// Example 2: React hook usage with UI feedback and auto-updating badges
export function ReactThemeExample() {
  const { applyTheme, sanitizeTheme, lastResult, subscribe, bypassGuard } = useThemeGuard({
    logAdjustments: process.env.NODE_ENV === 'development',
    preferBackgroundAdjust: true
  });
  
  // Auto-updating badge for continuous feedback
  let currentBadge: HTMLElement | null = null;
  
  const handleThemeChange = (newTokens: Record<string, string>) => {
    const result = applyTheme(newTokens);
    
    // Show UI feedback based on result
    if (result.status === 'fail') {
      const toast = createThemeGuardToast(result);
      document.body.appendChild(toast);
    } else if (result.status === 'warnings' && result.summary.adjustments > 0) {
      // Remove existing badge if present
      if (currentBadge) {
        currentBadge.remove();
      }
      
      const badge = createThemeGuardBadge(result);
      document.body.appendChild(badge);
      currentBadge = badge;
    }
    
    return result;
  };
  
  // Subscribe to theme changes for automatic badge updates
  const unsubscribe = subscribe((result) => {
    // Update badge automatically when theme changes
    if (result.status === 'warnings' && result.summary.adjustments > 0) {
      if (currentBadge) {
        currentBadge.remove();
      }
      
      const badge = createThemeGuardBadge(result);
      document.body.appendChild(badge);
      currentBadge = badge;
    } else if (result.status === 'pass' && currentBadge) {
      // Remove badge when theme becomes fully accessible
      currentBadge.remove();
      currentBadge = null;
    }
  });
  
  return { 
    handleThemeChange, 
    bypassGuard, 
    lastResult,
    subscribe,
    unsubscribe,
    // Helper to check if theme is accessible
    isAccessible: () => (lastResult as ThemeGuardResult | null)?.status === 'pass',
    // Helper to get violation count
    getViolationCount: () => (lastResult as ThemeGuardResult | null)?.summary?.violations || 0
  };
}

// Example 3: Vanilla JS usage
export function VanillaJSExample() {
  const themeGuard = createThemeGuard({
    bypassGuard: false,
    logAdjustments: true
  });
  
  // Apply theme with automatic sanitization
  const result = themeGuard.apply({
    '--bg-primary': '#FFFFFF',
    '--text-primary': '#CCCCCC', // This will fail contrast check
    '--border-primary': '#DDDDDD'
  });
  
  console.log('Sanitized tokens:', result.sanitizedTokens);
  
  return result;
}

// Example 4: Development mode with A11y QA
export function developmentModeExample() {
  const tokens = {
    '--bg-primary': '#1A1A1A',
    '--text-primary': '#E0E0E0',
    '--text-secondary': '#B0B0B0',
    '--accent': '#FF6B6B',
    '--border-primary': '#404040',
    '--focus-ring': '#FFD93D',
    '--bg-button': '#4ECDC4',
    '--text-heading': '#FFFFFF'
  };
  
  // Apply theme with guard
  const result = applyThemeWithGuard(tokens, {
    logAdjustments: true
  });
  
  // Open A11y QA page for visual verification
  if (process.env.NODE_ENV === 'development') {
    setTimeout(() => {
      openA11yQA();
    }, 1000);
  }
  
  return result;
}

// Example 5: Theme switching with user preferences
export function themeSwitchingExample() {
  const themes = {
    light: {
      '--bg-primary': '#FFFFFF',
      '--text-primary': '#000000',
      '--text-secondary': '#666666',
      '--accent': '#007BFF',
      '--border-primary': '#E0E0E0',
      '--focus-ring': '#0056B3',
      '--bg-button': '#F8F9FA',
      '--text-heading': '#212529'
    },
    dark: {
      '--bg-primary': '#121212',
      '--text-primary': '#FFFFFF',
      '--text-secondary': '#B3B3B3',
      '--accent': '#BB86FC',
      '--border-primary': '#333333',
      '--focus-ring': '#CF6679',
      '--bg-button': '#1F1F1F',
      '--text-heading': '#FFFFFF'
    },
    highContrast: {
      '--bg-primary': '#000000',
      '--text-primary': '#FFFFFF',
      '--text-secondary': '#FFFFFF',
      '--accent': '#FFFF00',
      '--border-primary': '#FFFFFF',
      '--focus-ring': '#FFFF00',
      '--bg-button': '#000000',
      '--text-heading': '#FFFFFF'
    }
  };
  
  const applyTheme = (themeName: keyof typeof themes) => {
    const tokens = themes[themeName];
    const result = applyThemeWithGuard(tokens, {
      logAdjustments: true,
      preferForegroundAdjust: themeName === 'highContrast'
    });
    
    console.log(`Applied ${themeName} theme:`, result);
    return result;
  };
  
  return { applyTheme, themes };
}

// Helper function to extract token names from semantic pairs
function extractAdjustedTokens(adjustments: Array<{
  semanticPair: string;
  adjustedColor: 'fg' | 'bg';
}>) {
  const adjustedTokens = new Set<string>();
  
  adjustments.forEach(adj => {
    // Parse semantic pair format: "--token-name vs --other-token"
    const parts = adj.semanticPair.split(' vs ');
    if (parts.length === 2) {
      const fgToken = parts[0].trim();
      const bgToken = parts[1].trim();
      
      if (adj.adjustedColor === 'fg') {
        adjustedTokens.add(fgToken);
      } else if (adj.adjustedColor === 'bg') {
        adjustedTokens.add(bgToken);
      }
    }
  });
  
  return Array.from(adjustedTokens);
}

// Example 6: Integration with color screening results and severity logging
export function personalizedThemeExample() {
  // Load user's color screening results
  const sessionData = JSON.parse(localStorage.getItem('colorScreening_session') || '{}');
  const profile = sessionData.profile;
  
  let baseTokens = {
    '--bg-primary': '#FFFFFF',
    '--text-primary': '#000000',
    '--text-secondary': '#666666',
    '--accent': '#007BFF',
    '--border-primary': '#E0E0E0',
    '--focus-ring': '#0056B3',
    '--focus-ring-inset': '#0056B3',
    '--focus-ring-outset': '#0056B3',
    '--bg-button': '#F8F9FA',
    '--text-heading': '#212529'
  };
  
  // Adjust colors based on user's color vision profile
  if (profile?.type === 'protan') {
    // Enhance red-green contrast for protanopia
    baseTokens['--accent'] = '#00BFFF';
    baseTokens['--focus-ring'] = '#0080FF';
    baseTokens['--focus-ring-inset'] = '#0080FF';
    baseTokens['--focus-ring-outset'] = '#0080FF';
  } else if (profile?.type === 'deutan') {
    // Enhance red-green contrast for deuteranopia
    baseTokens['--accent'] = '#FF8000';
    baseTokens['--focus-ring'] = '#FF4000';
    baseTokens['--focus-ring-inset'] = '#FF4000';
    baseTokens['--focus-ring-outset'] = '#FF4000';
  } else if (profile?.type === 'tritan') {
    // Enhance blue-yellow contrast for tritanopia
    baseTokens['--accent'] = '#FF0080';
    baseTokens['--focus-ring'] = '#FF0040';
    baseTokens['--focus-ring-inset'] = '#FF0040';
    baseTokens['--focus-ring-outset'] = '#FF0040';
  }
  
  // Apply personalized theme with guard
  const result = applyThemeWithGuard(baseTokens, {
    logAdjustments: true,
    preferForegroundAdjust: profile?.severity && profile.severity > 0.5
  });
  
  // Log severity-based adjustments for future profile tuning
  if (result.adjustments.length > 0 && profile?.severity) {
    // Identify which tokens were adjusted by the guard after profile-based presetting
    const adjustedTokens = extractAdjustedTokens(result.adjustments);
    
    const severityLog = {
      profileType: profile.type,
      severity: profile.severity,
      // Note which tokens were adjusted by guard after profile presetting
      guardAdjustedTokens: Array.from(adjustedTokens),
      adjustments: result.adjustments.map(adj => ({
        semanticPair: adj.semanticPair,
        adjustedColor: adj.adjustedColor,
        ratio: adj.ratio,
        clamped: adj.clamped
      })),
      // Original profile-based tokens for comparison
      originalTokens: baseTokens,
      // Final sanitized tokens
      finalTokens: result.sanitizedTokens,
      timestamp: Date.now()
    };
    
    // Store for future profile refinement
    const existingLogs = JSON.parse(localStorage.getItem('themeAdjustmentLogs') || '[]');
    existingLogs.push(severityLog);
    localStorage.setItem('themeAdjustmentLogs', JSON.stringify(existingLogs));
    
    console.log('Severity-based adjustments logged:', severityLog);
    console.log(`Guard adjusted ${adjustedTokens.length} tokens after profile presetting:`, adjustedTokens);
    
    // Log specific recommendations for future defaults
    if (adjustedTokens.length > 0) {
      console.log('Recommendations for future defaults:');
      adjustedTokens.forEach(token => {
        const originalValue = baseTokens[token];
        const finalValue = result.sanitizedTokens[token];
        console.log(`  ${token}: ${originalValue} → ${finalValue} (consider updating default)`);
      });
    }
    
    // Generate QA artifact for PR review
    try {
      // Generate artifact from current result with profile info
      const qaMarkdown = generateQAArtifactFromResult(result, profile?.type || 'none', profile?.severity || 0);
      const summary = generateThemeGuardSummary(result);
      
      console.log('QA Artifact generated for PR review:');
      console.log('---');
      console.log(qaMarkdown);
      console.log('---');
      
      // Compact summary for quick review
      console.log('Theme Guard Summary:');
      console.log(`  ${summary.wcagCompliance}`);
      console.log(`  ${summary.focusRingStatus}`);
      if (summary.recommendations.length > 0) {
        console.log('  Recommendations:');
        summary.recommendations.forEach(rec => console.log(`    • ${rec}`));
      }
      
      // Also save to localStorage for historical tracking
      saveThemeQAArtifact();
    } catch (error) {
      console.warn('Failed to generate QA artifact:', error);
    }
  }
  
  // Show UI feedback
  if (result.status === 'fail') {
    const toast = createThemeGuardToast(result);
    document.body.appendChild(toast);
  } else if (result.status === 'warnings') {
    const badge = createThemeGuardBadge(result);
    document.body.appendChild(badge);
  }
  
  console.log('Personalized theme applied:', result);
  return result;
}
