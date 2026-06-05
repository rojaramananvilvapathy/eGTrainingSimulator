/**
 * flagService.test.js — Unit tests for the flag service
 */
process.env.FLAG_SECRET  = 'test_flag_secret_minimum_32_chars_';
process.env.FLAG_PREFIX  = 'eGSIM';

const { generateFlag } = require('../services/flagService');

describe('generateFlag()', () => {
  const uid = '11111111-1111-1111-1111-111111111111';
  const rid = '22222222-2222-2222-2222-222222222222';
  const tid = '33333333-3333-3333-3333-333333333333';
  const sid = '44444444-4444-4444-4444-444444444444';

  it('returns a string starting with eGSIM{', () => {
    const flag = generateFlag(uid, rid, tid, sid);
    expect(flag).toMatch(/^eGSIM\{[a-f0-9]{64}\}$/);
  });

  it('is deterministic — same inputs produce same flag', () => {
    const a = generateFlag(uid, rid, tid, sid);
    const b = generateFlag(uid, rid, tid, sid);
    expect(a).toBe(b);
  });

  it('is unique per session — different sessionId produces different flag', () => {
    const a = generateFlag(uid, rid, tid, 'session-aaa');
    const b = generateFlag(uid, rid, tid, 'session-bbb');
    expect(a).not.toBe(b);
  });

  it('is unique per user', () => {
    const a = generateFlag('user-aaa', rid, tid, sid);
    const b = generateFlag('user-bbb', rid, tid, sid);
    expect(a).not.toBe(b);
  });

  it('is unique per task', () => {
    const a = generateFlag(uid, rid, 'task-aaa', sid);
    const b = generateFlag(uid, rid, 'task-bbb', sid);
    expect(a).not.toBe(b);
  });

  it('has correct length (prefix + 64 hex chars + braces)', () => {
    const flag = generateFlag(uid, rid, tid, sid);
    expect(flag.length).toBe('eGSIM{'.length + 64 + '}'.length);
  });
});
