import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyMeta, fingerprint, mergeStates, stampChanges } from './stamps.js';

const base = () => ({
  items: [{ id: 'a', name: 'Auto', type: 'auto' }],
  logs: [{ id: 'l1', itemId: 'a', date: '2026-01-01', name: 'APK' }],
  plans: [],
  settings: { lang: 'nl', currency: 'EUR', notifyDays: 14, notifyKm: 1000, browserNotifications: false },
  meta: emptyMeta(),
});

test('stempelt nieuwe, gewijzigde en verwijderde records', () => {
  const s0 = base();
  const s1 = stampChanges(s0, { ...s0, logs: [...s0.logs, { id: 'l2', itemId: 'a', date: '2026-02-01', name: 'Banden' }] }, 100);
  assert.equal(s1.meta.rec['l:l2'], 100);
  const s2 = stampChanges(s1, { ...s1, logs: s1.logs.filter((l) => l.id !== 'l1') }, 200);
  assert.equal(s2.meta.del['l:l1'], 200);
  const s3 = stampChanges(s2, { ...s2, settings: { ...s2.settings, browserNotifications: true } }, 300);
  assert.equal(s3.meta.set, 0, 'meldingen per apparaat tellen niet mee');
  const s4 = stampChanges(s3, { ...s3, settings: { ...s3.settings, notifyDays: 30 } }, 400);
  assert.equal(s4.meta.set, 400);
});

test('voegt wijzigingen van twee apparaten samen en laat verwijderingen doorkomen', () => {
  const s0 = base();
  const phone = stampChanges(s0, { ...s0, logs: [...s0.logs, { id: 'l2', itemId: 'a', date: '2026-02-01', name: 'Banden' }] }, 100);
  const pc = stampChanges(s0, { ...s0, logs: [], plans: [{ id: 'p1', itemId: 'a', name: 'Beurt' }] }, 150);
  const { state, conflicts } = mergeStates(phone, pc, s0.meta);
  assert.deepEqual(state.logs.map((l) => l.id), ['l2']);
  assert.deepEqual(state.plans.map((p) => p.id), ['p1']);
  assert.equal(conflicts.length, 0);
  // Opnieuw samenvoegen verandert niets meer.
  assert.equal(fingerprint(mergeStates(state, state, state.meta).state), fingerprint(state));
});

test('bij een echt conflict wint de nieuwste versie, en verwijderd item neemt logboek mee', () => {
  const s0 = base();
  const a = stampChanges(s0, { ...s0, items: [{ ...s0.items[0], name: 'Golf' }] }, 100);
  const b = stampChanges(s0, { ...s0, items: [{ ...s0.items[0], name: 'Polo' }] }, 200);
  const r = mergeStates(a, b, s0.meta);
  assert.equal(r.state.items[0].name, 'Polo');
  assert.equal(r.conflicts.length, 1);
  assert.equal(r.conflicts[0].chosen, 'remote');

  const del = stampChanges(s0, { ...s0, items: [], logs: [] }, 300);
  const edit = stampChanges(s0, { ...s0, logs: [{ ...s0.logs[0], name: 'APK 2026' }] }, 250);
  const m = mergeStates(edit, del, s0.meta);
  assert.equal(m.state.items.length, 0);
  assert.equal(m.state.logs.length, 0);
});
