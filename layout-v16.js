(() => {
  'use strict';

  // V16 is a presentation upgrade only. It keeps the original storage key/history structure intact.
  if (!data.warmups || typeof data.warmups !== 'object') data.warmups = {};
  data.days.forEach(day => (day.exercises || []).forEach(ex => {
    if (!Number.isInteger(ex.defaultSets) || ex.defaultSets < 1) ex.defaultSets = 1;
  }));
  saveData();

  function dayWarmups(dayId) {
    if (!data.warmups[dayId]) data.warmups[dayId] = {};
    return data.warmups[dayId];
  }

  function exerciseWarmup(dayId, exerciseId) {
    const warmups = dayWarmups(dayId);
    if (!warmups[exerciseId]) warmups[exerciseId] = {weight:'', reps:''};
    return warmups[exerciseId];
  }

  function compactSetText(set, warm = false) {
    if (!set) return '';
    const w = Number(set.weight), r = Number(set.reps);
    if (!Number.isFinite(w) || !Number.isFinite(r) || r <= 0) return '';
    return `${formatWeight(w)}/${r}${warm ? 'W' : ''}${set.failure ? 'F' : ''}${set.dropset ? 'DS' : ''}`;
  }

  function makePair(state, cfg, setIndex = 0, warm = false) {
    const wrap = document.createElement('div');
    wrap.className = 'nb-pair';
    const row = document.createElement('div');
    row.className = 'nb-pair-row';

    const w = document.createElement('input');
    w.className = 'nb-input';
    w.inputMode = 'decimal';
    w.placeholder = cfg.loadType === 'assistance' && !warm ? 'A' : 'kg';
    w.value = state.weight ?? '';
    w.setAttribute('aria-label', warm ? 'Warm-up weight' : `${cfg.loadType === 'assistance' ? 'Assistance' : 'Weight'} for set ${setIndex}`);

    const slash = document.createElement('span');
    slash.className = 'nb-slash';
    slash.textContent = '/';

    const r = document.createElement('input');
    r.className = 'nb-input';
    r.inputMode = 'numeric';
    r.placeholder = 'rep';
    r.value = state.reps ?? '';
    r.setAttribute('aria-label', warm ? 'Warm-up reps' : `Reps for set ${setIndex}`);

    w.addEventListener('input', () => { state.weight = w.value; saveData(); });
    r.addEventListener('input', () => { state.reps = r.value; saveData(); });
    row.append(w, slash, r);
    wrap.appendChild(row);
    return wrap;
  }

  function warmCell(day, ex, cfg, prev) {
    const td = document.createElement('td');
    td.className = 'nb-warm-cell';
    const warm = exerciseWarmup(day.id, ex.id);
    td.appendChild(makePair(warm, cfg, 0, true));
    const label = document.createElement('div');
    label.className = 'nb-warm-label';
    label.textContent = 'W';
    td.appendChild(label);
    const last = document.createElement('div');
    last.className = 'nb-last';
    const txt = compactSetText(prev?.warmup, true);
    last.innerHTML = txt ? `L <strong>${txt}</strong>` : '&nbsp;';
    td.appendChild(last);
    return td;
  }

  function setCell(day, ex, cfg, set, index, prevSet) {
    const td = document.createElement('td');
    td.className = 'nb-set-cell';
    td.appendChild(makePair(set, cfg, index + 1, false));

    const flags = document.createElement('div');
    flags.className = 'nb-flags';
    const f = document.createElement('button');
    f.className = `nb-flag ${set.failure ? 'active' : ''}`;
    f.textContent = 'F';
    f.title = 'Failure';
    const ds = document.createElement('button');
    ds.className = `nb-flag ds ${set.dropset ? 'active' : ''}`;
    ds.textContent = 'DS';
    ds.title = 'Drop set';
    f.addEventListener('click', () => { set.failure = !set.failure; f.classList.toggle('active', set.failure); saveData(); });
    ds.addEventListener('click', () => { set.dropset = !set.dropset; ds.classList.toggle('active', set.dropset); saveData(); });
    flags.append(f, ds);
    td.appendChild(flags);

    const last = document.createElement('div');
    last.className = 'nb-last';
    const txt = compactSetText(prevSet, false);
    last.innerHTML = txt ? `L <strong>${txt}</strong>` : '&nbsp;';
    td.appendChild(last);
    return td;
  }

  function aimParts(rec, cfg) {
    if (!rec) return {weight:'—', reps:'', tag:''};
    const reps = Array.isArray(rec.reps) ? rec.reps.join('  ') : '';
    if (Number.isFinite(rec.weight)) {
      return {
        weight: `${formatWeight(rec.weight)}${cfg.loadType === 'assistance' ? ' kg A' : ' kg'}`,
        reps,
        tag: rec.kind === 'increase' ? 'progress' : rec.kind === 'reduce' ? 'rebuild' : 'target'
      };
    }
    const main = String(rec.main || '').replace(/\s+/g,' ').trim();
    return {weight: main || '—', reps:'', tag: rec.kind === 'reduce' ? 'rebuild' : 'target'};
  }

  function workoutRow(day, ex, maxSets) {
    const cfg = exerciseConfig(ex);
    const sets = exerciseSets(day.id, ex.id);
    const prev = lastSession(day.id, ex.id);
    const rec = recommendNext(day, ex);
    const tr = document.createElement('tr');

    const exCell = document.createElement('td');
    exCell.className = 'nb-ex-cell';
    const name = document.createElement('div');
    name.className = 'nb-ex-name';
    name.textContent = ex.name;
    const actions = document.createElement('div');
    actions.className = 'nb-ex-actions';
    const info = document.createElement('button');
    info.className = 'nb-mini-action'; info.textContent = 'i'; info.title = 'Exercise info';
    const chart = document.createElement('button');
    chart.className = 'nb-mini-action'; chart.textContent = '↗'; chart.title = 'Strength chart';
    const minus = document.createElement('button');
    minus.className = 'nb-mini-action'; minus.textContent = '−'; minus.title = 'Remove last set'; minus.disabled = sets.length <= 1;
    const plus = document.createElement('button');
    plus.className = 'nb-mini-action'; plus.textContent = '+'; plus.title = 'Add set';
    info.addEventListener('click', () => openExerciseDetail(ex));
    chart.addEventListener('click', () => openStrengthChart(day, ex));
    plus.addEventListener('click', () => {
      sets.push({weight:'', reps:'', failure:false, dropset:false});
      ex.defaultSets = Math.max(ex.defaultSets || 1, sets.length);
      saveData(); renderWorkout(day.id);
    });
    minus.addEventListener('click', () => {
      if (sets.length <= 1) return;
      const last = sets[sets.length - 1];
      const entered = String(last.weight ?? '').trim() || String(last.reps ?? '').trim() || last.failure || last.dropset;
      if (entered && !confirm('Remove the last set and its entered data?')) return;
      sets.pop(); ex.defaultSets = sets.length; saveData(); renderWorkout(day.id);
    });
    actions.append(info, chart, minus, plus);
    exCell.append(name, actions);
    tr.appendChild(exCell);

    tr.appendChild(warmCell(day, ex, cfg, prev));
    for (let i = 0; i < maxSets; i++) {
      if (i < sets.length) tr.appendChild(setCell(day, ex, cfg, sets[i], i, prev?.sets?.[i]));
      else {
        const blank = document.createElement('td');
        blank.className = 'nb-set-cell';
        blank.innerHTML = '<span style="color:#aaa;font-size:9px">—</span>';
        tr.appendChild(blank);
      }
    }

    const aim = document.createElement('td');
    aim.className = 'nb-aim-cell';
    const btn = document.createElement('button');
    btn.className = 'nb-aim-button';
    const parts = aimParts(rec, cfg);
    btn.innerHTML = `<span class="nb-aim-weight"></span><span class="nb-aim-reps"></span><span class="nb-aim-tag"></span>`;
    btn.querySelector('.nb-aim-weight').textContent = parts.weight;
    btn.querySelector('.nb-aim-reps').textContent = parts.reps;
    btn.querySelector('.nb-aim-tag').textContent = parts.tag;
    if (rec) {
      btn.addEventListener('click', () => alert(`${rec.title}\n${rec.main}\n\n${rec.note}`));
      btn.setAttribute('aria-label', `Suggested progressive overload target: ${rec.main}. Tap for explanation.`);
    } else {
      btn.disabled = true;
      btn.setAttribute('aria-label','No target yet. Finish a workout to generate one.');
    }
    aim.appendChild(btn);
    tr.appendChild(aim);

    const range = document.createElement('td');
    range.className = 'nb-range-cell';
    range.textContent = `${cfg.min}-${cfg.max}`;
    tr.appendChild(range);
    return tr;
  }

  const legacyRenderHome = renderHome;
  renderHome = function() {
    document.body.classList.remove('workout-active');
    legacyRenderHome();
  };

  renderWorkout = function(dayId) {
    currentDayId = dayId;
    const day = data.days.find(d => d.id === dayId);
    if (!day) return renderHome();
    document.body.classList.add('workout-active');

    const app = document.getElementById('app');
    if (!day.exercises.length) {
      app.innerHTML = `<div class="workout-topbar"><button class="back-btn" id="backBtn" aria-label="Back">‹</button><h1></h1><button class="workout-menu-btn" id="workoutMenu">⋮</button></div><div class="empty">No exercises yet. Use the menu to add some.</div>`;
      app.querySelector('h1').textContent = day.name;
      document.getElementById('backBtn').addEventListener('click', renderHome);
      document.getElementById('workoutMenu').addEventListener('click', openSettings);
      return;
    }

    const maxSets = Math.max(1, ...day.exercises.map(ex => exerciseSets(day.id, ex.id).length));
    const today = new Date().toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
    const quote = typeof nextQuote === 'function' ? nextQuote() : 'Progress over perfection.';
    app.innerHTML = `
      <section class="workout-notebook">
        <div class="workout-topbar"><button class="back-btn" id="backBtn" aria-label="Back">‹</button><h1 id="workoutTitle"></h1><button class="workout-menu-btn" id="workoutMenu" aria-label="Edit workout">⋮</button></div>
        <div class="workout-date" id="workoutDate"></div>
        <div class="workout-mini-quote" id="workoutQuote"></div>
        <div class="notebook-sheet-wrap">
          <table class="notebook-sheet">
            <thead><tr>
              <th class="nb-ex-col">Exercise</th>
              <th class="nb-warm-col">W</th>
              ${Array.from({length:maxSets},(_,i)=>`<th class="nb-set-col">${i+1}</th>`).join('')}
              <th class="nb-aim-col">AIM</th>
              <th class="nb-range-col">R-Aim</th>
            </tr></thead>
            <tbody id="nbWorkoutBody"></tbody>
          </table>
        </div>
        <button class="nb-add-exercise" id="nbAddExercise">＋ Add Exercise</button>
        <div class="nb-footer-quote"><span class="nb-flex-mark">💪</span><span>Progress over perfection.</span></div>
        <button class="nb-finish" id="finishWorkout">Finish Workout</button>
      </section>`;

    document.getElementById('workoutTitle').textContent = day.name;
    document.getElementById('workoutDate').textContent = today;
    document.getElementById('workoutQuote').textContent = `“${quote}”`;
    document.getElementById('backBtn').addEventListener('click', renderHome);
    document.getElementById('workoutMenu').addEventListener('click', openSettings);
    document.getElementById('nbAddExercise').addEventListener('click', openSettings);
    const body = document.getElementById('nbWorkoutBody');
    day.exercises.forEach(ex => body.appendChild(workoutRow(day, ex, maxSets)));
    document.getElementById('finishWorkout').addEventListener('click', () => finishWorkout(day.id));
  };

  finishWorkout = function(dayId) {
    const day = data.days.find(d => d.id === dayId);
    if (!day) return;
    const log = dayLog(dayId);
    const hasAnything = day.exercises.some(ex => completedSets(log[ex.id] || []).length > 0);
    if (!hasAnything) { alert('Enter at least one completed working set before finishing the workout.'); return; }
    if (!data.history[dayId]) data.history[dayId] = {};
    const timestamp = new Date().toISOString();

    day.exercises.forEach(ex => {
      const sets = log[ex.id] || [];
      const completed = completedSets(sets);
      const warm = exerciseWarmup(dayId, ex.id);
      if (completed.length) {
        if (!data.history[dayId][ex.id]) data.history[dayId][ex.id] = [];
        const ww = Number(warm.weight), wr = Number(warm.reps);
        const warmup = Number.isFinite(ww) && ww >= 0 && Number.isFinite(wr) && wr > 0 ? {weight:ww,reps:wr} : null;
        data.history[dayId][ex.id].push({
          date:timestamp,
          warmup,
          sets:completed.map(s => ({weight:s.weight,reps:s.reps,failure:s.failure,dropset:s.dropset}))
        });
        if (data.history[dayId][ex.id].length > 30) data.history[dayId][ex.id].shift();
      }
      const resetCount = Math.max(1, Number.isInteger(ex.defaultSets) ? ex.defaultSets : (completed.length || sets.length || 1));
      log[ex.id] = Array.from({length:resetCount},()=>({weight:'',reps:'',failure:false,dropset:false}));
      dayWarmups(dayId)[ex.id] = {weight:'',reps:''};
    });
    saveData(); renderWorkout(dayId); window.scrollTo({top:0,behavior:'smooth'});
  };

  // Keep customisation, but only add a set-count field. RIR is intentionally removed from the UI.
  const legacyRenderSettings = renderSettings;
  renderSettings = function() {
    legacyRenderSettings();
    const cards = Array.from(document.querySelectorAll('#settingsContent .settings-card'));
    cards.forEach((card, dayIndex) => {
      const day = data.days[dayIndex];
      if (!day) return;
      const wrap = card.querySelector('.exercise-settings');
      if (!wrap) return;
      const blocks = Array.from(wrap.children).filter(el => !el.classList.contains('picker-actions'));
      blocks.forEach((block, exIndex) => {
        const ex = day.exercises[exIndex];
        if (!ex || block.querySelector('.nb-settings-extra')) return;
        const extra = document.createElement('div');
        extra.className = 'nb-settings-extra';
        const label = document.createElement('label');
        label.className = 'nb-setting-field';
        label.innerHTML = '<span>Working sets</span>';
        const input = document.createElement('input');
        input.inputMode = 'numeric';
        input.value = ex.defaultSets || exerciseSets(day.id, ex.id).length || 1;
        input.addEventListener('change', () => {
          const value = Math.max(1, Math.min(12, Math.round(Number(input.value) || 1)));
          ex.defaultSets = value;
          const current = exerciseSets(day.id, ex.id);
          while (current.length < value) current.push({weight:'',reps:'',failure:false,dropset:false});
          while (current.length > value) {
            const last = current[current.length-1];
            if (String(last.weight ?? '').trim() || String(last.reps ?? '').trim() || last.failure || last.dropset) break;
            current.pop();
          }
          saveData(); input.value = ex.defaultSets;
        });
        label.appendChild(input);
        extra.appendChild(label);
        block.appendChild(extra);
      });
    });
  };

  saveData = function() {
    if (data.warmups && typeof data.warmups === 'object') {
      const validDays = new Set(data.days.map(d=>d.id));
      Object.keys(data.warmups).forEach(dayId => {
        if (!validDays.has(dayId)) { delete data.warmups[dayId]; return; }
        const day = data.days.find(d=>d.id===dayId);
        const validEx = new Set((day?.exercises||[]).map(ex=>ex.id));
        Object.keys(data.warmups[dayId]||{}).forEach(exId=>{ if(!validEx.has(exId)) delete data.warmups[dayId][exId]; });
      });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  if (currentDayId) renderWorkout(currentDayId); else renderHome();
})();
