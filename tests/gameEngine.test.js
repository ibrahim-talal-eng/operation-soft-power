import test from 'node:test';
import assert from 'node:assert/strict';

import { INITIAL_STATS, INITIAL_REGIONS, REGION_IDS, OPERATIONS, ROUND_BUDGET } from '../js/gameData.js';
import { EVENTS } from '../js/events.js';
import {
  startNewCampaign,
  beginCampaign,
  applyEventChoice,
  executeOperation,
  canEndRound,
  endRound,
  advanceRound,
  calculateScore,
  determineEnding,
  computeFinal,
  applyEffects,
  getOperationEffects
} from '../js/gameEngine.js';
import { validateState } from '../js/gameState.js';
import { saveGame, loadGame, clearSave, hasSave, SAVE_KEY } from '../js/storage.js';

function memoryStore() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k)
  };
}

function inRoundOne() {
  const s = startNewCampaign();
  beginCampaign(s);
  return s;
}

function inCommand() {
  const s = inRoundOne();
  applyEventChoice(s, 'a');
  return s;
}

function playRound(s, choiceId, ops) {
  assert.equal(applyEventChoice(s, choiceId).ok, true);
  for (const [opId, region] of ops) assert.equal(executeOperation(s, opId, region).ok, true);
  assert.equal(endRound(s).ok, true);
  assert.equal(advanceRound(s).ok, true);
}

function stateWith(stats, regions) {
  const s = startNewCampaign();
  s.stats = { ...stats };
  s.regions = { ...regions };
  return s;
}

test('1. a new campaign starts with the specified statistics', () => {
  const s = startNewCampaign();
  assert.deepEqual(s.stats, INITIAL_STATS);
  assert.deepEqual(s.regions, INITIAL_REGIONS);
  assert.equal(s.stats.reach, 15);
  assert.equal(s.stats.credibility, 55);
  assert.equal(s.budget, 6);
  assert.equal(s.round, 1);
  assert.equal(s.phase, 'briefing');
  beginCampaign(s);
  assert.equal(s.phase, 'event');
  assert.equal(s.opsRemaining, 2);
});

test('2. an operation cannot be executed without enough budget', () => {
  const s = inCommand();
  assert.equal(executeOperation(s, 'academic', 'europe').ok, true);
  const before = JSON.stringify(s);
  const r = executeOperation(s, 'academic', 'europe');
  assert.equal(r.ok, false);
  assert.match(r.error, /budget/i);
  assert.equal(JSON.stringify(s), before);
});

test('3. no more than two operations per round', () => {
  const s = inCommand();
  assert.equal(executeOperation(s, 'broadcast', 'europe').ok, true);
  assert.equal(executeOperation(s, 'broadcast', 'latam').ok, true);
  const r = executeOperation(s, 'broadcast', 'afroasia');
  assert.equal(r.ok, false);
  assert.match(r.error, /No operations remain/);
  assert.equal(s.budget, 2);
});

test('3b. operations need an event decision, a region and a valid id', () => {
  const s = inRoundOne();
  assert.equal(executeOperation(s, 'jazz', 'europe').ok, false);
  applyEventChoice(s, 'a');
  assert.equal(executeOperation(s, 'jazz', null).ok, false);
  assert.equal(executeOperation(s, 'nonsense', 'europe').ok, false);
  assert.equal(s.opsHistory.length, 0);
});

test('4. event decisions apply exactly once', () => {
  const s = inRoundOne();
  const r1 = applyEventChoice(s, 'a');
  assert.equal(r1.ok, true);
  assert.equal(s.stats.credibility, 62);
  assert.equal(s.stats.reach, 17);
  assert.equal(s.regions.afroasia, 45);
  const r2 = applyEventChoice(s, 'b');
  assert.equal(r2.ok, false);
  assert.equal(s.stats.credibility, 62);
  assert.equal(s.eventHistory.length, 1);
});

test('4b. every event applies its defined effects through the generic function', () => {
  for (const event of EVENTS) {
    for (const choice of event.choices) {
      const s = stateWith({ reach: 50, credibility: 50 }, { europe: 50, afroasia: 50, latam: 50 });
      s.round = event.round;
      applyEffects(s, choice.effects, 'test');
      assert.equal(s.stats.reach, 50 + (choice.effects.reach || 0));
      assert.equal(s.stats.credibility, 50 + (choice.effects.credibility || 0));
      for (const id of REGION_IDS) {
        const expected = 50 + (choice.effects.allRegions || 0) + (choice.effects.regions?.[id] || 0);
        assert.equal(s.regions[id], expected, `${event.id}/${choice.id}/${id}`);
      }
    }
  }
});

test('5. regional influence updates for the target region only', () => {
  const s = inCommand();
  const before = { ...s.regions };
  executeOperation(s, 'jazz', 'latam');
  assert.equal(s.regions.latam, before.latam + 8);
  assert.equal(s.regions.europe, before.europe);
  assert.equal(s.regions.afroasia, before.afroasia);
});

test('6. statistics are clamped between 0 and 100', () => {
  const s = stateWith({ reach: 98, credibility: 3 }, { europe: 99, afroasia: 1, latam: 50 });
  applyEffects(s, { reach: 12, credibility: -10, regions: { europe: 8, afroasia: -9 } }, 'test');
  assert.equal(s.stats.reach, 100);
  assert.equal(s.stats.credibility, 0);
  assert.equal(s.regions.europe, 100);
  assert.equal(s.regions.afroasia, 0);
});

test('7. Academic Exchange delayed influence applies at the start of the next round', () => {
  const s = inCommand();
  executeOperation(s, 'academic', 'afroasia');
  assert.equal(s.delayed.length, 1);
  assert.equal(s.delayed[0].applyRound, 2);
  const afterRound1 = s.regions.afroasia;
  executeOperation(s, 'broadcast', 'europe');
  endRound(s);
  assert.equal(s.regions.afroasia, afterRound1);
  advanceRound(s);
  assert.equal(s.round, 2);
  assert.equal(s.regions.afroasia, afterRound1 + 2);
  assert.equal(s.delayed.length, 0);
  assert.equal(s.appliedDelayed.length, 1);
});

test('7b. delayed influence scheduled in the last round settles when the campaign closes', () => {
  const s = startNewCampaign();
  beginCampaign(s);
  for (let r = 1; r <= 4; r++) playRound(s, 'a', [['broadcast', 'europe']]);
  applyEventChoice(s, 'a');
  const before = s.regions.latam;
  executeOperation(s, 'academic', 'latam');
  const afterOp = s.regions.latam;
  assert.equal(afterOp, before + 5);
  const result = endRound(s);
  assert.equal(s.regions.latam, afterOp + 2);
  assert.equal(result.summary.delayedApplied.length, 1);
  assert.equal(s.delayed.length, 0);
});

test('8. budget and operations reset at the start of every round', () => {
  const s = inCommand();
  executeOperation(s, 'academic', 'europe');
  executeOperation(s, 'broadcast', 'europe');
  assert.equal(s.budget, 0);
  endRound(s);
  advanceRound(s);
  assert.equal(s.budget, ROUND_BUDGET);
  assert.equal(s.opsRemaining, 2);
  assert.equal(s.eventChoice, null);
  assert.equal(s.phase, 'event');
});

test('9. rounds cannot skip required phases', () => {
  const s = inRoundOne();
  assert.equal(endRound(s).ok, false);
  assert.equal(advanceRound(s).ok, false);
  assert.equal(canEndRound(s).ok, false);
  applyEventChoice(s, 'c');
  assert.equal(canEndRound(s).ok, false);
  assert.equal(endRound(s).ok, false);
  assert.equal(advanceRound(s).ok, false);
  executeOperation(s, 'broadcast', 'europe');
  assert.equal(canEndRound(s).ok, true);
  assert.equal(endRound(s).ok, true);
  assert.equal(endRound(s).ok, false);
  assert.equal(executeOperation(s, 'broadcast', 'europe').ok, false);
  assert.equal(applyEventChoice(s, 'a').ok, false);
  assert.equal(advanceRound(s).ok, true);
  assert.equal(beginCampaign(s).ok, false);
});

test('9b. broadcasting below the credibility threshold adds a penalty', () => {
  const healthy = getOperationEffects('broadcast', 'europe', 35);
  assert.equal(healthy.credibility, 0);
  assert.equal(healthy.penaltyApplied, false);
  const weak = getOperationEffects('broadcast', 'europe', 34);
  assert.equal(weak.credibility, -4);
  assert.equal(weak.penaltyApplied, true);
  const s = stateWith({ reach: 10, credibility: 30 }, INITIAL_REGIONS);
  s.phase = 'command';
  s.eventChoice = 'a';
  executeOperation(s, 'broadcast', 'europe');
  assert.equal(s.stats.credibility, 26);
  assert.equal(s.stats.reach, 22);
});

test('9c. all operations apply their documented values', () => {
  for (const op of OPERATIONS) {
    const s = stateWith({ reach: 40, credibility: 50 }, { europe: 40, afroasia: 40, latam: 40 });
    s.phase = 'command';
    s.eventChoice = 'a';
    executeOperation(s, op.id, 'europe');
    assert.equal(s.stats.reach, 40 + op.effects.reach, op.id);
    assert.equal(s.stats.credibility, 50 + op.effects.credibility, op.id);
    assert.equal(s.regions.europe, 40 + op.effects.region, op.id);
    assert.equal(s.budget, 6 - op.cost, op.id);
  }
});

test('10. all five rounds can be completed', () => {
  const s = startNewCampaign();
  beginCampaign(s);
  const regions = ['europe', 'afroasia', 'latam', 'europe', 'afroasia'];
  for (let r = 1; r <= 5; r++) {
    assert.equal(s.round, r);
    playRound(s, 'a', [['jazz', regions[r - 1]], ['broadcast', regions[(r) % 3]]]);
  }
  assert.equal(s.phase, 'final');
  assert.ok(s.final);
  assert.equal(s.summaries.length, 5);
  assert.equal(s.eventHistory.length, 5);
  assert.equal(s.opsHistory.length, 10);
});

test('11. the final score uses S = 0.5I + 0.3C + 0.2R', () => {
  const stats = { reach: 80, credibility: 70 };
  const regions = { europe: 60, afroasia: 50, latam: 40 };
  assert.equal(calculateScore(stats, regions), 0.5 * 50 + 0.3 * 70 + 0.2 * 80);
  assert.equal(calculateScore({ reach: 0, credibility: 0 }, { europe: 0, afroasia: 0, latam: 0 }), 0);
  assert.equal(calculateScore({ reach: 100, credibility: 100 }, { europe: 100, afroasia: 100, latam: 100 }), 100);
});

test('12. all four endings are reachable and ordered correctly', () => {
  const credible = stateWith({ reach: 80, credibility: 80 }, { europe: 85, afroasia: 80, latam: 75 });
  assert.equal(determineEnding(credible.stats, credible.regions), 'credible');

  const dominance = stateWith({ reach: 85, credibility: 50 }, { europe: 55, afroasia: 50, latam: 50 });
  assert.equal(determineEnding(dominance.stats, dominance.regions), 'dominance');

  const lowCredHighReach = stateWith({ reach: 85, credibility: 30 }, { europe: 55, afroasia: 50, latam: 50 });
  assert.equal(determineEnding(lowCredHighReach.stats, lowCredHighReach.regions), 'dominance');

  const divided = stateWith({ reach: 40, credibility: 30 }, { europe: 40, afroasia: 40, latam: 40 });
  assert.equal(determineEnding(divided.stats, divided.regions), 'divided');

  const dividedByInfluence = stateWith({ reach: 60, credibility: 60 }, { europe: 35, afroasia: 35, latam: 35 });
  assert.equal(determineEnding(dividedByInfluence.stats, dividedByInfluence.regions), 'divided');

  const failed = stateWith({ reach: 50, credibility: 55 }, { europe: 50, afroasia: 50, latam: 50 });
  assert.equal(determineEnding(failed.stats, failed.regions), 'failed');

  const highScoreLowCred = stateWith({ reach: 100, credibility: 64 }, { europe: 100, afroasia: 100, latam: 100 });
  assert.equal(determineEnding(highScoreLowCred.stats, highScoreLowCred.regions), 'dominance');
});

test('12b. endings can be reached through played campaigns', () => {
  const play = (choice, opPlan) => {
    const s = startNewCampaign();
    beginCampaign(s);
    for (let r = 0; r < 5; r++) {
      applyEventChoice(s, choice[r]);
      for (const [opId, region] of opPlan[r]) executeOperation(s, opId, region);
      endRound(s);
      advanceRound(s);
    }
    return s.final;
  };
  const spread = ['europe', 'afroasia', 'latam'];
  const honest = play(['a', 'a', 'a', 'a', 'a'], Array.from({ length: 5 }, (_, r) => [['jazz', spread[r % 3]], ['jazz', spread[(r + 1) % 3]]]));
  assert.equal(honest.ending, 'credible');

  const loud = play(['b', 'b', 'b', 'b', 'b'], Array.from({ length: 5 }, (_, r) => [['broadcast', spread[r % 3]], ['broadcast', spread[(r + 1) % 3]]]));
  assert.equal(loud.ending, 'dominance');

  const timid = play(['c', 'c', 'c', 'c', 'c'], Array.from({ length: 5 }, () => [['festival', 'europe']]));
  assert.ok(['failed', 'divided'].includes(timid.ending));
});

test('13. save and continue restore the same state', () => {
  const store = memoryStore();
  const s = inCommand();
  executeOperation(s, 'academic', 'latam');
  assert.equal(saveGame(s, store), true);
  assert.equal(hasSave(store), true);
  const loaded = loadGame(store);
  assert.deepEqual(loaded, s);
  assert.equal(executeOperation(loaded, 'broadcast', 'europe').ok, true);
});

test('13b. a saved final report can be restored', () => {
  const store = memoryStore();
  const s = startNewCampaign();
  beginCampaign(s);
  for (let r = 0; r < 5; r++) playRound(s, 'a', [['jazz', 'europe']]);
  saveGame(s, store);
  const loaded = loadGame(store);
  assert.equal(loaded.phase, 'final');
  assert.deepEqual(loaded.final, computeFinal(loaded));
});

test('13c. corrupted or outdated saves are discarded without throwing', () => {
  const store = memoryStore();
  store.setItem(SAVE_KEY, '{not json');
  assert.equal(loadGame(store), null);
  assert.equal(store.getItem(SAVE_KEY), null);

  store.setItem(SAVE_KEY, JSON.stringify({ state: { version: 0 } }));
  assert.equal(loadGame(store), null);

  const s = inCommand();
  const tampered = JSON.parse(JSON.stringify(s));
  tampered.stats.reach = 500;
  store.setItem(SAVE_KEY, JSON.stringify({ state: tampered }));
  assert.equal(loadGame(store), null);

  const inconsistent = JSON.parse(JSON.stringify(s));
  inconsistent.budget = 6;
  inconsistent.opsRemaining = 2;
  executeOperation(s, 'jazz', 'europe');
  inconsistent.opsHistory = JSON.parse(JSON.stringify(s.opsHistory));
  assert.equal(validateState(inconsistent), null);

  assert.equal(validateState(null), null);
  assert.equal(validateState('text'), null);
  assert.equal(validateState({}), null);
  const throwingStore = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(loadGame(throwingStore), null);
  assert.equal(saveGame(s, throwingStore), false);
});

test('14. resetting a campaign clears the save and starts fresh', () => {
  const store = memoryStore();
  const s = inCommand();
  saveGame(s, store);
  clearSave(store);
  assert.equal(hasSave(store), false);
  const fresh = startNewCampaign();
  assert.deepEqual(fresh.stats, INITIAL_STATS);
  assert.equal(fresh.opsHistory.length, 0);
  assert.equal(fresh.eventHistory.length, 0);
});

test('15. a reloaded save keeps the campaign in progress', () => {
  const store = memoryStore();
  const s = inRoundOne();
  saveGame(s, store);
  const reloaded = loadGame(store);
  assert.equal(reloaded.phase, 'event');
  assert.equal(reloaded.round, 1);
  applyEventChoice(reloaded, 'b');
  saveGame(reloaded, store);
  const again = loadGame(store);
  assert.equal(again.phase, 'command');
  assert.equal(again.eventChoice, 'b');
  assert.equal(again.stats.credibility, 52);
  endRound(again);
  assert.equal(again.phase, 'command');
});

test('15b. summaries record before and after values and operations', () => {
  const s = inCommand();
  executeOperation(s, 'hollywood', 'europe');
  const { summary } = endRound(s);
  assert.equal(summary.before.reach, 15);
  assert.equal(summary.after.reach, 15 + 2 + 10);
  assert.equal(summary.spent, 3);
  assert.equal(summary.operations[0].name, 'Hollywood Showcase');
  assert.equal(summary.operations[0].region, 'europe');
});
