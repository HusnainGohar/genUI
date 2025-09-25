/**
 * Theme Guard UI Notifications
 * 
 * Components for displaying theme guard results in the UI
 * with WCAG 2.2 AA compliance and ARIA best practices
 */

// React types for optional React component
interface ReactElement {
  type: string;
  props: any;
  children?: ReactElement[];
}

interface ReactEffect {
  (): void | (() => void);
}

// Mock React for TypeScript compatibility when React is not available
declare const React: {
  useEffect: (effect: ReactEffect, deps?: any[]) => void;
  createElement: (type: string, props: any, ...children: any[]) => ReactElement;
} | undefined;

// Global live region for announcements
let globalLiveRegion: HTMLElement | null = null;

/**
 * Initialize or get the global live region for announcements
 */
function getGlobalLiveRegion(): HTMLElement {
  if (!globalLiveRegion) {
    globalLiveRegion = document.getElementById('a11y-live') || Object.assign(document.body.appendChild(document.createElement('div')), {
      id: 'a11y-live',
      role: 'status',
      ariaLive: 'polite',
      ariaAtomic: 'true',
      style: 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;',
    });
  }
  return globalLiveRegion;
}

/**
 * Announce message to screen readers via live region
 */
function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const liveRegion = getGlobalLiveRegion();
  liveRegion.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');
  liveRegion.setAttribute('aria-live', priority);
  liveRegion.textContent = message;
}

export interface NotificationProps {
  result: {
    status: 'pass' | 'warnings' | 'fail';
    summary: {
      totalChecks: number;
      violations: number;
      adjustments: number;
      clamped: number;
    };
    violations: string[];
    adjustments: Array<{
      original: string;
      adjusted: string;
      ratio: number;
      clamped: boolean;
      adjustedColor: 'fg' | 'bg';
      semanticPair: string;
    }>;
  };
  onDismiss?: () => void;
  autoHide?: boolean;
  duration?: number;
}

/**
 * Toast notification for theme guard results
 */
export function createThemeGuardToast(result: NotificationProps['result'], props?: { autoHide?: boolean; duration?: number }): HTMLElement {
  const toast = document.createElement('div');
  toast.className = 'theme-guard-toast';
  
  const statusConfig = {
    pass: { color: '#22c55e', icon: '✓', title: 'Theme Applied Successfully' },
    warnings: { color: '#f59e0b', icon: '⚠', title: 'Theme Adjusted for Accessibility' },
    fail: { color: '#ef4444', icon: '✗', title: 'Theme Has Accessibility Issues' }
  };
  
  const config = statusConfig[result.status];
  
  // Set ARIA attributes based on status
  toast.setAttribute('role', result.status === 'fail' ? 'alert' : 'status');
  toast.setAttribute('aria-live', result.status === 'fail' ? 'assertive' : 'polite');
  toast.setAttribute('aria-atomic', 'true');
  
  // Create human-readable announcement message
  const announcementMessage = `${config.title}. ${result.summary.totalChecks} checks performed. ${
    result.summary.adjustments > 0 ? `${result.summary.adjustments} colors adjusted. ` : ''
  }${
    result.summary.violations > 0 ? `${result.summary.violations} violations found. ` : ''
  }${result.violations.length > 0 ? 'Press Escape to dismiss or click to view details.' : 'Press Escape to dismiss.'}`;
  
  // Announce to screen readers
  announceToScreenReader(announcementMessage, result.status === 'fail' ? 'assertive' : 'polite');
  
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-header">
        <span class="toast-icon" style="color: ${config.color}" aria-hidden="true">${config.icon}</span>
        <span class="toast-title">${config.title}</span>
        <button class="toast-dismiss" aria-label="Dismiss notification" type="button">×</button>
      </div>
      <div class="toast-body">
        <div class="toast-stats">
          <span>${result.summary.totalChecks} checks</span>
          ${result.summary.adjustments > 0 ? `<span>${result.summary.adjustments} adjusted</span>` : ''}
          ${result.summary.violations > 0 ? `<span>${result.summary.violations} violations</span>` : ''}
        </div>
        ${result.violations.length > 0 ? `
          <details class="toast-details">
            <summary>View Issues</summary>
            <ul>
              ${result.violations.map(v => `<li>${v}</li>`).join('')}
            </ul>
            <div class="toast-actions">
              <button class="toast-action-btn" onclick="openA11yQAWithFilter()">
                Open A11y QA Page
              </button>
            </div>
          </details>
        ` : ''}
      </div>
    </div>
  `;
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .theme-guard-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      max-width: 400px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      border-left: 4px solid ${config.color};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
    }
    
    .toast-content {
      padding: 16px;
    }
    
    .toast-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    
    .toast-icon {
      font-weight: bold;
      font-size: 16px;
    }
    
    .toast-title {
      font-weight: 600;
      flex: 1;
    }
    
    .toast-dismiss {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }
    
    .toast-dismiss:hover {
      color: #333;
      background: #f3f4f6;
    }
    
    .toast-dismiss:focus {
      outline: 2px solid #2563eb;
      outline-offset: 2px;
      color: #333;
    }
    
    .toast-stats {
      display: flex;
      gap: 12px;
      margin-bottom: 8px;
      font-size: 12px;
      color: #666;
    }
    
    .toast-details {
      margin-top: 8px;
    }
    
    .toast-details summary {
      cursor: pointer;
      font-weight: 500;
      color: #333;
    }
    
    .toast-details ul {
      margin: 8px 0 0 16px;
      padding: 0;
    }
    
    .toast-details li {
      margin: 4px 0;
      font-size: 12px;
      color: #666;
    }
    
    .toast-actions {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid #e5e7eb;
    }
    
    .toast-action-btn {
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s ease;
    }
    
    .toast-action-btn:hover {
      background: #1d4ed8;
    }
    
    .toast-action-btn:focus {
      outline: 2px solid #2563eb;
      outline-offset: 2px;
    }
    
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @media (prefers-reduced-motion: reduce) {
      .theme-guard-toast {
        animation: none;
      }
    }
  `;
  
  document.head.appendChild(style);
  
  // Add dismiss functionality
  const dismissButton = toast.querySelector('.toast-dismiss') as HTMLButtonElement;
  const dismissToast = () => {
    if (toast.parentElement) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) {
        toast.remove();
      } else {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
      }
    }
  };
  
  dismissButton.addEventListener('click', dismissToast);
  
  // Keyboard support - Escape to dismiss
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && toast.parentElement) {
      dismissToast();
      e.preventDefault();
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
  
  // Auto-hide policy: don't auto-hide critical errors
  const shouldAutoHide = result.status !== 'fail' && (props?.autoHide ?? true);
  if (shouldAutoHide) {
    const duration = props?.duration ?? 5000;
    setTimeout(() => {
      if (toast.parentElement) {
        dismissToast();
      }
    }, duration);
  }
  
  // Clean up event listener when toast is removed
  const observer = new MutationObserver(() => {
    if (!toast.parentElement) {
      document.removeEventListener('keydown', handleKeyDown);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Add global function for opening A11y QA with filter
  (window as any).openA11yQAWithFilter = () => {
    // Import and open A11y QA page
    import('./a11y-qa.js').then(({ openA11yQA }) => {
      openA11yQA();
    }).catch(() => {
      // Fallback if module not available
      window.open('/a11y/qa', '_blank');
    });
  };
  
  return toast;
}

/**
 * Badge component for displaying theme guard status
 */
export function createThemeGuardBadge(result: NotificationProps['result']): HTMLElement {
  const badge = document.createElement('div');
  badge.className = 'theme-guard-badge';
  
  const statusConfig = {
    pass: { color: '#22c55e', text: 'A11y ✓' },
    warnings: { color: '#f59e0b', text: 'A11y ⚠' },
    fail: { color: '#ef4444', text: 'A11y ✗' }
  };
  
  const config = statusConfig[result.status];
  
  // Set accessibility attributes
  badge.setAttribute('role', 'button');
  badge.setAttribute('aria-pressed', 'false');
  badge.setAttribute('tabindex', '0');
  badge.setAttribute('aria-label', `Accessibility status: ${result.summary.violations} violations. Click to open A11y QA page.`);
  
  badge.innerHTML = `
    <span class="badge-text" style="color: ${config.color}" aria-hidden="true">${config.text}</span>
    <span class="badge-count" aria-hidden="true">${result.summary.violations}</span>
  `;
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .theme-guard-badge {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      background: white;
      border-radius: 20px;
      padding: 8px 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      border: 1px solid #e5e7eb;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .theme-guard-badge:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    
    .theme-guard-badge:focus {
      outline: 2px solid #2563eb;
      outline-offset: 2px;
    }
    
    .theme-guard-badge:focus:not(:focus-visible) {
      outline: none;
    }
    
    .theme-guard-badge:focus-visible {
      outline: 2px solid #2563eb;
      outline-offset: 2px;
    }
    
    @media (prefers-reduced-motion: reduce) {
      .theme-guard-badge:hover {
        transform: none;
      }
    }
    
    .badge-text {
      font-weight: 600;
    }
    
    .badge-count {
      background: #f3f4f6;
      color: #374151;
      border-radius: 10px;
      padding: 2px 6px;
      font-size: 10px;
      min-width: 16px;
      text-align: center;
    }
    
    .theme-guard-badge[data-status="fail"] .badge-count {
      background: #fef2f2;
      color: #dc2626;
    }
    
    .theme-guard-badge[data-status="warnings"] .badge-count {
      background: #fef3c7;
      color: #d97706;
    }
    
    .theme-guard-badge[data-status="pass"] .badge-count {
      background: #dcfce7;
      color: #166534;
    }
  `;
  
  badge.setAttribute('data-status', result.status);
  document.head.appendChild(style);
  
  // Add keyboard support
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      badge.click();
    }
  };
  
  badge.addEventListener('keydown', handleKeyDown);
  
  // Add click handler to show details or open A11y QA
  badge.addEventListener('click', (e) => {
    e.preventDefault();
    
    // If there are violations, open A11y QA directly
    if (result.violations.length > 0) {
      import('./a11y-qa.js').then(({ openA11yQA }) => {
        openA11yQA();
      }).catch(() => {
        window.open('/a11y/qa', '_blank');
      });
    } else {
      // Otherwise show toast with details
      const toast = createThemeGuardToast(result);
      document.body.appendChild(toast);
    }
  });
  
  // Remove tooltip since we have aria-label
  // badge.title = result.violations.length > 0 
  //   ? 'Click to open A11y QA page' 
  //   : 'Click to view theme details';
  
  return badge;
}

/**
 * React component for theme guard notifications (JSX)
 * Note: This component requires React to be available in the environment
 */
export const ThemeGuardNotification = (props: NotificationProps) => {
  if (!React) {
    console.warn('ThemeGuardNotification: React is not available. Use createThemeGuardToast instead.');
    return null;
  }
  
  const { result, onDismiss, autoHide = true, duration = 5000 } = props;
  
  const statusConfig = {
    pass: { color: '#22c55e', icon: '✓', title: 'Theme Applied Successfully' },
    warnings: { color: '#f59e0b', icon: '⚠', title: 'Theme Adjusted for Accessibility' },
    fail: { color: '#ef4444', icon: '✗', title: 'Theme Has Accessibility Issues' }
  };
  
  const config = statusConfig[result.status];
  
  // Announce to screen readers
  React.useEffect(() => {
    const announcementMessage = `${config.title}. ${result.summary.totalChecks} checks performed. ${
      result.summary.adjustments > 0 ? `${result.summary.adjustments} colors adjusted. ` : ''
    }${
      result.summary.violations > 0 ? `${result.summary.violations} violations found. ` : ''
    }Press Escape to dismiss.`;
    
    announceToScreenReader(announcementMessage, result.status === 'fail' ? 'assertive' : 'polite');
  }, [result, config.title]);
  
  // Keyboard support
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss?.();
        e.preventDefault();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);
  
  React.useEffect(() => {
    if (autoHide && result.status !== 'fail') {
      const timer = setTimeout(() => {
        onDismiss?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [autoHide, duration, onDismiss, result.status]);
  
  return React.createElement('div', {
    className: 'theme-guard-notification',
    role: result.status === 'fail' ? 'alert' : 'status',
    'aria-live': result.status === 'fail' ? 'assertive' : 'polite',
    'aria-atomic': 'true',
    style: {
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 10000,
      maxWidth: '400px',
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      borderLeft: `4px solid ${config.color}`,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px'
    }
  }, [
    React.createElement('div', { className: 'notification-content', style: { padding: '16px' } }, [
      React.createElement('div', { className: 'notification-header', style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' } }, [
        React.createElement('span', { 
          className: 'notification-icon', 
          style: { color: config.color, fontWeight: 'bold', fontSize: '16px' },
          'aria-hidden': 'true'
        }, config.icon),
        React.createElement('span', { className: 'notification-title', style: { fontWeight: '600', flex: 1 } }, config.title),
        React.createElement('button', { 
          className: 'notification-dismiss', 
          onClick: onDismiss,
          'aria-label': 'Dismiss notification',
          style: { 
            background: 'none', 
            border: 'none', 
            fontSize: '18px', 
            cursor: 'pointer', 
            color: '#666',
            padding: '0',
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px'
          }
        }, '×')
      ]),
      React.createElement('div', { className: 'notification-body' }, [
        React.createElement('div', { className: 'notification-stats', style: { display: 'flex', gap: '12px', marginBottom: '8px', fontSize: '12px', color: '#666' } }, [
          React.createElement('span', null, `${result.summary.totalChecks} checks`),
          result.summary.adjustments > 0 ? React.createElement('span', null, `${result.summary.adjustments} adjusted`) : null,
          result.summary.violations > 0 ? React.createElement('span', null, `${result.summary.violations} violations`) : null
        ]),
        result.violations.length > 0 ? React.createElement('details', { className: 'notification-details', style: { marginTop: '8px' } }, [
          React.createElement('summary', { style: { cursor: 'pointer', fontWeight: '500', color: '#333' } }, 'View Issues'),
          React.createElement('ul', { style: { margin: '8px 0 0 16px', padding: 0 } }, 
            result.violations.map((violation, index) => 
              React.createElement('li', { key: index, style: { margin: '4px 0', fontSize: '12px', color: '#666' } }, violation)
            )
          )
        ]) : null
      ])
    ])
  ]);
};
