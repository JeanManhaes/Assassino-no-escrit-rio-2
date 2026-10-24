import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMatchData } from './npcData.ts';

test('generateMatchData creates valid match with exactly 1 murderer and clues', () => {
  const match = generateMatchData();

  assert.ok(match.employees.length >= 6, 'Should generate at least 6 employees');
  assert.ok(match.murdererId, 'Should have a murdererId');
  assert.ok(match.secretWeapon, 'Should have a secret weapon');
  assert.ok(match.motive, 'Should have an assassination motive');

  const murderers = match.employees.filter(e => e.isMurderer);
  assert.equal(murderers.length, 1, 'Should have exactly 1 murderer');

  const murderer = murderers[0];
  assert.equal(murderer.id, match.murdererId);
  assert.ok(murderer.killerConfessionClue, 'Murderer should have a confession clue');

  // Verify non-murderers
  const innocents = match.employees.filter(e => !e.isMurderer);
  assert.ok(innocents.length >= 5, 'Should have at least 5 innocents');
  for (const innocent of innocents) {
    assert.equal(innocent.isMurderer, false);
  }
});

test('generateMatchData escalates murderers up to 5 in phase 5', () => {
  const matchPhase2 = generateMatchData(2);
  assert.equal(matchPhase2.employees.filter(e => e.isMurderer).length, 2);

  const matchPhase5 = generateMatchData(5);
  assert.equal(matchPhase5.employees.filter(e => e.isMurderer).length, 5);
});
