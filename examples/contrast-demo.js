/**
 * Example usage of WCAG 2.2 AA Color Contrast Utility
 */

import { 
  relativeLuminance, 
  contrastRatio, 
  passesContrast, 
  snapToPassingColor 
} from './src/a11y/contrast.js';

console.log('=== WCAG 2.2 AA Color Contrast Utility Demo ===\n');

// Example 1: Basic contrast checking
console.log('1. Basic Contrast Checking:');
console.log(`Black on white: ${contrastRatio('#000000', '#FFFFFF').toFixed(2)}:1`);
console.log(`Gray on white: ${contrastRatio('#777777', '#FFFFFF').toFixed(2)}:1`);
console.log(`Gray on white passes normal text: ${passesContrast('#777777', '#FFFFFF')}`);
console.log(`Gray on white passes large text: ${passesContrast('#777777', '#FFFFFF', { isLargeText: true })}\n`);

// Example 2: Focus indicator contrast
console.log('2. Focus Indicator Contrast (3:1 minimum):');
console.log(`Red focus on white: ${contrastRatio('#FF0000', '#FFFFFF').toFixed(2)}:1`);
console.log(`Red focus passes UI component: ${passesContrast('#FF0000', '#FFFFFF', { uiComponent: true })}\n`);

// Example 3: Color snapping
console.log('3. Color Snapping:');
const failingPair = snapToPassingColor('#888888', '#FFFFFF');
console.log(`Original: #888888 on #FFFFFF (fails)`);
console.log(`Snapped: ${failingPair.fg} on ${failingPair.bg} (${failingPair.ratio.toFixed(2)}:1)`);
console.log(`Clamped: ${failingPair.clamped}\n`);

// Example 4: 3-digit hex support
console.log('4. 3-digit Hex Support:');
console.log(`#ABC luminance: ${relativeLuminance('#ABC').toFixed(4)}`);
console.log(`#AABBCC luminance: ${relativeLuminance('#AABBCC').toFixed(4)}`);
console.log(`Are they equal? ${Math.abs(relativeLuminance('#ABC') - relativeLuminance('#AABBCC')) < 1e-6}\n`);

// Example 5: Deterministic behavior
console.log('5. Deterministic Behavior:');
const result1 = snapToPassingColor('#999999', '#FFFFFF');
const result2 = snapToPassingColor('#999999', '#FFFFFF');
console.log(`Multiple runs produce same result: ${result1.fg === result2.fg && result1.bg === result2.bg}\n`);

console.log('=== Demo Complete ===');
