import { validateState } from './gameState.js';
import { computeFinal } from './gameEngine.js';

export const SAVE_KEY = 'operation-soft-power.save';

function getStore(store) {
  if (store) return store;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function saveGame(state, store) {
  const target = getStore(store);
  if (!target) return false;
  try {
    target.setItem(SAVE_KEY, JSON.stringify({ savedAt: Date.now(), state }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(store) {
  const target = getStore(store);
  if (!target) return;
  try {
    target.removeItem(SAVE_KEY);
  } catch {
    return;
  }
}

export function loadGame(store) {
  const target = getStore(store);
  if (!target) return null;
  let parsed;
  try {
    const text = target.getItem(SAVE_KEY);
    if (!text) return null;
    parsed = JSON.parse(text);
  } catch {
    clearSave(store);
    return null;
  }
  const state = validateState(parsed?.state);
  if (!state) {
    clearSave(store);
    return null;
  }
  if (state.phase === 'final') state.final = computeFinal(state);
  return state;
}

export function hasSave(store) {
  return loadGame(store) !== null;
}
