import {
  MAX_ROUNDS,
  ROUND_BUDGET,
  MAX_OPERATIONS,
  STAT_MIN,
  STAT_MAX,
  REGIONS,
  REGION_IDS,
  ROUNDS,
  OPERATIONS,
  ENDINGS,
  STANCE_LABELS
} from './gameData.js';
import { getEvent, getChoice } from './events.js';
import { createInitialState, snapshot } from './gameState.js';

export const clamp = (n) => Math.max(STAT_MIN, Math.min(STAT_MAX, n));
const round1 = (n) => Math.round(n * 10) / 10;

export const regionName = (id) => REGIONS.find((r) => r.id === id)?.name ?? id;
export const getOperation = (id) => OPERATIONS.find((o) => o.id === id) || null;
export const roundInfo = (round) => ROUNDS.find((r) => r.round === round) || null;

const fail = (error) => ({ ok: false, error });

export function startNewCampaign() {
  return createInitialState();
}

export function applyEffects(state, effects, source) {
  if (effects.reach) state.stats.reach = clamp(state.stats.reach + effects.reach);
  if (effects.credibility) state.stats.credibility = clamp(state.stats.credibility + effects.credibility);
  if (effects.allRegions) {
    for (const id of REGION_IDS) state.regions[id] = clamp(state.regions[id] + effects.allRegions);
  }
  if (effects.regions) {
    for (const [id, value] of Object.entries(effects.regions)) {
      if (REGION_IDS.includes(id)) state.regions[id] = clamp(state.regions[id] + value);
    }
  }
  if (effects.delayed) {
    for (const d of effects.delayed) {
      state.delayed.push({
        applyRound: state.round + (d.rounds || 1),
        region: d.region,
        influence: d.influence,
        source,
        sourceRound: state.round
      });
    }
  }
  return state;
}

export function getOperationEffects(opId, regionId, credibility) {
  const op = getOperation(opId);
  let credibilityChange = op.effects.credibility;
  let penaltyApplied = false;
  if (op.lowCredibilityPenalty && credibility < op.lowCredibilityPenalty.threshold) {
    credibilityChange += op.lowCredibilityPenalty.credibility;
    penaltyApplied = true;
  }
  return {
    reach: op.effects.reach,
    credibility: credibilityChange,
    regions: { [regionId]: op.effects.region },
    delayed: op.delayed ? [{ region: regionId, influence: op.delayed.region, rounds: op.delayed.rounds }] : [],
    penaltyApplied
  };
}

export function effectLines(effects) {
  const lines = [];
  const push = (label, value, suffix = '') => {
    if (value) lines.push({ label, value, text: `${label} ${value > 0 ? '+' : ''}${value}${suffix}` });
  };
  push('Reach', effects.reach);
  push('Credibility', effects.credibility);
  push('All regions', effects.allRegions);
  for (const [id, v] of Object.entries(effects.regions || {})) push(regionName(id), v);
  for (const d of effects.delayed || []) push(regionName(d.region), d.influence, ' next round');
  return lines;
}

export function beginRound(state, round) {
  state.round = round;
  state.budget = ROUND_BUDGET;
  state.opsRemaining = MAX_OPERATIONS;
  state.eventChoice = null;
  state.roundStart = snapshot(state);
  state.appliedDelayed = [];
  const due = state.delayed.filter((d) => d.applyRound <= round);
  state.delayed = state.delayed.filter((d) => d.applyRound > round);
  for (const d of due) {
    state.regions[d.region] = clamp(state.regions[d.region] + d.influence);
    state.appliedDelayed.push(d);
  }
  state.phase = 'event';
  return { ok: true };
}

export function beginCampaign(state) {
  if (state.phase !== 'briefing') return fail('The campaign has already begun.');
  return beginRound(state, 1);
}

export function applyEventChoice(state, choiceId) {
  if (state.phase !== 'event') return fail('There is no event awaiting a decision.');
  if (state.eventChoice !== null) return fail('This event has already been answered.');
  const choice = getChoice(state.round, choiceId);
  if (!choice) return fail('Select one of the three responses.');
  applyEffects(state, choice.effects, `Event: ${getEvent(state.round).title}`);
  state.eventChoice = choiceId;
  state.eventHistory.push({ round: state.round, eventId: getEvent(state.round).id, choiceId });
  state.phase = 'command';
  return { ok: true, choice };
}

export function validateOperation(state, opId, regionId) {
  if (state.phase !== 'command') return fail('Operations are not available right now.');
  if (state.eventChoice === null) return fail('Respond to the historical event before running operations.');
  const op = getOperation(opId);
  if (!op) return fail('Select an operation.');
  if (!REGION_IDS.includes(regionId)) return fail('Select a target region.');
  if (state.opsRemaining <= 0) return fail(`No operations remain this round (maximum ${MAX_OPERATIONS}).`);
  if (state.budget < op.cost) return fail(`Insufficient budget: ${op.name} costs ${op.cost}, you have ${state.budget}.`);
  return { ok: true, op };
}

export function executeOperation(state, opId, regionId) {
  const check = validateOperation(state, opId, regionId);
  if (!check.ok) return check;
  const effects = getOperationEffects(opId, regionId, state.stats.credibility);
  applyEffects(state, effects, check.op.name);
  state.budget -= check.op.cost;
  state.opsRemaining -= 1;
  state.opsHistory.push({ round: state.round, opId, region: regionId, cost: check.op.cost });
  return { ok: true, op: check.op, effects };
}

export function canEndRound(state) {
  if (state.phase !== 'command') return { ok: false, reason: 'The round is not in progress.' };
  if (state.eventChoice === null) return { ok: false, reason: 'Respond to the historical event first.' };
  const done = state.opsHistory.filter((o) => o.round === state.round).length;
  if (done === 0) return { ok: false, reason: 'Run at least one operation before ending the round.' };
  return { ok: true, reason: '' };
}

export function roundOperations(state, round = state.round) {
  return state.opsHistory.filter((o) => o.round === round);
}

export function endRound(state) {
  const check = canEndRound(state);
  if (!check.ok) return fail(check.reason);
  const closing = state.round === MAX_ROUNDS;
  const appliedClosing = [];
  if (closing) {
    for (const d of state.delayed) {
      state.regions[d.region] = clamp(state.regions[d.region] + d.influence);
      appliedClosing.push(d);
    }
    state.delayed = [];
  }
  const event = getEvent(state.round);
  const choice = getChoice(state.round, state.eventChoice);
  const ops = roundOperations(state);
  const summary = {
    round: state.round,
    year: roundInfo(state.round).year,
    eventTitle: event.title,
    choiceLabel: choice.label,
    spent: ops.reduce((s, o) => s + o.cost, 0),
    before: state.roundStart,
    after: snapshot(state),
    operations: ops.map((o) => ({ opId: o.opId, name: getOperation(o.opId).name, region: o.region, cost: o.cost })),
    delayedApplied: [...state.appliedDelayed, ...appliedClosing],
    delayedScheduled: state.delayed.map((d) => ({ ...d }))
  };
  state.summaries.push(summary);
  state.phase = 'summary';
  return { ok: true, summary };
}

export function averageInfluence(regions) {
  return round1(REGION_IDS.reduce((s, id) => s + regions[id], 0) / REGION_IDS.length);
}

export function calculateScore(stats, regions) {
  const score = 0.5 * averageInfluence(regions) + 0.3 * stats.credibility + 0.2 * stats.reach;
  return round1(Math.max(0, Math.min(100, score)));
}

export function determineEnding(stats, regions, score = calculateScore(stats, regions)) {
  const avg = averageInfluence(regions);
  if (score >= 75 && stats.credibility >= 65) return 'credible';
  if (stats.reach >= 70 && stats.credibility < 65 && avg >= 45) return 'dominance';
  if (stats.credibility < 45 || avg < 40) return 'divided';
  return 'failed';
}

export function computeFinal(state) {
  const score = calculateScore(state.stats, state.regions);
  const ending = determineEnding(state.stats, state.regions, score);
  return {
    score,
    ending,
    endingTitle: ENDINGS[ending].title,
    averageInfluence: averageInfluence(state.regions),
    reach: state.stats.reach,
    credibility: state.stats.credibility,
    regions: { ...state.regions }
  };
}

export function advanceRound(state) {
  if (state.phase !== 'summary') return fail('The round summary has not been reached yet.');
  if (state.round < MAX_ROUNDS) return beginRound(state, state.round + 1);
  state.final = computeFinal(state);
  state.phase = 'final';
  return { ok: true };
}

export function describeStrategy(state) {
  const lines = [];
  const ops = state.opsHistory.map((o) => ({ ...o, op: getOperation(o.opId) }));
  const reachOps = ops.filter((o) => o.op.focus === 'reach').length;
  const credOps = ops.filter((o) => o.op.focus === 'credibility').length;
  if (ops.length) {
    if (reachOps > credOps) lines.push(`Your operations leaned toward visibility: ${reachOps} of ${ops.length} favored reach over credibility.`);
    else if (credOps > reachOps) lines.push(`Your operations leaned toward trust: ${credOps} of ${ops.length} favored credibility over reach.`);
    else lines.push('Your operations balanced visibility and trust evenly.');
  }

  const counts = {};
  for (const h of state.eventHistory) {
    const stance = getChoice(h.round, h.choiceId).stance;
    counts[stance] = (counts[stance] || 0) + 1;
  }
  const stanceText = Object.entries(counts)
    .map(([k, v]) => `${v} ${STANCE_LABELS[k].toLowerCase()}`)
    .join(', ');
  if (stanceText) lines.push(`Your five public responses were: ${stanceText}.`);
  if (counts.denial) {
    lines.push(`Denial was the most expensive stance in the game. It appeared ${counts.denial} time${counts.denial > 1 ? 's' : ''} and carried the largest credibility losses.`);
  } else if ((counts.candid || 0) >= 3) {
    lines.push('Candid responses to difficult events protected credibility, which in turn made later operations more convincing.');
  }

  const spend = Object.fromEntries(REGION_IDS.map((id) => [id, 0]));
  for (const o of ops) spend[o.region] += 1;
  const ranked = REGION_IDS.slice().sort((a, b) => state.regions[b] - state.regions[a]);
  lines.push(`${regionName(ranked[0])} ended as your strongest region (${state.regions[ranked[0]]}) and ${regionName(ranked[2])} as your weakest (${state.regions[ranked[2]]}).`);

  const gap = state.stats.reach - state.stats.credibility;
  if (gap >= 20) lines.push(`Reach exceeded credibility by ${gap} points. Many people heard the message, but fewer believed it.`);
  else if (gap <= -20) lines.push(`Credibility exceeded reach by ${-gap} points. The message was trusted but did not travel as far as it could have.`);
  else lines.push('Reach and credibility ended close together, which suggests the campaign grew in both directions.');
  return lines;
}
