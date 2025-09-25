/**
 * Color Screening Tasks
 * 
 * Client-only color vision screening tasks for personalization:
 * - Calibration screen
 * - RG axis detection (seen/not seen) with 1-up/1-down staircase
 * - YB axis discrimination (odd-one-out) with 3-down/1-up staircase
 */

/**
 * Psychophysical staircase for adaptive threshold estimation
 * 
 * Implements classic transformed up-down and weighted up-down procedures:
 * - 1-up/1-down: converges to ~50% threshold (detection tasks)
 * - 3-down/1-up: converges to ~79.4% correct (discrimination tasks)
 * - Weighted up-down: targets specific percent correct via step ratios
 * 
 * Features:
 * - Coarse-to-fine step sizing
 * - Late reversal averaging
 * - Optional asymmetric steps
 * - Optional geometric mean estimation
 * - Trial history tracking for lapse rate computation
 * - Weighted up-down step ratio selection (optional)
 * 
 * ## When to Use Geometric Mean (useGeometricMean=true)
 * 
 * Use geometric mean when stimulus levels are manipulated multiplicatively or when
 * the psychometric function is log-skewed:
 * 
 * ✅ **Use geometric mean for:**
 * - Contrast ratios (e.g., Michelson contrast)
 * - Decibel-like units (dB, log-scale)
 * - Multiplicative stimulus scaling
 * - When psychometric diagnostics show log-skew
 * 
 * ❌ **Use arithmetic mean for:**
 * - Linear percentage scales (0-100%)
 * - Saturation levels (0-1)
 * - Additive stimulus changes
 * - When psychometric function is symmetric
 * 
 * ## Classic vs Weighted Up-Down Procedures
 * 
 * **Classic Transformed Up-Down (default):**
 * - Uses equal step sizes (stepDown/stepUp = 1)
 * - Standard for 1-up/1-down (~50%) and 3-down/1-up (~79.4%)
 * - Follows Wetherill/Levitt formulations
 * - Recommended for most applications
 * 
 * **Weighted Up-Down (targetPercent specified):**
 * - Uses unequal step sizes: stepDown/stepUp = (1-Ptarget)/Ptarget
 * - Targets specific percent correct (0 < targetPercent < 1)
 * - Useful when psychometric slopes vary significantly
 * - Keep optional and clearly scoped to slope considerations
 * 
 * **Examples:**
 * - targetPercent=0.5: stepDown/stepUp = 1 (equal steps, 50% target)
 * - targetPercent=0.75: stepDown/stepUp = 0.33 (smaller down steps, 75% target)
 * - targetPercent=0.794: stepDown/stepUp = 0.26 (optimal for 3-down/1-up)
 * 
 * **When to use weighted up-down:**
 * - Psychometric slopes vary significantly across conditions
 * - Need precise targeting of specific percent correct
 * - Classic equal-step procedure shows convergence issues
 * 
 * ## Reversal Targets and Precision Tradeoffs
 * 
 * **Fast runs (typical):**
 * - 12 reversals total, discard first 4-6
 * - 6 coarse reversals for hunting, 6 fine for measurement
 * - Good balance of speed vs precision
 * 
 * **High precision:**
 * - 16+ reversals total, discard first 8
 * - 8 coarse reversals, 8+ fine reversals
 * - Reduces SEM at cost of more trials
 * 
 * **Quick screening:**
 * - 8 reversals total, discard first 4
 * - 4 coarse reversals, 4 fine reversals
 * - Faster but less precise
 * 
 * ## Bias Reduction (Levitt-style)
 * 
 * For optimal bias reduction, the staircase uses an even number of late reversals:
 * - **Optimal**: Last 8 reversals (optimal_even_8)
 * - **Good**: Last 6 reversals (good_even_6)
 * - **Even count**: All reversals if even number
 * - **Odd count**: All reversals but notes potential bias
 * 
 * ## Psychometric Fitting Export
 * 
 * For research modes requiring higher precision, export trial history for
 * maximum-likelihood or Bayesian fitting (Palamedes/Psignifit-style):
 * 
 * ```typescript
 * const trialData = staircase.exportTrialHistory();
 * const metadata = staircase.exportStaircaseMetadata();
 * // Use with Palamedes, Psignifit, or custom ML/Bayesian fitting
 * ```
 * 
 * **Research Mode Notes:**
 * - Full psychometric function (PF) fits can handle overdispersion via beta-binomial
 *   or Bayesian approaches (e.g., Psignifit 4)
 * - Improves credible intervals when lapses or non-stationarity are present
 * - Recommended for high-precision research requiring robust uncertainty estimates
 * - Staircase estimation provides good initial values for PF fitting
 */
export class Staircase {
  private currentLevel: number;
  private stepUp: number;
  private stepDown: number;
  private rule: { downAfter: number; upAfter: number };
  private reversals: number[] = [];
  private trialHistory: { level: number; correct: boolean }[] = [];
  private consecutiveCorrect: number = 0;
  private consecutiveIncorrect: number = 0;
  private lastDirection: 'up' | 'down' | null = null;
  private trialCount: number = 0;
  private maxTrials: number;
  private minReversals: number;
  private discardReversals: number;
  private coarseThreshold: number;
  private fineFactor: number;
  private useGeometricMean: boolean;
  private targetPercent: number | null;

  /**
   * Create a new psychophysical staircase
   * 
   * @param initialLevel - Starting stimulus level (0-1)
   * @param stepUp - Step size when making stimulus easier
   * @param stepDown - Step size when making stimulus harder
   * @param rule - Up-down rule: {downAfter: N, upAfter: M}
   * @param maxTrials - Maximum number of trials (fallback stop criterion)
   * @param minReversals - Minimum reversals before stopping (default: 8)
   * @param discardReversals - Number of early reversals to discard (default: 4)
   * @param useAsymmetricSteps - Whether to use asymmetric step sizes (default: false)
   * @param coarseThreshold - Switch to fine steps after this many reversals (default: 6)
   * @param fineFactor - Fine steps are this fraction of coarse steps (default: 0.5)
   * @param useGeometricMean - Use geometric mean for threshold estimation (default: false)
   * @param targetPercent - Target percent correct for weighted up-down (default: null)
   *                       Use null for classic transformed up-down with equal steps.
   *                       Specify 0 < targetPercent < 1 for weighted up-down procedure.
   * 
   * @example
   * // Classic 1-up/1-down detection staircase (equal steps)
   * const detection = new Staircase(0.3, 0.02, 0.02, {downAfter: 1, upAfter: 1});
   * 
   * // Classic 3-down/1-up discrimination staircase (equal steps)
   * const discrimination = new Staircase(0.2, 0.01, 0.01, {downAfter: 3, upAfter: 1}, 100, 16, 8);
   * 
   * // Weighted up-down for 75% target (unequal steps)
   * const weighted75 = new Staircase(0.2, 0.01, 0.01, {downAfter: 2, upAfter: 1}, 80, 12, 6, false, 6, 0.5, false, 0.75);
   * 
   * // For multiplicative scales (e.g., contrast ratios, decibels)
   * const contrastStaircase = new Staircase(0.1, 0.01, 0.01, {downAfter: 1, upAfter: 1}, 60, 12, 6, false, 6, 0.5, true);
   */
  constructor(
    initialLevel: number,
    stepUp: number,
    stepDown: number,
    rule: { downAfter: number; upAfter: number },
    maxTrials: number = 80,
    minReversals: number = 8,
    discardReversals: number = 4,
    useAsymmetricSteps: boolean = false,
    coarseThreshold: number = 6,
    fineFactor: number = 0.5,
    useGeometricMean: boolean = false,
    targetPercent: number | null = null
  ) {
    this.currentLevel = initialLevel;
    this.stepUp = stepUp;
    this.stepDown = stepDown;
    this.rule = rule;
    this.maxTrials = maxTrials;
    this.minReversals = minReversals;
    this.discardReversals = discardReversals;
    this.coarseThreshold = coarseThreshold;
    this.fineFactor = fineFactor;
    this.useGeometricMean = useGeometricMean;
    this.targetPercent = targetPercent;
    
    // Apply weighted up-down step ratio selection if targetPercent is specified
    if (targetPercent !== null && targetPercent > 0 && targetPercent < 1) {
      // Weighted up-down formula: stepDown/stepUp = (1-Ptarget)/Ptarget
      // This targets the specified percent correct (Levitt & Rabinowitz, 1989)
      const stepRatio = (1 - targetPercent) / targetPercent;
      this.stepDown = this.stepUp * stepRatio;
    }
    
    // Apply asymmetric step adjustment if enabled
    if (useAsymmetricSteps) {
      // Make step down slightly larger to stabilize convergence
      // This helps when psychometric slope varies
      this.stepDown *= 1.2;
    }
  }

  /**
   * Get current stimulus level
   */
  getCurrentLevel(): number {
    return this.currentLevel;
  }

  /**
   * Get step size with coarse-to-fine progression and log-space stepping
   */
  private getStepSize(direction: 'up' | 'down'): number {
    // Use coarse steps initially, fine steps after configurable threshold
    const baseStep = direction === 'up' ? this.stepUp : this.stepDown;
    
    if (this.reversals.length < this.coarseThreshold) {
      return baseStep; // Use larger step for hunting
    } else {
      // Use smaller step for fine measurement
      // For very low levels, use log-space stepping to avoid overshooting
      if (this.currentLevel < 0.1) {
        return baseStep * this.fineFactor * 0.5; // Even smaller steps near threshold
      }
      return baseStep * this.fineFactor;
    }
  }

  /**
   * Update staircase based on response
   * 
   * For 1-up/1-down: step down on correct (make harder), step up on incorrect (make easier)
   * For 3-down/1-up: step down after 3 correct (make harder), step up after 1 incorrect (make easier)
   */
  update(responseCorrect: boolean): void {
    this.trialCount++;
    
    // Track trial history for lapse rate computation
    this.trialHistory.push({ level: this.currentLevel, correct: responseCorrect });
    
    if (responseCorrect) {
      this.consecutiveCorrect++;
      this.consecutiveIncorrect = 0;
      
      // Check if we should decrease level (down) - make stimulus harder
      if (this.consecutiveCorrect >= this.rule.downAfter) {
        this.changeLevel('down');
      }
    } else {
      this.consecutiveIncorrect++;
      this.consecutiveCorrect = 0;
      
      // Check if we should increase level (up) - make stimulus easier
      if (this.consecutiveIncorrect >= this.rule.upAfter) {
        this.changeLevel('up');
      }
    }
  }

  /**
   * Get lapse rate from trial history (proportion of incorrect responses at easy levels)
   * Used to detect noisy responses that might affect threshold estimation
   */
  getLapseRate(): number {
    if (this.trialHistory.length < 10) return 0; // Need minimum trials
    
    // Calculate threshold estimate from recent reversals for comparison
    let thresholdEstimate = this.currentLevel;
    if (this.reversals.length >= this.discardReversals) {
      const validReversals = this.reversals.slice(this.discardReversals);
      thresholdEstimate = validReversals.reduce((sum, val) => sum + val, 0) / validReversals.length;
    }
    
    // Define "easy" levels as those above threshold estimate or in top quantile
    const easyThreshold = Math.max(thresholdEstimate * 1.5, 0.3); // At least 30% or 1.5x threshold
    const easyTrials = this.trialHistory.filter(trial => trial.level >= easyThreshold);
    
    if (easyTrials.length < 5) return 0; // Need sufficient easy trials
    
    // Calculate lapse rate as proportion of incorrect responses at easy levels
    const incorrectEasyTrials = easyTrials.filter(trial => !trial.correct).length;
    const lapseRate = incorrectEasyTrials / easyTrials.length;
    
    return Math.min(0.3, lapseRate); // Cap at 30% to avoid extreme values
  }

  /**
   * Change level and track reversals
   */
  private changeLevel(direction: 'up' | 'down'): void {
    const previousDirection = this.lastDirection;
    this.lastDirection = direction;
    
    // Check for reversal
    if (previousDirection && previousDirection !== direction) {
      this.reversals.push(this.currentLevel);
    }
    
    // Update level with coarse-to-fine stepping
    const stepSize = this.getStepSize(direction);
    if (direction === 'up') {
      this.currentLevel += stepSize;
    } else {
      this.currentLevel -= stepSize;
    }
    
    // Clamp currentLevel to valid bounds [0, 1]
    this.currentLevel = Math.max(0, Math.min(1, this.currentLevel));
    
    // Reset counters
    this.consecutiveCorrect = 0;
    this.consecutiveIncorrect = 0;
  }

  /**
   * Check if staircase should stop
   */
  shouldStop(): boolean {
    return this.trialCount >= this.maxTrials || 
           this.reversals.length >= this.minReversals;
  }

  /**
   * Estimate threshold from reversals with enhanced reliability metrics
   * 
   * Uses late reversals after discarding early "hunting" reversals to reduce bias.
   * For optimal bias reduction, uses an even number of late reversals (6 or 8).
   */
  estimate(): { threshold: number; reliability: number; reversals: number; lapseRate: number; convergence: boolean; biasReduction: string } {
    if (this.reversals.length < this.discardReversals) {
      return {
        threshold: this.currentLevel,
        reliability: 0,
        reversals: this.reversals.length,
        lapseRate: this.getLapseRate(),
        convergence: false,
        biasReduction: 'insufficient_reversals'
      };
    }
    
    // Use last N reversals after discarding early ones
    const validReversals = this.reversals.slice(this.discardReversals);
    
    // For optimal bias reduction, use an even number of late reversals (6 or 8)
    let estimationReversals = validReversals;
    let biasReduction = 'standard';
    
    if (validReversals.length >= 8) {
      // Use last 8 reversals for optimal bias reduction (Levitt recommendation)
      estimationReversals = validReversals.slice(-8);
      biasReduction = 'optimal_even_8';
    } else if (validReversals.length >= 6) {
      // Use last 6 reversals for good bias reduction
      estimationReversals = validReversals.slice(-6);
      biasReduction = 'good_even_6';
    } else if (validReversals.length % 2 === 0) {
      // Use all reversals if even number
      biasReduction = 'even_count';
    } else {
      // Use all reversals but note odd count
      biasReduction = 'odd_count';
    }
    
    // Choose between arithmetic and geometric mean based on stimulus scale
    let threshold: number;
    if (this.useGeometricMean) {
      // Geometric mean for multiplicative/perceptual scales
      // Use when stimulus levels are log-distributed or manipulated multiplicatively
      const product = estimationReversals.reduce((prod, val) => prod * val, 1);
      threshold = Math.pow(product, 1 / estimationReversals.length);
    } else {
      // Arithmetic mean for linear scales
      // Use when stimulus levels are linearly distributed (default)
      threshold = estimationReversals.reduce((sum, val) => sum + val, 0) / estimationReversals.length;
    }
    
    // Calculate reliability as inverse of coefficient of variation
    const variance = estimationReversals.reduce((sum, val) => sum + Math.pow(val - threshold, 2), 0) / estimationReversals.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / threshold;
    const reliability = Math.max(0, 1 - coefficientOfVariation);
    
    // Check convergence: threshold should be stable across last few reversals
    const lastReversals = estimationReversals.slice(-4);
    const convergenceThreshold = 0.1; // 10% variation acceptable
    const convergence = lastReversals.length >= 4 && 
      (Math.max(...lastReversals) - Math.min(...lastReversals)) / threshold < convergenceThreshold;
    
    return {
      threshold,
      reliability: Math.min(1, reliability),
      reversals: estimationReversals.length,
      lapseRate: this.getLapseRate(),
      convergence,
      biasReduction
    };
  }

  /**
   * Export trial history for psychometric fitting (Palamedes/Psignifit-style)
   * 
   * Returns all trial data for maximum-likelihood or Bayesian fitting.
   * Useful for research modes requiring higher precision than staircase estimation.
   * 
   * @returns Array of {level, response} pairs for psychometric curve fitting
   */
  exportTrialHistory(): { level: number; response: number }[] {
    return this.trialHistory.map(trial => ({
      level: trial.level,
      response: trial.correct ? 1 : 0
    }));
  }

  /**
   * Export staircase metadata for psychometric fitting
   * 
   * @returns Metadata including rule, step sizes, and estimation parameters
   */
  exportStaircaseMetadata(): {
    rule: { downAfter: number; upAfter: number };
    stepUp: number;
    stepDown: number;
    useGeometricMean: boolean;
    coarseThreshold: number;
    fineFactor: number;
    totalTrials: number;
    totalReversals: number;
    discardedReversals: number;
  } {
    return {
      rule: this.rule,
      stepUp: this.stepUp,
      stepDown: this.stepDown,
      useGeometricMean: this.useGeometricMean,
      coarseThreshold: this.coarseThreshold,
      fineFactor: this.fineFactor,
      totalTrials: this.trialCount,
      totalReversals: this.reversals.length,
      discardedReversals: this.discardReversals
    };
  }

  /**
   * Get staircase statistics
   */
  getStats(): {
    trialCount: number;
    reversalCount: number;
    currentLevel: number;
    consecutiveCorrect: number;
    consecutiveIncorrect: number;
    stepUp: number;
    stepDown: number;
    rule: { downAfter: number; upAfter: number };
  } {
    return {
      trialCount: this.trialCount,
      reversalCount: this.reversals.length,
      currentLevel: this.currentLevel,
      consecutiveCorrect: this.consecutiveCorrect,
      consecutiveIncorrect: this.consecutiveIncorrect,
      stepUp: this.stepUp,
      stepDown: this.stepDown,
      rule: this.rule
    };
  }
}

export interface TrialData {
  trialId: string;
  timestamp: number;
  stimulus: {
    color: string;
    position: { x: number; y: number };
    duration: number;
  };
  response: {
    seen: boolean;
    reactionTime: number;
    confidence?: number;
  };
  metadata: {
    saturation: number;
    background: string;
    screenSize: { width: number; height: number };
  };
}

export interface DiscriminationTrial {
  trialId: string;
  timestamp: number;
  stimuli: {
    colors: string[];
    positions: { x: number; y: number }[];
    targetIndex: number;
  };
  response: {
    selectedIndex: number;
    reactionTime: number;
    correct: boolean;
  };
  metadata: {
    deltaYB: number;
    background: string;
    difficulty: 'easy' | 'medium' | 'hard';
  };
}

export interface SessionData {
  sessionId: string;
  startTime: number;
  endTime?: number;
  calibrated: boolean;
  tasks: {
    detection_rg: {
      trials: TrialData[];
      threshold_estimate?: number;
      completed: boolean;
    };
    discrimination_yb: {
      trials: DiscriminationTrial[];
      jnd_estimate?: number;
      completed: boolean;
    };
  };
  profile?: {
    type?: 'protan' | 'deutan' | 'tritan' | 'none';
    severity?: number;
    reliability?: number;
  };
}

/**
 * Color screening task manager with psychophysical staircases
 */
export class ColorScreeningManager {
  private sessionData: SessionData;
  private currentTrial: TrialData | DiscriminationTrial | null = null;
  private trialStartTime: number = 0;
  
  // Staircases for adaptive threshold estimation
  private detectionStaircase: Staircase | null = null;
  private discriminationStaircase: Staircase | null = null;
  
  constructor() {
    this.sessionData = {
      sessionId: this.generateSessionId(),
      startTime: Date.now(),
      calibrated: false,
      tasks: {
        detection_rg: { trials: [], completed: false },
        discrimination_yb: { trials: [], completed: false }
      }
    };
  }
  
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Mark calibration as complete
   */
  markCalibrated(): void {
    this.sessionData.calibrated = true;
    localStorage.setItem('colorScreening_calibrated', 'true');
  }
  
  /**
   * Check if user is calibrated
   */
  isCalibrated(): boolean {
    return this.sessionData.calibrated || 
           localStorage.getItem('colorScreening_calibrated') === 'true';
  }
  
  /**
   * Initialize detection staircase (1-up/1-down for ~50% threshold)
   * 
   * Configuration: Fast run with 12 reversals, discard first 6
   * - Good balance of speed vs precision for detection tasks
   * - Uses arithmetic mean (saturation is linear scale)
   * - Coarse-to-fine stepping after 6 reversals
   */
  initializeDetectionStaircase(): void {
    this.detectionStaircase = new Staircase(
      0.3,        // Initial saturation level (30%) - start easier
      0.02,       // Step up size (make easier)
      0.02,       // Step down size (make harder)
      { downAfter: 1, upAfter: 1 }, // 1-up/1-down rule
      60,         // Max trials
      12,         // Min reversals (more for better estimate)
      6,          // Discard first 6 reversals (hunting phase)
      false,      // Use asymmetric steps
      6,          // Coarse threshold (switch to fine after 6 reversals)
      0.5,        // Fine factor (fine steps are half size)
      false       // Use arithmetic mean (saturation is linear)
    );
  }

  /**
   * Start RG detection trial using staircase
   */
  startDetectionTrial(background: string = '#808080'): TrialData | null {
    // Initialize staircase if not already done
    if (!this.detectionStaircase) {
      this.initializeDetectionStaircase();
    }
    
    // Check if we should stop
    if (this.detectionStaircase!.shouldStop()) {
      return null;
    }
    
    const trialId = `detection_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const saturation = this.detectionStaircase!.getCurrentLevel();
    
    this.currentTrial = {
      trialId,
      timestamp: Date.now(),
      stimulus: {
        color: this.generateRGColor(saturation),
        position: this.generateRandomPosition(),
        duration: this.getRandomDuration()
      },
      response: {
        seen: false,
        reactionTime: 0
      },
      metadata: {
        saturation,
        background,
        screenSize: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      }
    };
    
    this.trialStartTime = Date.now();
    return this.currentTrial as TrialData;
  }
  
  /**
   * Record detection trial response
   */
  recordDetectionResponse(seen: boolean, confidence?: number): void {
    if (!this.currentTrial || 'stimulus' in this.currentTrial === false) {
      throw new Error('No active detection trial');
    }
    
    const trial = this.currentTrial as TrialData;
    trial.response.seen = seen;
    trial.response.reactionTime = Date.now() - this.trialStartTime;
    trial.response.confidence = confidence;
    
    // Update staircase based on response
    if (this.detectionStaircase) {
      this.detectionStaircase.update(seen);
    }
    
    this.sessionData.tasks.detection_rg.trials.push(trial);
    this.currentTrial = null;
  }
  
  /**
   * Initialize discrimination staircase (3-down/1-up for ~79% threshold)
   * 
   * Configuration: Fast run with 12 reversals, discard first 6
   * - Good balance of speed vs precision for discrimination tasks
   * - Uses arithmetic mean (deltaYB is linear scale)
   * - Coarse-to-fine stepping after 6 reversals
   * - Higher trial budget (80) due to 3-down/1-up requiring more trials
   */
  initializeDiscriminationStaircase(): void {
    this.discriminationStaircase = new Staircase(
      0.2,        // Initial deltaYB level (20%) - start easier
      0.01,       // Step up size (make easier)
      0.01,       // Step down size (make harder)
      { downAfter: 3, upAfter: 1 }, // 3-down/1-up rule
      80,         // Max trials
      12,         // Min reversals (more for better estimate)
      6,          // Discard first 6 reversals (hunting phase)
      false,      // Use asymmetric steps
      6,          // Coarse threshold (switch to fine after 6 reversals)
      0.5,        // Fine factor (fine steps are half size)
      false       // Use arithmetic mean (deltaYB is linear)
    );
  }

  /**
   * Start YB discrimination trial using staircase
   */
  startDiscriminationTrial(difficulty: 'easy' | 'medium' | 'hard' = 'medium'): DiscriminationTrial | null {
    // Initialize staircase if not already done
    if (!this.discriminationStaircase) {
      this.initializeDiscriminationStaircase();
    }
    
    // Check if we should stop
    if (this.discriminationStaircase!.shouldStop()) {
      return null;
    }
    
    const trialId = `discrimination_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const deltaYB = this.discriminationStaircase!.getCurrentLevel();
    const targetIndex = Math.floor(Math.random() * 3);
    
    this.currentTrial = {
      trialId,
      timestamp: Date.now(),
      stimuli: {
        colors: this.generateYBColors(deltaYB, targetIndex),
        positions: this.generateThreePositions(),
        targetIndex
      },
      response: {
        selectedIndex: -1,
        reactionTime: 0,
        correct: false
      },
      metadata: {
        deltaYB,
        background: '#808080',
        difficulty
      }
    };
    
    this.trialStartTime = Date.now();
    return this.currentTrial as DiscriminationTrial;
  }
  
  /**
   * Record discrimination trial response
   */
  recordDiscriminationResponse(selectedIndex: number): void {
    if (!this.currentTrial || 'stimuli' in this.currentTrial === false) {
      throw new Error('No active discrimination trial');
    }
    
    const trial = this.currentTrial as DiscriminationTrial;
    trial.response.selectedIndex = selectedIndex;
    trial.response.reactionTime = Date.now() - this.trialStartTime;
    trial.response.correct = selectedIndex === trial.stimuli.targetIndex;
    
    // Update staircase based on response
    if (this.discriminationStaircase) {
      this.discriminationStaircase.update(trial.response.correct);
    }
    
    this.sessionData.tasks.discrimination_yb.trials.push(trial);
    this.currentTrial = null;
  }
  
  /**
   * Get detection threshold estimate from staircase
   */
  getDetectionThreshold(): { threshold: number; reliability: number; reversals: number; lapseRate: number; convergence: boolean; biasReduction: string } | null {
    if (!this.detectionStaircase) {
      return null;
    }
    return this.detectionStaircase.estimate();
  }

  /**
   * Get discrimination threshold estimate from staircase
   */
  getDiscriminationThreshold(): { threshold: number; reliability: number; reversals: number; lapseRate: number; convergence: boolean; biasReduction: string } | null {
    if (!this.discriminationStaircase) {
      return null;
    }
    return this.discriminationStaircase.estimate();
  }

  /**
   * Get detection staircase statistics
   */
  getDetectionStats(): {
    trialCount: number;
    reversalCount: number;
    currentLevel: number;
    consecutiveCorrect: number;
    consecutiveIncorrect: number;
    stepUp: number;
    stepDown: number;
    rule: { downAfter: number; upAfter: number };
  } | null {
    if (!this.detectionStaircase) {
      return null;
    }
    return this.detectionStaircase.getStats();
  }

  /**
   * Get discrimination staircase statistics
   */
  getDiscriminationStats(): {
    trialCount: number;
    reversalCount: number;
    currentLevel: number;
    consecutiveCorrect: number;
    consecutiveIncorrect: number;
    stepUp: number;
    stepDown: number;
    rule: { downAfter: number; upAfter: number };
  } | null {
    if (!this.discriminationStaircase) {
      return null;
    }
    return this.discriminationStaircase.getStats();
  }

  /**
   * Check if detection task should stop
   */
  shouldStopDetection(): boolean {
    return this.detectionStaircase ? this.detectionStaircase.shouldStop() : false;
  }

  /**
   * Check if discrimination task should stop
   */
  shouldStopDiscrimination(): boolean {
    return this.discriminationStaircase ? this.discriminationStaircase.shouldStop() : false;
  }

  /**
   * Export trial history for psychometric fitting (research mode)
   * 
   * Returns all trial data from both detection and discrimination tasks
   * for maximum-likelihood or Bayesian psychometric curve fitting.
   * 
   * @returns Object containing trial histories and metadata for both tasks
   */
  exportTrialHistoryForFitting(): {
    detection: {
      trials: { level: number; response: number }[];
      metadata: any;
    } | null;
    discrimination: {
      trials: { level: number; response: number }[];
      metadata: any;
    } | null;
    sessionInfo: {
      sessionId: string;
      startTime: number;
      calibrated: boolean;
    };
  } {
    return {
      detection: this.detectionStaircase ? {
        trials: this.detectionStaircase.exportTrialHistory(),
        metadata: this.detectionStaircase.exportStaircaseMetadata()
      } : null,
      discrimination: this.discriminationStaircase ? {
        trials: this.discriminationStaircase.exportTrialHistory(),
        metadata: this.discriminationStaircase.exportStaircaseMetadata()
      } : null,
      sessionInfo: {
        sessionId: this.sessionData.sessionId,
        startTime: this.sessionData.startTime,
        calibrated: this.sessionData.calibrated
      }
    };
  }

  /**
   * Complete a task
   */
  completeTask(taskType: 'detection_rg' | 'discrimination_yb'): void {
    this.sessionData.tasks[taskType].completed = true;
    
    // Calculate estimates from staircase
    if (taskType === 'detection_rg') {
      const threshold = this.getDetectionThreshold();
      if (threshold) {
        this.sessionData.tasks.detection_rg.threshold_estimate = threshold.threshold;
      }
    }
    
    if (taskType === 'discrimination_yb') {
      const threshold = this.getDiscriminationThreshold();
      if (threshold) {
        this.sessionData.tasks.discrimination_yb.jnd_estimate = threshold.threshold;
      }
    }
  }
  
  /**
   * Generate estimated profile from thresholds
   */
  estimateProfileFromThresholds(): SessionData['profile'] {
    const detectionThreshold = this.getDetectionThreshold();
    const discriminationThreshold = this.getDiscriminationThreshold();
    
    // Simple heuristic-based classification
    if (!detectionThreshold || !discriminationThreshold) {
      return { type: 'none', severity: 0, reliability: 0 };
    }
    
    // Placeholder logic - would be replaced with proper ML classification
    let type: 'protan' | 'deutan' | 'tritan' | 'none' = 'none';
    let severity = 0;
    
    // Use average reliability from both tasks, weighted by convergence
    const detectionWeight = detectionThreshold.convergence ? 1.0 : 0.5;
    const discriminationWeight = discriminationThreshold.convergence ? 1.0 : 0.5;
    const reliability = (detectionThreshold.reliability * detectionWeight + discriminationThreshold.reliability * discriminationWeight) / (detectionWeight + discriminationWeight);
    
    if (detectionThreshold.threshold > 0.3) {
      type = 'deutan'; // Simplified
      severity = Math.min(detectionThreshold.threshold * 2, 1);
    } else if (detectionThreshold.threshold > 0.2) {
      type = 'protan'; // Simplified
      severity = Math.min(detectionThreshold.threshold * 2.5, 1);
    }
    
    this.sessionData.profile = { type, severity, reliability };
    return this.sessionData.profile;
  }
  
  /**
   * Save session data to localStorage
   */
  saveSession(): void {
    this.sessionData.endTime = Date.now();
    localStorage.setItem('colorScreening_session', JSON.stringify(this.sessionData));
  }
  
  /**
   * Load session data from localStorage
   */
  loadSession(): SessionData | null {
    const saved = localStorage.getItem('colorScreening_session');
    if (saved) {
      this.sessionData = JSON.parse(saved);
      return this.sessionData;
    }
    return null;
  }
  
  /**
   * Get current session data
   */
  getSessionData(): SessionData {
    return this.sessionData;
  }
  
  // Helper methods
  private generateRGColor(saturation: number): string {
    // Generate color along RG confusion line
    const hue = 0; // Red-green axis
    return `hsl(${hue}, ${saturation * 100}%, 50%)`;
  }
  
  private generateYBColors(deltaYB: number, targetIndex: number): string[] {
    const colors = ['#808080', '#808080', '#808080']; // Start with neutral grays
    
    // Modify target color along YB confusion line
    const targetHue = 60; // Yellow-blue axis
    const targetSaturation = deltaYB * 100;
    colors[targetIndex] = `hsl(${targetHue}, ${targetSaturation}%, 50%)`;
    
    return colors;
  }
  
  private generateRandomPosition(): { x: number; y: number } {
    const margin = 100;
    return {
      x: margin + Math.random() * (window.innerWidth - 2 * margin),
      y: margin + Math.random() * (window.innerHeight - 2 * margin)
    };
  }
  
  private generateThreePositions(): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    const margin = 100;
    const spacing = 150;
    
    for (let i = 0; i < 3; i++) {
      positions.push({
        x: margin + i * spacing + Math.random() * 50,
        y: window.innerHeight / 2 + (Math.random() - 0.5) * 100
      });
    }
    
    return positions;
  }
  
  private getRandomDuration(): number {
    return 250 + Math.random() * 250; // 250-500ms
  }
  
  private calculateDetectionThreshold(): number {
    // Simple staircase method - would be more sophisticated in practice
    const trials = this.sessionData.tasks.detection_rg.trials;
    const seenTrials = trials.filter(t => t.response.seen);
    const unseenTrials = trials.filter(t => !t.response.seen);
    
    if (seenTrials.length === 0) return 1.0;
    if (unseenTrials.length === 0) return 0.0;
    
    const seenThreshold = Math.min(...seenTrials.map(t => t.metadata.saturation));
    const unseenThreshold = Math.max(...unseenTrials.map(t => t.metadata.saturation));
    
    return (seenThreshold + unseenThreshold) / 2;
  }
  
  private calculateDiscriminationJND(): number {
    // Just Noticeable Difference calculation
    const trials = this.sessionData.tasks.discrimination_yb.trials;
    const correctTrials = trials.filter(t => t.response.correct);
    
    if (correctTrials.length === 0) return 1.0;
    
    const avgDelta = correctTrials.reduce((sum, t) => sum + t.metadata.deltaYB, 0) / correctTrials.length;
    return avgDelta;
  }
}
