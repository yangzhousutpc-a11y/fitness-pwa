import assert from 'node:assert/strict';
import test from 'node:test';
import { parseApiTokens, requireApiToken } from './auth.js';

function runMiddleware(middleware, authorization) {
  let statusCode = 200;
  let body = null;
  let nextCalled = false;
  const req = { get: (name) => (name.toLowerCase() === 'authorization' ? authorization : undefined) };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };
  middleware(req, res, () => {
    nextCalled = true;
  });
  return { statusCode, body, nextCalled };
}

test('parseApiTokens splits a comma-separated whitelist and trims blanks', () => {
  assert.deepEqual(parseApiTokens('a, b ,,c'), ['a', 'b', 'c']);
  assert.deepEqual(parseApiTokens(''), []);
  assert.deepEqual(parseApiTokens(undefined), []);
});

test('returns 500 when no token is configured', () => {
  const result = runMiddleware(requireApiToken(''), 'Bearer anything');
  assert.equal(result.statusCode, 500);
  assert.equal(result.nextCalled, false);
});

test('rejects requests without a bearer token', () => {
  const result = runMiddleware(requireApiToken('secret'), undefined);
  assert.equal(result.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test('rejects a wrong token', () => {
  const result = runMiddleware(requireApiToken('secret'), 'Bearer nope');
  assert.equal(result.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test('accepts the configured token', () => {
  const result = runMiddleware(requireApiToken('secret'), 'Bearer secret');
  assert.equal(result.nextCalled, true);
});

test('accepts any token in a multi-token whitelist', () => {
  const middleware = requireApiToken('phone-a, phone-b');
  assert.equal(runMiddleware(middleware, 'Bearer phone-a').nextCalled, true);
  assert.equal(runMiddleware(middleware, 'Bearer phone-b').nextCalled, true);
  assert.equal(runMiddleware(middleware, 'Bearer phone-c').nextCalled, false);
});

test('does not crash on a token of a different length (timing-safe path)', () => {
  const result = runMiddleware(requireApiToken('secret'), 'Bearer a');
  assert.equal(result.statusCode, 401);
});
