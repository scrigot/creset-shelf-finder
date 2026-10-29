import test from 'node:test';
import assert from 'node:assert/strict';
import { breakdown, fitReasons } from './scoring.js';

const gym = { type: 'strength', members: 260, pct_18_34: 72, pct_women: 35,
  athlete_focus: 'high', distance_miles: 1.8, has_drink_fridge: false,
  sells_supplements: true, warm_intro: '' };
const weights = { fit: 30, size: 25, demo: 20, location: 15, ease: 10 };

test('fit evidence explains operational strengths and missing requirements without changing score', () => {
  const reasons = fitReasons(gym, weights);
  assert.equal(reasons.length, 5);
  assert.equal(reasons.reduce((sum, part) => sum + part.points, 0), breakdown(gym, weights).score);
  const ease = reasons.find(part => part.key === 'ease');
  assert.equal(ease.raw, 25);
  assert.match(ease.evidence, /No drink fridge recorded/);
  assert.match(ease.evidence, /sells supplements/);
  assert.match(ease.evidence, /no warm introduction recorded/);
  assert.match(reasons.find(part => part.key === 'demo').evidence, /72% ages 18–34, 35% women, high athlete focus/);
});

test('zero-weight factors keep their evidence but contribute no points', () => {
  const reasons = fitReasons({ ...gym, warm_intro: 'Coach introduction', has_drink_fridge: true }, { ...weights, ease: 0 });
  const ease = reasons.find(part => part.key === 'ease');
  assert.equal(ease.raw, 100);
  assert.equal(ease.points, 0);
  assert.match(ease.evidence, /Coach introduction/);
});

test('zero weights and distant gyms produce finite zero contributions', () => {
  const reasons = fitReasons({ ...gym, distance_miles: 30 }, { fit: 0, size: 0, demo: 0, location: 0, ease: 0 });
  assert.ok(reasons.every(part => part.points === 0 && Number.isFinite(part.raw)));
  assert.equal(reasons.find(part => part.key === 'location').raw, 0);
});
