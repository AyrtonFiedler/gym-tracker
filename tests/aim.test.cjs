const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const legacy = fs.readFileSync(path.join(root, 'legacy.html'), 'utf8');
const parts = Array.from({ length: 6 }, (_, i) => fs.readFileSync(path.join(root, `layout-v17-js-${i}.txt`), 'utf8'));
// Exercise the shipped recommendation engine and its UI adapter, with no browser dependencies.
function sourceFunction(source, name, indent) {
  const start = source.indexOf(`${indent}function ${name}(`);
  assert.notEqual(start, -1, `Missing function ${name}`);
  const end = source.indexOf(`\n${indent}}`, start) + indent.length + 2;
  return source.slice(start, end);
}
const engine = ['completedSets', 'roundToStep', 'formatWeight', 'resetTargets', 'median',
  'straightSessionPattern', 'sameWorkingWeight', 'nextBalancedTarget', 'mixedLoadTarget',
  'recommendationConfidence', 'recommendNext'].map(name => sourceFunction(legacy, name, '    ')).join('\n');
function aim(history, config = {}, unit = 'kg') {
  const context = vm.createContext({ data: { unit }, historyFor: () => history,
    exerciseConfig: () => ({ min: 6, max: 10, increment: 5, loadType: 'weight', ...config }) });
  vm.runInContext(engine + '\n' + sourceFunction(parts[0], 'aimParts', '  '), context);
  return JSON.parse(JSON.stringify(context.aimParts({ id: 'day' }, { id: 'exercise' })));
}
const session = sets => ({ date: '2026-09-14', sets: sets.map(([weight, reps, dropset = false]) => ({ weight, reps, dropset })) });

test('all UI script parts compile together', () => {
  assert.doesNotThrow(() => new vm.Script(parts.join('\n')));
});
test('mixed-load targets retain each set weight and its recommended reps', () => {
  const result = aim([session([[100, 8], [90, 7], [80, 6]])]);
  assert.deepEqual(result.sets.map(s => [s.weight, s.reps]), [[100, 8], [90, 7], [80, 7]]);
  assert.equal(result.sets[1].label, '90 kg × 7');
});
test('drop sets do not shift the weights of recommended working sets', () => {
  const result = aim([session([[100, 8], [40, 12, true], [90, 7], [80, 6]])]);
  assert.deepEqual(result.sets.map(s => s.weight), [100, 90, 80]);
});
test('mixed assistance has a distinct load for every target', () => {
  const result = aim([session([[20, 8], [25, 7], [30, 6]])], { loadType: 'assistance' });
  assert.deepEqual(result.sets.map(s => s.label), ['20 kg assist × 8', '25 kg assist × 7', '30 kg assist × 7']);
});
test('uniform load progression applies the new weight to every set', () => {
  const result = aim([session([[50, 10], [50, 10], [50, 10]])]);
  assert.deepEqual(result.sets.map(s => [s.weight, s.reps]), [[55, 8], [55, 7], [55, 6]]);
});
test('assistance progression can reach zero without showing a missing weight', () => {
  const result = aim([session([[5, 10], [5, 10]])], { loadType: 'assistance' });
  assert.deepEqual(result.sets.map(s => s.label), ['0 kg assist × 8', '0 kg assist × 7']);
});
test('zero external load and decimal loads remain exact', () => {
  assert.equal(aim([session([[0, 8]])], { increment: 0 }).sets[0].label, '0 kg × 9');
  assert.equal(aim([session([[122.5, 8], [117.5, 7]])], {}, 'lb').sets[1].label, '117.5 lb × 8');
});
test('no history produces no suggested targets', () => {
  assert.deepEqual(aim([]), { rec: null, sets: [] });
});
