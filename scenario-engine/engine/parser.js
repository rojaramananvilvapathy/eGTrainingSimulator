const yaml   = require('js-yaml');
const logger = require('../../backend/src/config/logger');

/**
 * Room YAML structure:
 *
 * id: prereqs-linux-eg-manager
 * title: "eG Manager — Linux Prerequisites Check"
 * os: linux
 * difficulty: easy
 * category: prerequisites
 * component_type: eG Manager
 * phase: 3
 * estimated_minutes: 20
 * docker_image: eg-sim-linux-lab:latest
 * tasks:
 *   - sequence: 1
 *     title: "Check OS version"
 *     type: terminal
 *     points: 10
 *     description: |
 *       Run the command to identify the OS version.
 *       eG Manager supports RHEL/CentOS 7/8 and Ubuntu 20.04/22.04.
 *     expected_commands:
 *       - cat /etc/os-release
 *       - lsb_release -a
 *       - uname -a
 *     flag_condition: output_contains
 *     flag_trigger: "Ubuntu|CentOS|Red Hat"
 *     hints:
 *       - tier: 1  cost: 10  text: "Use a command that reads the OS release file"
 *       - tier: 2  cost: 20  text: "Try: cat /etc/os-release"
 *       - tier: 3  cost: 30  text: "The file is /etc/os-release — it shows OS name and version"
 *     answer_explanation: "cat /etc/os-release reveals the OS distribution and version."
 */

const REQUIRED_ROOM_FIELDS  = ['id', 'title', 'os', 'difficulty', 'category', 'phase', 'tasks'];
const REQUIRED_TASK_FIELDS  = ['sequence', 'title', 'type', 'points'];
const VALID_OS              = ['linux', 'windows', 'both'];
const VALID_DIFFICULTY      = ['easy', 'medium', 'hard', 'expert'];
const VALID_TASK_TYPES      = ['terminal', 'gui_wizard', 'mcq', 'flag_submit', 'log_analysis'];

function parseRoom(yamlText) {
  const room = yaml.load(yamlText);
  if (!room || typeof room !== 'object') throw new Error('Invalid YAML — must be a mapping');
  return room;
}

function validateRoom(room) {
  const errors = [];

  for (const f of REQUIRED_ROOM_FIELDS) {
    if (!room[f]) errors.push(`Missing required room field: ${f}`);
  }

  if (room.os && !VALID_OS.includes(room.os)) {
    errors.push(`Invalid os: "${room.os}". Must be one of: ${VALID_OS.join(', ')}`);
  }
  if (room.difficulty && !VALID_DIFFICULTY.includes(room.difficulty)) {
    errors.push(`Invalid difficulty: "${room.difficulty}"`);
  }

  if (!Array.isArray(room.tasks) || room.tasks.length === 0) {
    errors.push('Room must have at least one task');
  } else {
    room.tasks.forEach((task, idx) => {
      const prefix = `Task[${idx + 1}]`;
      for (const f of REQUIRED_TASK_FIELDS) {
        if (task[f] === undefined || task[f] === null) errors.push(`${prefix}: Missing field: ${f}`);
      }
      if (task.type && !VALID_TASK_TYPES.includes(task.type)) {
        errors.push(`${prefix}: Invalid type "${task.type}"`);
      }
      if (task.hints) {
        if (!Array.isArray(task.hints)) {
          errors.push(`${prefix}: hints must be an array`);
        } else if (task.hints.length > 3) {
          errors.push(`${prefix}: Maximum 3 hints allowed`);
        }
      }
    });
  }

  return errors;
}

/**
 * Parse and validate a room YAML string.
 * Returns { room } on success, throws with validation errors on failure.
 */
function loadRoom(yamlText) {
  const room = parseRoom(yamlText);
  const errors = validateRoom(room);
  if (errors.length > 0) {
    throw new Error(`Room validation failed:\n  - ${errors.join('\n  - ')}`);
  }
  // Compute total points
  room.points_total = room.tasks.reduce((sum, t) => sum + (t.points || 0), 0);
  logger.debug('Room loaded', { id: room.id, tasks: room.tasks.length, points: room.points_total });
  return room;
}

/**
 * Convert a validated room object to DB-ready rows.
 */
function roomToDbRows(room, authorId) {
  const roomRow = {
    slug:            room.id,
    title:           room.title,
    description:     room.description || '',
    os:              room.os,
    difficulty:      room.difficulty,
    phase:           room.phase,
    category:        room.category,
    component_type:  room.component_type || null,
    yaml_definition: yaml.dump(room),
    points_total:    room.points_total,
    estimated_minutes: room.estimated_minutes || 30,
    docker_image:    room.docker_image || null,
    author_id:       authorId,
  };

  const taskRows = room.tasks.map(t => ({
    sequence:       t.sequence,
    title:          t.title,
    description:    t.description || '',
    task_type:      t.type,
    points:         t.points,
    flag_required:  t.flag_required !== false,
    hint_1:         t.hints?.[0]?.text || null,
    hint_1_cost:    t.hints?.[0]?.cost || 10,
    hint_2:         t.hints?.[1]?.text || null,
    hint_2_cost:    t.hints?.[1]?.cost || 20,
    hint_3:         t.hints?.[2]?.text || null,
    hint_3_cost:    t.hints?.[2]?.cost || 30,
    answer_explanation: t.answer_explanation || null,
  }));

  return { roomRow, taskRows };
}

module.exports = { loadRoom, validateRoom, parseRoom, roomToDbRows };
