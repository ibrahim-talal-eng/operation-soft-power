import {
  startNewCampaign,
  beginCampaign,
  applyEventChoice,
  executeOperation,
  canEndRound,
  endRound,
  advanceRound,
  roundOperations,
  effectLines,
  getOperation,
  regionName,
  roundInfo
} from './gameEngine.js';
import { getEvent, getChoice } from './events.js';
import { OPERATIONS, REGIONS, MAX_ROUNDS, MAX_OPERATIONS, LOW_CREDIBILITY_THRESHOLD, ENDINGS, DEBRIEF } from './gameData.js';
import { saveGame, loadGame, clearSave } from './storage.js';

export function createUI(app) {
  let state = null;
  let view = { choice: null, op: null, region: null, confirm: null, msg: '' };

  const current = () => ({ reach: state.stats.reach, credibility: state.stats.credibility, regions: state.regions });

  const bar = (label, value, kind) =>
    `<div class="row"><span>${label}</span><div class="bar ${kind}"><i style="width:${value}%"></i></div><b>${value}</b></div>`;

  const statBlock = (s) =>
    `<div class="stats">${bar('Reach', s.reach, 'reach')}${bar('Credibility', s.credibility, 'cred')}<div class="rule"></div>` +
    REGIONS.map((r) => bar(r.name, s.regions[r.id], 'region')).join('') +
    '</div>';

  const change = (label, a, b) => `<div>${label}: ${a} &rarr; ${b} (${b - a >= 0 ? '+' : ''}${b - a})</div>`;

  const opLine = (op) => {
    const parts = [`Reach +${op.effects.reach}`, `Credibility ${op.effects.credibility >= 0 ? '+' : ''}${op.effects.credibility}`, `Target +${op.effects.region}`];
    if (op.delayed) parts.push(`Target +${op.delayed.region} next round`);
    if (op.lowCredibilityPenalty) parts.push(`Credibility ${op.lowCredibilityPenalty.credibility} if below ${LOW_CREDIBILITY_THRESHOLD}`);
    return parts.join(', ');
  };

  const answer = (f) => {
    const gap = f.reach - f.credibility;
    if (gap >= 20) return 'In your campaign, America was mostly an image: widely seen, less widely believed.';
    if (gap <= -20) return 'In your campaign, America was mostly what it did: trusted, but not widely heard.';
    return 'In your campaign, the image and the conduct stayed close together.';
  };

  const persist = () => saveGame(state);

  const menu = () => `
    <div class="kicker">Washington, D.C. &middot; 1956-1962</div>
    <h1>OPERATION: SOFT POWER</h1>
    <p class="sub">The Battle for Hearts and Minds</p>
    <hr class="double">
    <h2>What is America?</h2>
    <p>In the first decade of the Cold War the United States claimed to stand for freedom and tried to persuade a large part of the world that the claim was true. The Soviet Union made a rival claim, and each government watched the other for contradictions.</p>
    <p>Culture crossed borders easily. Credibility did not. Foreign audiences compared American statements with American conduct, and when the two diverged the message lost its value.</p>
    <p class="bold">Reach is not credibility.</p>
    ${view.confirm === 'start'
      ? `<p class="msg">Starting a new campaign deletes your saved one.</p>
         <button class="primary" data-act="start-yes">Delete save and start</button><button data-act="cancel">Cancel</button>`
      : `<button class="primary" data-act="start">Start Campaign</button>${loadGame() ? '<button data-act="continue">Continue Campaign</button>' : ''}`}
  `;

  const briefing = () => `
    <div class="kicker">Briefing &middot; 1956</div>
    <h2>Washington</h2>
    <p>Three years after the creation of the United States Information Agency, the Eisenhower administration is trying to improve the country's standing among governments and publics that have not yet chosen a side in the Cold War. Decolonization is producing new states in Africa and Asia, and the Soviet Union presents itself to them as an opponent of empire and of racial hierarchy.</p>
    <p>You direct a cultural diplomacy agency. Cultural and educational programs reach people more cheaply, and with less suspicion, than official statements do. Foreign audiences also read newspapers, however, and between 1956 and 1962 a series of events will test whether American conduct supports what your programs say.</p>
    <p>Each round begins with an event. You decide how the agency responds, then spend a budget of 6 on up to ${MAX_OPERATIONS} operations. Unspent budget is lost.</p>
    <p class="bold">Reach measures how many people are exposed to American messaging. Credibility measures how far they believe it.</p>
    ${statBlock(current())}
    <p><button class="primary" data-act="begin">Begin Round 1</button></p>
  `;

  const eventView = () => {
    const e = getEvent(state.round);
    const info = roundInfo(state.round);
    return `
      <div class="top"><span>Round ${state.round} of ${MAX_ROUNDS}</span><span>${info.year}</span></div>
      <h2>${e.title}</h2>
      <div class="event">
        <figure><img src="${e.image}" alt="${e.title}" onerror="this.parentNode.remove()"><figcaption>${e.date}</figcaption></figure>
        <p>${e.background}</p>
      </div>
      <h3>Response</h3>
      ${e.choices
        .map(
          (c) => `<button class="block ${view.choice === c.id ? 'on' : ''}" data-act="choice" data-id="${c.id}">
            ${c.id.toUpperCase()}. ${c.label}<br><span class="small">${effectLines(c.effects).map((l) => l.text).join(', ')}</span></button>`
        )
        .join('')}
      <p><button class="primary" data-act="confirm-choice" ${view.choice ? '' : 'disabled'}>Confirm decision</button></p>
    `;
  };

  const command = () => {
    const e = getEvent(state.round);
    const choice = getChoice(state.round, state.eventChoice);
    const done = roundOperations(state);
    const end = canEndRound(state);
    return `
      <div class="top"><span>Round ${state.round} of ${MAX_ROUNDS} &middot; ${roundInfo(state.round).year}</span>
        <span>Budget ${state.budget} &middot; Operations left ${state.opsRemaining}</span></div>
      <div class="cc">
        <aside>
          ${statBlock(current())}
          <p class="small">${e.title}<br>${choice.label}</p>
          ${done.length ? `<h3>This round</h3>${done.map((o) => `<div class="small">${getOperation(o.opId).name}, ${regionName(o.region)}</div>`).join('')}` : ''}
        </aside>
        <section>
          <h3>Target region</h3>
          ${REGIONS.map((r) => `<button class="${view.region === r.id ? 'on' : ''}" data-act="region" data-id="${r.id}">${r.name}</button>`).join('')}
          <h3>Operation</h3>
          ${OPERATIONS.map(
            (op) => `<button class="block op ${view.op === op.id ? 'on' : ''}" data-act="op" data-id="${op.id}">
              <span><b>${op.name}</b> (cost ${op.cost})<br><span class="small">${opLine(op)}</span></span>
              <span class="desc">${op.description}</span></button>`
          ).join('')}
          <p><button class="primary" data-act="execute">Execute</button></p>
          <p class="msg">${view.msg}</p>
          ${view.confirm === 'end'
            ? `<p class="msg">End the round?</p><button class="primary" data-act="end-yes">Yes, end round</button><button data-act="cancel">No</button>`
            : `<button data-act="end" ${end.ok ? '' : 'disabled'}>End Round</button>${end.ok ? '' : `<span class="small">${end.reason}</span>`}`}
        </section>
      </div>
    `;
  };

  const summary = () => {
    const s = state.summaries[state.summaries.length - 1];
    return `
      <h2>Round ${s.round} Summary (${s.year})</h2>
      <p>${s.eventTitle}: ${s.choiceLabel}</p>
      <p>Spent ${s.spent} of 6</p>
      <p>${s.operations.map((o) => `${o.name} in ${regionName(o.region)}`).join('<br>')}</p>
      ${change('Reach', s.before.reach, s.after.reach)}
      ${change('Credibility', s.before.credibility, s.after.credibility)}
      ${REGIONS.map((r) => change(r.name, s.before.regions[r.id], s.after.regions[r.id])).join('')}
      ${s.delayedScheduled.length ? `<p class="small">Next round: ${s.delayedScheduled.map((d) => `${regionName(d.region)} +${d.influence}`).join(', ')}</p>` : ''}
      <p><button class="primary" data-act="next">${state.round < MAX_ROUNDS ? 'Next Round' : 'Final Report'}</button></p>
    `;
  };

  const final = () => {
    const f = state.final;
    const ending = ENDINGS[f.ending];
    return `
      <h1>${ending.title}</h1>
      <p class="bold">${ending.narrative}</p>
      <p>${DEBRIEF}</p>
      <h2>What is America?</h2>
      <p class="bold">${answer(f)}</p>
      <h2>Score: ${f.score}</h2>
      ${statBlock({ reach: f.reach, credibility: f.credibility, regions: f.regions })}
      <div>Average regional influence: ${f.averageInfluence}</div>
      <h3>Decisions</h3>
      ${state.eventHistory.map((h) => `<div>${getEvent(h.round).title}: ${getChoice(h.round, h.choiceId).label}</div>`).join('')}
      <h3>Operations</h3>
      ${state.opsHistory.map((o) => `<div>Round ${o.round}: ${getOperation(o.opId).name}, ${regionName(o.region)}</div>`).join('')}
      <p><button class="primary" data-act="again">Play Again</button></p>
    `;
  };

  const render = () => {
    let html;
    if (!state) html = menu();
    else if (state.phase === 'briefing') html = briefing();
    else if (state.phase === 'event') html = eventView();
    else if (state.phase === 'command') html = command();
    else if (state.phase === 'summary') html = summary();
    else html = final();
    app.innerHTML = html;
  };

  const actions = {
    start() {
      if (loadGame()) view.confirm = 'start';
      else actions['start-yes']();
    },
    'start-yes'() {
      clearSave();
      state = startNewCampaign();
      persist();
    },
    continue() {
      const saved = loadGame();
      if (saved) state = saved;
    },
    cancel() {
      view.confirm = null;
    },
    begin() {
      beginCampaign(state);
      persist();
    },
    choice(id) {
      view.choice = id;
    },
    'confirm-choice'() {
      if (!view.choice) return;
      applyEventChoice(state, view.choice);
      view = { choice: null, op: null, region: null, confirm: null, msg: '' };
      persist();
    },
    region(id) {
      view.region = id;
    },
    op(id) {
      view.op = id;
    },
    execute() {
      const result = executeOperation(state, view.op, view.region);
      if (!result.ok) {
        view.msg = result.error;
        return;
      }
      view.msg = '';
      view.op = null;
      view.region = null;
      persist();
    },
    end() {
      view.confirm = 'end';
    },
    'end-yes'() {
      endRound(state);
      view = { choice: null, op: null, region: null, confirm: null, msg: '' };
      persist();
    },
    next() {
      advanceRound(state);
      persist();
    },
    again() {
      clearSave();
      state = null;
    }
  };

  app.addEventListener('click', (e) => {
    const target = e.target.closest('[data-act]');
    if (!target || target.disabled) return;
    const before = state ? state.phase : 'menu';
    actions[target.dataset.act]?.(target.dataset.id);
    render();
    if ((state ? state.phase : 'menu') !== before) window.scrollTo(0, 0);
  });

  render();
}
