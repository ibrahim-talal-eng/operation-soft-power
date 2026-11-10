import {
  SAVE_VERSION,
  MAX_ROUNDS,
  ROUND_BUDGET,
  MAX_OPERATIONS,
  INITIAL_STATS,
  INITIAL_REGIONS,
  REGION_IDS,
  OPERATIONS
} from './gameData.js';
import { getEvent } from './events.js';

export const PHASES = ['briefing', 'event', 'command', 'summary', 'final'];

export function createInitialState() {
  return {
    version: SAVE_VERSION,
    phase: 'briefing',
    round: 1,
    stats: { ...INITIAL_STATS },
    regions: { ...INITIAL_REGIONS },
    budget: ROUND_BUDGET,
    opsRemaining: MAX_OPERATIONS,
    eventChoice: null,
    eventHistory: [],
    opsHistory: [],
    delayed: [],
    appliedDelayed: [],
    roundStart: null,
    summaries: [],
    final: null
  };
}

export function snapshot(state) {
  return {
    reach: state.stats.reach,
    credibility: state.stats.credibility,
    regions: { ...state.regions }
  };
}

const isInt = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

function isSnapshot(s) {
  return (
    s &&
    typeof s === 'object' &&
    isInt(s.reach, 0, 100) &&
    isInt(s.credibility, 0, 100) &&
    s.regions &&
    REGION_IDS.every((id) => isInt(s.regions[id], 0, 100))
  );
}

function cleanSnapshot(s) {
  return { reach: s.reach, credibility: s.credibility, regions: Object.fromEntries(REGION_IDS.map((id) => [id, s.regions[id]])) };
}

function validDelayed(d) {
  return (
    d &&
    typeof d === 'object' &&
    isInt(d.applyRound, 2, MAX_ROUNDS + 1) &&
    REGION_IDS.includes(d.region) &&
    isInt(d.influence, 0, 20) &&
    typeof d.source === 'string' &&
    isInt(d.sourceRound, 1, MAX_ROUNDS)
  );
}

function cleanDelayed(d) {
  return { applyRound: d.applyRound, region: d.region, influence: d.influence, source: d.source, sourceRound: d.sourceRound };
}

function validSummary(s, round) {
  return (
    s &&
    typeof s === 'object' &&
    s.round === round &&
    typeof s.year === 'string' &&
    typeof s.eventTitle === 'string' &&
    typeof s.choiceLabel === 'string' &&
    typeof s.spent === 'number' &&
    isSnapshot(s.before) &&
    isSnapshot(s.after) &&
    Array.isArray(s.operations) &&
    s.operations.every((o) => o && typeof o.name === 'string' && REGION_IDS.includes(o.region) && typeof o.cost === 'number') &&
    Array.isArray(s.delayedApplied) &&
    s.delayedApplied.every(validDelayed) &&
    Array.isArray(s.delayedScheduled) &&
    s.delayedScheduled.every(validDelayed)
  );
}

function cleanSummary(s) {
  return {
    round: s.round,
    year: s.year,
    eventTitle: s.eventTitle,
    choiceLabel: s.choiceLabel,
    spent: s.spent,
    before: cleanSnapshot(s.before),
    after: cleanSnapshot(s.after),
    operations: s.operations.map((o) => ({ opId: String(o.opId), name: o.name, region: o.region, cost: o.cost })),
    delayedApplied: s.delayedApplied.map(cleanDelayed),
    delayedScheduled: s.delayedScheduled.map(cleanDelayed)
  };
}

export function validateState(raw) {
  try {
    if (!raw || typeof raw !== 'object' || raw.version !== SAVE_VERSION) return null;
    if (!PHASES.includes(raw.phase)) return null;
    if (!isInt(raw.round, 1, MAX_ROUNDS)) return null;
    if (!raw.stats || !isInt(raw.stats.reach, 0, 100) || !isInt(raw.stats.credibility, 0, 100)) return null;
    if (!raw.regions || !REGION_IDS.every((id) => isInt(raw.regions[id], 0, 100))) return null;
    if (!isInt(raw.budget, 0, ROUND_BUDGET) || !isInt(raw.opsRemaining, 0, MAX_OPERATIONS)) return null;
    if (!Array.isArray(raw.eventHistory) || !Array.isArray(raw.opsHistory)) return null;
    if (!Array.isArray(raw.delayed) || !raw.delayed.every(validDelayed)) return null;
    if (!Array.isArray(raw.summaries)) return null;

    const { phase, round } = raw;
    if (phase === 'final' && round !== MAX_ROUNDS) return null;
    const expectedEvents = { briefing: 0, event: round - 1, command: round, summary: round, final: MAX_ROUNDS }[phase];
    if (raw.eventHistory.length !== expectedEvents) return null;
    const eventHistory = [];
    for (let i = 0; i < raw.eventHistory.length; i++) {
      const h = raw.eventHistory[i];
      const event = getEvent(i + 1);
      if (!h || h.round !== i + 1 || !event || h.eventId !== event.id || !event.choices.some((c) => c.id === h.choiceId)) return null;
      eventHistory.push({ round: h.round, eventId: h.eventId, choiceId: h.choiceId });
    }

    const opsHistory = [];
    for (const o of raw.opsHistory) {
      const op = OPERATIONS.find((x) => x.id === o?.opId);
      if (!op || !REGION_IDS.includes(o.region) || !isInt(o.round, 1, round) || o.cost !== op.cost) return null;
      opsHistory.push({ round: o.round, opId: o.opId, region: o.region, cost: o.cost });
    }
    for (let r = 1; r <= MAX_ROUNDS; r++) {
      const inRound = opsHistory.filter((o) => o.round === r);
      if (inRound.length > MAX_OPERATIONS || inRound.reduce((s, o) => s + o.cost, 0) > ROUND_BUDGET) return null;
    }

    const currentOps = opsHistory.filter((o) => o.round === round);
    const spent = currentOps.reduce((s, o) => s + o.cost, 0);
    if (phase === 'briefing' && (opsHistory.length > 0 || round !== 1)) return null;
    if (phase === 'event') {
      if (raw.eventChoice !== null || currentOps.length !== 0 || raw.budget !== ROUND_BUDGET || raw.opsRemaining !== MAX_OPERATIONS) return null;
    }
    if (phase === 'command') {
      if (raw.eventChoice !== eventHistory[round - 1].choiceId) return null;
      if (raw.budget !== ROUND_BUDGET - spent || raw.opsRemaining !== MAX_OPERATIONS - currentOps.length) return null;
    }

    const expectedSummaries = { briefing: 0, event: round - 1, command: round - 1, summary: round, final: MAX_ROUNDS }[phase];
    if (raw.summaries.length !== expectedSummaries) return null;
    const summaries = [];
    for (let i = 0; i < raw.summaries.length; i++) {
      if (!validSummary(raw.summaries[i], i + 1)) return null;
      summaries.push(cleanSummary(raw.summaries[i]));
    }

    if (['event', 'command', 'summary'].includes(phase) && !isSnapshot(raw.roundStart)) return null;
    const appliedDelayed = Array.isArray(raw.appliedDelayed) && raw.appliedDelayed.every(validDelayed) ? raw.appliedDelayed.map(cleanDelayed) : [];

    return {
      version: SAVE_VERSION,
      phase,
      round,
      stats: { reach: raw.stats.reach, credibility: raw.stats.credibility },
      regions: Object.fromEntries(REGION_IDS.map((id) => [id, raw.regions[id]])),
      budget: raw.budget,
      opsRemaining: raw.opsRemaining,
      eventChoice: phase === 'command' ? raw.eventChoice : phase === 'event' ? null : eventHistory[round - 1]?.choiceId ?? null,
      eventHistory,
      opsHistory,
      delayed: raw.delayed.map(cleanDelayed),
      appliedDelayed,
      roundStart: isSnapshot(raw.roundStart) ? cleanSnapshot(raw.roundStart) : null,
      summaries,
      final: null
    };
  } catch {
    return null;
  }
}
