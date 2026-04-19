/**
 * Professional Controls Configuration
 * Easily customize all aspects of the control system without editing component code
 */

export const CONTROLS_CONFIG = {
  // ========== CAMERA PHYSICS ==========
  CAMERA: {
    // OrbitControls damping - lower = more momentum, higher = snappier
    DAMPING_FACTOR: 0.06,

    // Rotation sensitivity - how fast camera rotates with mouse drag
    // Range: 0.1 (very slow) to 2.0 (very fast)
    ROTATE_SPEED: 0.7,

    // Zoom sensitivity - how fast zoom happens with scroll
    // Range: 0.01 (very slow) to 0.5 (very fast)
    ZOOM_SPEED: 0.08,

    // Pan sensitivity - how fast camera pans with right-click drag
    // Range: 0.1 (slow) to 2.0 (fast)
    PAN_SPEED: 0.5,

    // Camera distance limits for zoom
    MIN_ZOOM: 1,
    MAX_ZOOM: 50,

    // Field of view (degrees)
    FOV: 45,
  },

  // ========== ANIMATION TIMINGS (milliseconds) ==========
  ANIMATIONS: {
    // Duration of double-click focus animation
    DOUBLE_CLICK_DURATION: 800,

    // Duration of double-scroll quick zoom
    DOUBLE_SCROLL_DURATION: 1500,

    // Duration of ESC key reset animation
    RESET_DURATION: 800,

    // Easing type for all animations
    // Options: 'cubic', 'quadratic', 'linear', 'sine'
    EASING_TYPE: 'cubic',
  },

  // ========== GESTURE DETECTION THRESHOLDS (milliseconds) ==========
  GESTURES: {
    // Time window for detecting double-click
    // Increase if users have slow double-click, decrease if too sensitive
    DOUBLE_CLICK_THRESHOLD: 300,

    // Time window for detecting double-scroll
    DOUBLE_SCROLL_THRESHOLD: 400,

    // Minimum velocity to activate momentum
    MOMENTUM_MIN_VELOCITY: 0.001,

    // Friction multiplier for momentum (0.0-1.0)
    // Lower = faster deceleration, higher = more spin
    MOMENTUM_FRICTION: 0.95,
  },

  // ========== VISUAL FEEDBACK ==========
  VISUALS: {
    // Hotspot glow effect
    HOTSPOT_GLOW: {
      // Glow color (hex)
      COLOR: 0xffd700, // Gold

      // Glow opacity (0.0-1.0)
      OPACITY: 0.3,

      // Glow sphere size multiplier
      // 1.0 = same size as object, 1.5 = 50% larger
      RADIUS_MULTIPLIER: 1.5,

      // Glow sphere detail (lower = better performance)
      // Range: 8 (low detail) to 32 (high detail)
      GEOMETRY_SEGMENTS: 16,
    },

    // Cursor feedback
    CURSOR: {
      // Cursor style when hovering hotspot
      HOVER_STYLE: 'pointer',

      // Cursor style when in normal mode
      DEFAULT_STYLE: 'default',
    },
  },

  // ========== HOTSPOT DETECTION ==========
  HOTSPOTS: {
    // Object names to include as interactive hotspots
    // These are matched with .includes() on object.name.toLowerCase()
    INTERACTIVE_NAMES: [
      'chair',
      'table',
      'door',
      'window',
      'export',     // Suspect head exports
      'mesh',       // Generic meshes
    ],

    // Maximum raycasting distance
    RAYCASTER_MAX_DISTANCE: 10000,
  },

  // ========== CAMERA PRESETS ==========
  // Named camera positions for quick navigation
  CAMERA_PRESETS: {
    // Full room overview
    FULL_ROOM: {
      position: [500, 200, 500],
      lookAt: [0, 150, 0],
      duration: 800,
    },

    // Close-up on suspect
    SUSPECT_CLOSE: {
      position: [50, 100, 50],
      lookAt: [-5, 95, 20],
      duration: 600,
    },

    // Table-top view
    TABLE_VIEW: {
      position: [0, 150, 150],
      lookAt: [0, 70, 0],
      duration: 700,
    },

    // Side view
    SIDE_VIEW: {
      position: [400, 130, 0],
      lookAt: [0, 130, 0],
      duration: 700,
    },

    // Overhead view
    TOP_DOWN: {
      position: [0, 500, 1],
      lookAt: [0, 150, 0],
      duration: 700,
    },
  },

  // ========== PERFORMANCE SETTINGS ==========
  PERFORMANCE: {
    // Enable/disable glow effects (disable for performance)
    ENABLE_GLOW: true,

    // Enable/disable momentum physics (disable for performance)
    ENABLE_MOMENTUM: true,

    // Enable/disable smooth animations (set to false for snappy response)
    ENABLE_SMOOTH_ANIMATION: true,

    // Raycaster distance (increase for better performance on large scenes)
    RAYCASTER_PRECISION: 'medium', // 'low', 'medium', 'high'
  },

  // ========== ACCESSIBILITY ==========
  ACCESSIBILITY: {
    // Enable keyboard-only navigation
    ENABLE_KEYBOARD_ONLY: false,

    // Enable haptic feedback (vibration) on interactions
    ENABLE_HAPTICS: false,

    // Increase animation durations for slower devices
    SLOW_DEVICE_MODE: false,

    // Contrast multiplier for glow effect (for visibility)
    CONTRAST_MULTIPLIER: 1.0,
  },
} as const;

// ========== PRESET GETTER ==========
export const getCameraPreset = (name: keyof typeof CONTROLS_CONFIG.CAMERA_PRESETS) => {
  return CONTROLS_CONFIG.CAMERA_PRESETS[name];
};

// ========== VALIDATION ==========
export const validateConfig = () => {
  const cfg = CONTROLS_CONFIG;
  const errors: string[] = [];

  if (cfg.CAMERA.DAMPING_FACTOR < 0 || cfg.CAMERA.DAMPING_FACTOR > 1) {
    errors.push('DAMPING_FACTOR must be between 0 and 1');
  }
  if (cfg.CAMERA.ROTATE_SPEED <= 0) {
    errors.push('ROTATE_SPEED must be greater than 0');
  }
  if (cfg.CAMERA.ZOOM_SPEED <= 0) {
    errors.push('ZOOM_SPEED must be greater than 0');
  }
  if (cfg.CAMERA.MIN_ZOOM >= cfg.CAMERA.MAX_ZOOM) {
    errors.push('MIN_ZOOM must be less than MAX_ZOOM');
  }
  if (cfg.GESTURES.DOUBLE_CLICK_THRESHOLD <= 0) {
    errors.push('DOUBLE_CLICK_THRESHOLD must be greater than 0');
  }
  if (cfg.GESTURES.MOMENTUM_FRICTION < 0.5 || cfg.GESTURES.MOMENTUM_FRICTION > 1.0) {
    errors.push('MOMENTUM_FRICTION should be between 0.5 and 1.0');
  }

  if (errors.length > 0) {
    console.error('🚨 Control Configuration Errors:');
    errors.forEach(err => console.error(`  - ${err}`));
  }

  return errors.length === 0;
};

// Validate on import
if (typeof window !== 'undefined') {
  validateConfig();
}

export default CONTROLS_CONFIG;
