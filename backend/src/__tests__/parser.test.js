/**
 * parser.test.js — Unit tests for scenario-engine YAML parser
 */
const { validateRoom, parseRoom, loadRoom } = require('../../../scenario-engine/engine/parser');

const VALID_YAML = `
id: test-room-001
title: "Test Room"
description: A test lab room
os: linux
difficulty: easy
category: prerequisites
phase: 3
estimated_minutes: 20
tasks:
  - sequence: 1
    title: "Check OS version"
    type: terminal
    points: 10
    description: Run the OS check command
    hints:
      - tier: 1
        cost: 10
        text: "Try cat /etc/os-release"
    answer_explanation: "cat /etc/os-release shows the OS"
`;

describe('parseRoom()', () => {
  it('parses valid YAML into an object', () => {
    const room = parseRoom(VALID_YAML);
    expect(room.id).toBe('test-room-001');
    expect(room.tasks).toHaveLength(1);
  });

  it('throws on invalid YAML', () => {
    expect(() => parseRoom(':::')).toThrow();
  });
});

describe('validateRoom()', () => {
  it('returns no errors for a valid room', () => {
    const room   = parseRoom(VALID_YAML);
    const errors = validateRoom(room);
    expect(errors).toHaveLength(0);
  });

  it('reports missing required fields', () => {
    const errors = validateRoom({ tasks: [{ sequence: 1, title: 'x', type: 'terminal', points: 10 }] });
    expect(errors.some(e => e.includes('id'))).toBe(true);
    expect(errors.some(e => e.includes('os'))).toBe(true);
  });

  it('reports invalid OS value', () => {
    const room   = parseRoom(VALID_YAML);
    room.os      = 'macos';
    const errors = validateRoom(room);
    expect(errors.some(e => e.includes('os'))).toBe(true);
  });

  it('reports invalid difficulty', () => {
    const room      = parseRoom(VALID_YAML);
    room.difficulty = 'impossible';
    const errors    = validateRoom(room);
    expect(errors.some(e => e.includes('difficulty'))).toBe(true);
  });

  it('reports empty task list', () => {
    const room   = parseRoom(VALID_YAML);
    room.tasks   = [];
    const errors = validateRoom(room);
    expect(errors.some(e => e.includes('task'))).toBe(true);
  });

  it('reports more than 3 hints on a task', () => {
    const room = parseRoom(VALID_YAML);
    room.tasks[0].hints = [
      { tier: 1, cost: 10, text: 'h1' },
      { tier: 2, cost: 20, text: 'h2' },
      { tier: 3, cost: 30, text: 'h3' },
      { tier: 4, cost: 40, text: 'h4' },
    ];
    const errors = validateRoom(room);
    expect(errors.some(e => e.includes('3 hints'))).toBe(true);
  });
});

describe('loadRoom()', () => {
  it('computes total points correctly', () => {
    const room = loadRoom(VALID_YAML);
    expect(room.points_total).toBe(10);
  });

  it('throws combined validation error for invalid YAML', () => {
    const badYaml = VALID_YAML.replace('os: linux', 'os: macos');
    expect(() => loadRoom(badYaml)).toThrow('validation failed');
  });
});
