// ═══════════════════════════════════════════════════════════════
// lib/voice-state-machine.js — Lightweight state machine for voice calls
// ═══════════════════════════════════════════════════════════════
// Custom state machine (no external dependencies) that models the
// RomainGE voice-call lifecycle with guards, actions, and history.
// ═══════════════════════════════════════════════════════════════

// ─── States ─────────────────────────────────────────────────────
export const STATES = {
  IDLE: "idle",
  GREETING: "greeting",
  RECORDING_CONSENT: "recording_consent",
  GATHER_NAME: "gather_name",
  GATHER_QUERY: "gather_query",
  CLASSIFYING: "classifying",
  SPECIALIST: "specialist",
  NIF_DICTATION: "nif_dictation",
  TRANSFER_HUMAN: "transfer_human",
  ENDED: "ended",
};

// ─── Events ─────────────────────────────────────────────────────
export const EVENTS = {
  SETUP: "setup",
  RECORDING_CONSENT: "recording_consent",
  CONSENT_GIVEN: "consent_given",
  CONSENT_DENIED: "consent_denied",
  NAME_PROVIDED: "name_provided",
  NAME_CAPTURED: "name_captured",
  INTENT_CLASSIFIED: "intent_classified",
  SPECIALIST_READY: "specialist_ready",
  UNCLASSIFIED: "unclassified",
  NIF_REQUESTED: "nif_requested",
  NIF_VALIDATED: "nif_validated",
  NIF_INVALID: "nif_invalid",
  TRANSFER_REQUESTED: "transfer_requested",
  TRANSFERRED: "transferred",
  END_CALL: "end_call",
  REPEAT: "repeat",
  CALLBACK_REQUESTED: "callback_requested",
};

// ═══════════════════════════════════════════════════════════════
// VoiceStateMachine class
// ═══════════════════════════════════════════════════════════════

export class VoiceStateMachine {
  /**
   * @param {Object} config
   * @param {string} config.initial — initial state name
   * @param {Object} config.context — shared mutable context
   * @param {Object} config.states — Map of state name → definition
   *   Each definition: { onEnter?, onExit?, transitions: { eventName: { target, guard?, action? } } }
   * @param {Object} config.globalTransitions — transitions valid from ANY state
   */
  constructor({ initial, context, states, globalTransitions = {} }) {
    this._current = initial;
    this._context = context;
    this._states = states;
    this._globalTransitions = globalTransitions;
    this._history = [];
  }

  /** Current state name */
  getState() {
    return this._current;
  }

  /** Shared mutable context object */
  getContext() {
    return this._context;
  }

  /** Array of { from, to, event, timestamp } for debugging */
  getHistory() {
    return [...this._history];
  }

  /**
   * Check whether a transition is valid for the given event
   * (looks up state-specific transitions first, then global).
   */
  canTransition(event) {
    const stateConf = this._states[this._current];
    const trans =
      stateConf?.transitions?.[event] || this._globalTransitions[event];
    if (!trans) return false;
    if (typeof trans.guard === "function") {
      return trans.guard(this._context);
    }
    return true;
  }

  /**
   * Execute a transition.
   * @param {string} event — event name
   * @param {*} payload — arbitrary data forwarded to guard/action/hooks
   * @returns {{ transitioned: boolean, from: string, to: string }}
   */
  async transition(event, payload) {
    const stateConf = this._states[this._current];
    const trans =
      stateConf?.transitions?.[event] || this._globalTransitions[event];

    if (!trans) {
      return { transitioned: false, from: this._current, to: this._current };
    }

    // Guard — may veto the transition
    if (typeof trans.guard === "function" && !trans.guard(this._context, payload)) {
      return { transitioned: false, from: this._current, to: this._current };
    }

    const from = this._current;
    // For "repeat" the target may be null/undefined (stay in same state)
    const to = trans.target ?? this._current;

    // onExit of current state (only if actually changing)
    if (from !== to) {
      const exitHook = this._states[from]?.onExit;
      if (typeof exitHook === "function") {
        await exitHook(this._context, payload);
      }
    }

    // Action attached to the transition itself
    if (typeof trans.action === "function") {
      await trans.action(this._context, payload);
    }

    // Update current state
    this._current = to;

    // onEnter of new state (only if actually changing)
    if (from !== to) {
      const enterHook = this._states[to]?.onEnter;
      if (typeof enterHook === "function") {
        await enterHook(this._context, payload);
      }
    }

    // Record history
    this._history.push({ from, to, event, timestamp: Date.now() });

    return { transitioned: true, from, to };
  }
}

// ═══════════════════════════════════════════════════════════════
// Factory: create a voice-call state machine bound to context
// ═══════════════════════════════════════════════════════════════

/**
 * @param {Object} deps — external functions injected for testability
 * @param {Function} deps.sendText
 * @param {Function} deps.sendEnd
 * @param {Function} deps.sendLanguageSwitch
 * @param {Function} deps.isAtCapacity
 * @param {Function} deps.registerCall
 * @param {Function} deps.detectLanguage
 */
export function createVoiceStateMachine(deps = {}) {
  const context = {
    ws: null,
    callSid: null,
    callerPhone: null,
    callerName: null,
    callerLastName: null,
    sessionId: null,
    service: null,
    language: "es-ES",
    lastAgentResponse: null,
    conversationHistory: [],
    nifBuffer: null,
    recording: false,
    recordingConsent: null,
  };

  const states = {
    // ── IDLE ───────────────────────────────────────
    [STATES.IDLE]: {
      transitions: {
        [EVENTS.SETUP]: {
          target: STATES.GREETING,
          action: async (ctx, payload) => {
            ctx.callSid = payload.callSid;
            ctx.callerPhone = payload.from || "unknown";
            ctx.ws = payload.ws;
          },
        },
      },
    },

    // ── GREETING ──────────────────────────────────
    [STATES.GREETING]: {
      transitions: {
        [EVENTS.RECORDING_CONSENT]: {
          target: STATES.RECORDING_CONSENT,
        },
        [EVENTS.NAME_PROVIDED]: {
          target: STATES.GATHER_NAME,
        },
      },
    },

    // ── RECORDING_CONSENT ─────────────────────────
    [STATES.RECORDING_CONSENT]: {
      transitions: {
        [EVENTS.CONSENT_GIVEN]: {
          target: STATES.GATHER_NAME,
          action: async (ctx) => {
            ctx.recordingConsent = "granted";
            ctx.recording = true;
          },
        },
        [EVENTS.CONSENT_DENIED]: {
          target: STATES.GATHER_NAME,
          action: async (ctx) => {
            ctx.recordingConsent = "denied";
            ctx.recording = false;
          },
        },
      },
    },

    // ── GATHER_NAME ───────────────────────────────
    [STATES.GATHER_NAME]: {
      transitions: {
        [EVENTS.NAME_CAPTURED]: {
          target: STATES.GATHER_QUERY,
          action: async (ctx, payload) => {
            ctx.callerName = payload.name;
            ctx.callerLastName = payload.lastName;
          },
        },
      },
    },

    // ── GATHER_QUERY ──────────────────────────────
    [STATES.GATHER_QUERY]: {
      transitions: {
        [EVENTS.INTENT_CLASSIFIED]: {
          target: STATES.CLASSIFYING,
        },
      },
    },

    // ── CLASSIFYING ───────────────────────────────
    [STATES.CLASSIFYING]: {
      transitions: {
        [EVENTS.SPECIALIST_READY]: {
          target: STATES.SPECIALIST,
          action: async (ctx, payload) => {
            ctx.sessionId = payload.sessionId;
            ctx.service = payload.service;
          },
        },
        [EVENTS.UNCLASSIFIED]: {
          target: STATES.GATHER_QUERY,
        },
      },
    },

    // ── SPECIALIST ────────────────────────────────
    [STATES.SPECIALIST]: {
      transitions: {
        [EVENTS.NIF_REQUESTED]: {
          target: STATES.NIF_DICTATION,
          action: async (ctx) => {
            ctx.nifBuffer = null;
          },
        },
        [EVENTS.TRANSFER_REQUESTED]: {
          target: STATES.TRANSFER_HUMAN,
        },
      },
    },

    // ── NIF_DICTATION ─────────────────────────────
    [STATES.NIF_DICTATION]: {
      transitions: {
        [EVENTS.NIF_VALIDATED]: {
          target: STATES.SPECIALIST,
        },
        [EVENTS.NIF_INVALID]: {
          target: STATES.NIF_DICTATION,
        },
      },
    },

    // ── TRANSFER_HUMAN ────────────────────────────
    [STATES.TRANSFER_HUMAN]: {
      transitions: {
        [EVENTS.TRANSFERRED]: {
          target: STATES.ENDED,
        },
      },
    },

    // ── ENDED ─────────────────────────────────────
    [STATES.ENDED]: {
      transitions: {},
    },
  };

  // Global transitions — valid from any state
  const globalTransitions = {
    [EVENTS.END_CALL]: {
      target: STATES.ENDED,
    },
    [EVENTS.REPEAT]: {
      // Stay in current state, no target override (null → same state)
      target: null,
    },
    [EVENTS.CALLBACK_REQUESTED]: {
      target: STATES.ENDED,
    },
  };

  return new VoiceStateMachine({
    initial: STATES.IDLE,
    context,
    states,
    globalTransitions,
  });
}
