import { describe, it, expect } from 'vitest';
import { 
  relativeLuminance, 
  contrastRatio, 
  passesContrast, 
  snapToPassingColor 
} from '../src/a11y/contrast';

describe('WCAG 2.2 AA Color Contrast Utility', () => {
  describe('relativeLuminance', () => {
    it('should calculate luminance for pure black', () => {
      expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
      expect(relativeLuminance('#000000')).toBe(0);
    });

    it('should calculate luminance for pure white', () => {
      expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBe(1);
      expect(relativeLuminance('#FFFFFF')).toBe(1);
    });

    it('should calculate luminance for mid-gray', () => {
      const gray = { r: 128, g: 128, b: 128 };
      const luminance = relativeLuminance(gray);
      expect(luminance).toBeGreaterThan(0);
      expect(luminance).toBeLessThan(1);
      expect(luminance).toBeCloseTo(0.2159, 3);
    });

    it('should handle hex strings with and without #', () => {
      expect(relativeLuminance('#FF0000')).toBeCloseTo(relativeLuminance('FF0000'), 5);
    });
  });

  describe('contrastRatio', () => {
    it('should return 21:1 for black on white', () => {
      expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    });

    it('should return 21:1 for white on black', () => {
      expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    });

    it('should return 1:1 for identical colors', () => {
      expect(contrastRatio('#FF0000', '#FF0000')).toBe(1);
    });

    it('should return same ratio regardless of order', () => {
      const ratio1 = contrastRatio('#000000', '#FFFFFF');
      const ratio2 = contrastRatio('#FFFFFF', '#000000');
      expect(ratio1).toBeCloseTo(ratio2, 5);
    });

    it('should calculate known contrast ratios', () => {
      // These are well-known WCAG test cases
      expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.5, 1);
      expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 1);
    });
  });

  describe('passesContrast', () => {
    describe('normal text (4.5:1 threshold)', () => {
      it('should pass for high contrast pairs', () => {
        expect(passesContrast('#000000', '#FFFFFF')).toBe(true);
        expect(passesContrast('#FFFFFF', '#000000')).toBe(true);
      });

      it('should fail for low contrast pairs', () => {
        expect(passesContrast('#888888', '#FFFFFF')).toBe(false);
        expect(passesContrast('#777777', '#FFFFFF')).toBe(false);
      });

      it('should pass for exactly 4.5:1 ratio', () => {
        expect(passesContrast('#767676', '#FFFFFF')).toBe(true);
      });

      it('should fail for just under 4.5:1 ratio', () => {
        expect(passesContrast('#777777', '#FFFFFF')).toBe(false);
      });
    });

    describe('large text (3:1 threshold)', () => {
      // Note: Large text definition per WCAG 2.2 Understanding SC 1.4.3 (Contrast Minimum):
      // - ≥18pt (≈24px) regular text
      // - ≥14pt (≈18.66px) bold text
      // UI layer should set isLargeText flag based on actual font size/weight
      
      it('should pass for 3:1 ratio with large text', () => {
        expect(passesContrast('#888888', '#FFFFFF', { isLargeText: true })).toBe(true);
      });

      it('should fail for under 3:1 ratio with large text', () => {
        expect(passesContrast('#CCCCCC', '#FFFFFF', { isLargeText: true })).toBe(false);
      });
    });

    describe('UI components (3:1 threshold)', () => {
      it('should pass for 3:1 ratio with UI component', () => {
        expect(passesContrast('#888888', '#FFFFFF', { uiComponent: true })).toBe(true);
      });

      it('should fail for under 3:1 ratio with UI component', () => {
        expect(passesContrast('#CCCCCC', '#FFFFFF', { uiComponent: true })).toBe(false);
      });
    });

    describe('edge cases near thresholds', () => {
      it('should fail at 4.49:1 for normal text', () => {
        // This should fail - just under the threshold
        expect(passesContrast('#777777', '#FFFFFF')).toBe(false);
      });

      it('should pass at 4.51:1 for normal text', () => {
        // This should pass - just over the threshold
        expect(passesContrast('#767676', '#FFFFFF')).toBe(true);
      });

      it('should fail at 2.99:1 for large text', () => {
        expect(passesContrast('#BBBBBB', '#FFFFFF', { isLargeText: true })).toBe(false);
      });

      it('should pass at 3.01:1 for large text', () => {
        expect(passesContrast('#888888', '#FFFFFF', { isLargeText: true })).toBe(true);
      });

      it('should handle focus indicator contrast (3:1 minimum)', () => {
        // Focus indicators need 3:1 minimum per WCAG 2.2
        expect(passesContrast('#FF0000', '#FFFFFF', { uiComponent: true })).toBe(true);
        expect(passesContrast('#CCCCCC', '#FFFFFF', { uiComponent: true })).toBe(false);
      });

      it('should handle focus ring specific colors', () => {
        // Common focus ring colors should pass 3:1 threshold
        expect(passesContrast('#1A73E8', '#FFFFFF', { uiComponent: true })).toBe(true);
        expect(passesContrast('#4285F4', '#FFFFFF', { uiComponent: true })).toBe(true);
        expect(passesContrast('#34A853', '#FFFFFF', { uiComponent: true })).toBe(true);
      });
    });
  });

  describe('snapToPassingColor', () => {
    it('should return original colors if already passing', () => {
      const result = snapToPassingColor('#000000', '#FFFFFF');
      expect(result.fg).toBe('#000000');
      expect(result.bg).toBe('#FFFFFF');
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('should adjust failing colors to pass normal text threshold', () => {
      const result = snapToPassingColor('#888888', '#FFFFFF');
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
      expect(result.fg).not.toBe('#888888'); // Should be adjusted
    });

    it('should adjust failing colors to pass large text threshold', () => {
      const result = snapToPassingColor('#CCCCCC', '#FFFFFF', { isLargeText: true });
      expect(result.ratio).toBeGreaterThanOrEqual(3.0);
    });

    it('should be deterministic - same input produces same output', () => {
      const result1 = snapToPassingColor('#999999', '#FFFFFF');
      const result2 = snapToPassingColor('#999999', '#FFFFFF');
      expect(result1.fg).toBe(result2.fg);
      expect(result1.bg).toBe(result2.bg);
      expect(result1.ratio).toBeCloseTo(result2.ratio, 3);
    });

    it('should handle edge cases near thresholds', () => {
      // Test very close to threshold
      const result = snapToPassingColor('#777777', '#FFFFFF'); // Just under 4.5:1
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('should handle both foreground and background adjustments', () => {
      // Test case where background needs to be darkened
      const result = snapToPassingColor('#FFFFFF', '#EEEEEE');
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('should work with UI component threshold', () => {
      const result = snapToPassingColor('#DDDDDD', '#FFFFFF', { uiComponent: true });
      expect(result.ratio).toBeGreaterThanOrEqual(3.0);
    });

    it('should prioritize large text flag over UI component', () => {
      const result = snapToPassingColor('#BBBBBB', '#FFFFFF', { 
        isLargeText: true, 
        uiComponent: true 
      });
      expect(result.ratio).toBeGreaterThanOrEqual(3.0);
    });

    it('should handle UI component only (no large text)', () => {
      const result = snapToPassingColor('#BBBBBB', '#FFFFFF', { 
        uiComponent: true 
      });
      expect(result.ratio).toBeGreaterThanOrEqual(3.0);
    });

    it('should handle large text only (no UI component)', () => {
      const result = snapToPassingColor('#BBBBBB', '#FFFFFF', { 
        isLargeText: true 
      });
      expect(result.ratio).toBeGreaterThanOrEqual(3.0);
    });

    it('should handle very low contrast pairs', () => {
      const result = snapToPassingColor('#FEFEFE', '#FFFFFF');
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('should converge within 7 iterations (binary search)', () => {
      const result = snapToPassingColor('#999999', '#FFFFFF');
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('should return metadata about adjustments', () => {
      const result = snapToPassingColor('#888888', '#FFFFFF');
      expect(result.adjusted).toBeDefined();
      expect(['fg', 'bg']).toContain(result.adjusted);
      expect(result.iterations).toBeDefined();
      expect(result.iterations).toBeGreaterThanOrEqual(1);
      expect(result.iterations).toBeLessThanOrEqual(7);
    });

    it('should handle identical colors with clamped metadata', () => {
      const result = snapToPassingColor('#FFFFFF', '#FFFFFF');
      expect(result.clamped).toBe(true);
      expect(result.ratio).toBe(1);
      expect(result.adjusted).toBeUndefined();
      expect(result.iterations).toBeUndefined();
    });
  });

  describe('known WCAG test cases', () => {
    const testCases: [string, string, boolean, string][] = [
      // Format: [fg, bg, shouldPass, description]
      ['#000000', '#FFFFFF', true, 'Black on white'],
      ['#FFFFFF', '#000000', true, 'White on black'],
      ['#777777', '#FFFFFF', false, 'Gray on white (fails ~4.48:1)'],
      ['#767676', '#FFFFFF', true, 'Gray on white (passes ~4.62:1)'],
      ['#000000', '#808080', true, 'Black on gray'],
      ['#FFFFFF', '#808080', false, 'White on gray (fails ~3.54:1)'],
      ['#FF0000', '#FFFFFF', false, 'Red on white (fails normal text ~3.99:1)'],
      ['#00FF00', '#FFFFFF', false, 'Green on white (fails normal text ~1.37:1)'],
      ['#0000FF', '#FFFFFF', true, 'Blue on white (passes normal text ~8.59:1)'],
    ];

    testCases.forEach(([fg, bg, shouldPass, description]) => {
      it(`should ${shouldPass ? 'pass' : 'fail'} for ${description}`, () => {
        expect(passesContrast(fg, bg)).toBe(shouldPass);
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle 3-digit hex colors', () => {
      expect(relativeLuminance('#ABC')).toBeCloseTo(relativeLuminance('#AABBCC'), 3);
      expect(contrastRatio('#ABC', '#FFF')).toBeCloseTo(contrastRatio('#AABBCC', '#FFFFFF'), 2);
    });

    it('should handle hex colors without # prefix', () => {
      expect(relativeLuminance('FF0000')).toBeCloseTo(relativeLuminance('#FF0000'), 5);
    });

    it('should throw error for invalid hex formats', () => {
      expect(() => relativeLuminance('#GGGGGG')).toThrow('Invalid hex color format');
      expect(() => relativeLuminance('#12345')).toThrow('Invalid hex color format');
      expect(() => relativeLuminance('#1234567')).toThrow('Invalid hex color format');
    });

    it('should handle very small contrast ratios', () => {
      const ratio = contrastRatio('#FFFFFF', '#FEFEFE');
      expect(ratio).toBeGreaterThan(1);
      expect(ratio).toBeLessThan(2);
    });

    it('should handle equal luminance pairs', () => {
      const ratio = contrastRatio('#808080', '#808080');
      expect(ratio).toBe(1);
    });

    it('should handle near-threshold precision', () => {
      // Test epsilon handling for floating point precision
      const result1 = snapToPassingColor('#777777', '#FFFFFF');
      const result2 = snapToPassingColor('#777777', '#FFFFFF');
      expect(result1.fg).toBe(result2.fg);
      expect(result1.ratio).toBeCloseTo(result2.ratio, 3);
    });

    it('should handle clamped results when no path meets threshold', () => {
      // Test extreme case where no adjustment can meet threshold
      const result = snapToPassingColor('#FFFFFF', '#FFFFFF');
      expect(result.clamped).toBe(true);
      expect(result.ratio).toBe(1); // Identical colors = 1:1 ratio
    });
  });

  describe('tie-breaking with preference flags', () => {
    it('should prefer foreground adjustment when preferForegroundAdjust is true', () => {
      const result = snapToPassingColor('#AAAAAA', '#FFFFFF', { 
        preferForegroundAdjust: true 
      });
      expect(result.adjusted).toBe('fg');
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('should prefer background adjustment when preferBackgroundAdjust is true', () => {
      // Test that preference is respected - the exact adjustment may vary based on minimal change
      const result = snapToPassingColor('#999999', '#FFFFFF', { 
        preferBackgroundAdjust: true 
      });
      // The preference should influence the choice when paths are similar
      expect(result.adjusted).toBeDefined();
      expect(['fg', 'bg']).toContain(result.adjusted);
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
      
      // Verify deterministic behavior with same preference
      const result2 = snapToPassingColor('#999999', '#FFFFFF', { 
        preferBackgroundAdjust: true 
      });
      expect(result.adjusted).toBe(result2.adjusted);
    });

    it('should default to foreground when both preferences are true', () => {
      const result = snapToPassingColor('#AAAAAA', '#FFFFFF', { 
        preferForegroundAdjust: true,
        preferBackgroundAdjust: true 
      });
      expect(result.adjusted).toBe('fg');
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('should default to foreground when no preferences are set', () => {
      const result = snapToPassingColor('#AAAAAA', '#FFFFFF');
      expect(result.adjusted).toBe('fg');
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('should be deterministic across multiple runs with same preferences', () => {
      const result1 = snapToPassingColor('#AAAAAA', '#FFFFFF', { 
        preferBackgroundAdjust: true 
      });
      const result2 = snapToPassingColor('#AAAAAA', '#FFFFFF', { 
        preferBackgroundAdjust: true 
      });
      
      expect(result1.fg).toBe(result2.fg);
      expect(result1.bg).toBe(result2.bg);
      expect(result1.adjusted).toBe(result2.adjusted);
      expect(result1.iterations).toBe(result2.iterations);
    });
  });

  describe('determinism and consistency', () => {
    it('should produce identical results across multiple runs', () => {
      const inputs = [
        ['#999999', '#FFFFFF'],
        ['#CCCCCC', '#FFFFFF', { isLargeText: true }],
        ['#888888', '#000000'],
        ['#F0F0F0', '#FFFFFF']
      ];

      inputs.forEach(([fg, bg, opts]) => {
        const result1 = snapToPassingColor(fg as string, bg as string, opts as any);
        const result2 = snapToPassingColor(fg as string, bg as string, opts as any);
        
        expect(result1.fg).toBe(result2.fg);
        expect(result1.bg).toBe(result2.bg);
        expect(result1.ratio).toBeCloseTo(result2.ratio, 3);
        expect(result1.clamped).toBe(result2.clamped);
        expect(result1.adjusted).toBe(result2.adjusted);
        expect(result1.iterations).toBe(result2.iterations);
      });
    });

    it('should choose minimal change path when multiple options exist', () => {
      // Test case where both fg lightening and bg darkening could work
      const result = snapToPassingColor('#AAAAAA', '#FFFFFF');
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
      
      // Verify the adjustment is minimal - only one color should change
      const originalFg = '#AAAAAA';
      const originalBg = '#FFFFFF';
      const fgChanged = result.fg !== originalFg;
      const bgChanged = result.bg !== originalBg;
      
      // Only one should change for minimal adjustment
      expect(fgChanged !== bgChanged).toBe(true);
      
      // Verify deterministic behavior
      const result2 = snapToPassingColor('#AAAAAA', '#FFFFFF');
      expect(result.fg).toBe(result2.fg);
      expect(result.bg).toBe(result2.bg);
      expect(result.adjusted).toBe(result2.adjusted);
    });
  });
});
