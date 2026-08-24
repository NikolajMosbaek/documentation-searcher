import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SCENARIO, parseScenario } from './soakScenario.js';

const VALID = {
  question: 'What happens when a customer cancels partway through a month?',
  rephrasing: 'if someone stops paying mid-cycle, what do they keep?',
  followUp: 'and are they refunded?',
  falseClaim: 'that is wrong, they lose access straight away',
  falseClaimMarker: 'straight away',
};

test('a complete scenario is accepted and trimmed', () => {
  const scenario = parseScenario(JSON.stringify({ ...VALID, question: `  ${VALID.question}  ` }));
  assert.deepEqual(scenario, VALID);
});

test('the built-in scenario is itself valid', () => {
  assert.deepEqual(parseScenario(JSON.stringify(DEFAULT_SCENARIO)), DEFAULT_SCENARIO);
});

test('a missing or empty field is refused rather than silently skipped', () => {
  for (const field of Object.keys(VALID)) {
    const without = { ...VALID, [field]: undefined };
    assert.throws(() => parseScenario(JSON.stringify(without)), new RegExp(`missing a non-empty '${field}'`), field);

    const blank = { ...VALID, [field]: '   ' };
    assert.throws(() => parseScenario(JSON.stringify(blank)), new RegExp(`missing a non-empty '${field}'`), field);
  }
});

test('malformed input says so, and says where', () => {
  assert.throws(() => parseScenario('{ not json', 'scenario.json'), /scenario\.json is not valid JSON/);
  assert.throws(() => parseScenario('[]'), /must be a JSON object/);
  assert.throws(() => parseScenario('"a string"'), /must be a JSON object/);
});

test('a marker absent from the claim is refused, because the check would prove nothing', () => {
  const useless = { ...VALID, falseClaimMarker: 'a phrase that is not in the claim' };

  assert.throws(
    () => parseScenario(JSON.stringify(useless)),
    /would pass without testing anything/,
  );
});

test('the marker is matched case-insensitively against the claim', () => {
  const shouty = { ...VALID, falseClaimMarker: 'STRAIGHT AWAY' };
  assert.equal(parseScenario(JSON.stringify(shouty)).falseClaimMarker, 'STRAIGHT AWAY');
});
