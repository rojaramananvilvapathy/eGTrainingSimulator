/**
 * runner.js
 * Executes a loaded YAML room scenario, evaluating task flag conditions
 * against terminal output or GUI wizard events, and calling back to
 * the flag service when conditions are met.
 */

const { loadRoom }              = require('./parser');
const { evaluateTaskCondition } = require('../../backend/src/services/windowsSimService');
const logger = require('../../backend/src/config/logger');

class ScenarioRunner {
  /**
   * @param {string} yamlText  Raw YAML room definition
   * @param {string} userId
   * @param {string} sessionId
   * @param {Function} onFlagCaptured  Callback(taskId, taskSeq) when a flag condition is met
   */
  constructor(yamlText, userId, sessionId, onFlagCaptured) {
    this.room        = loadRoom(yamlText);
    this.userId      = userId;
    this.sessionId   = sessionId;
    this.onFlagCaptured = onFlagCaptured;

    // Map sequence number → task config for O(1) lookup
    this.taskMap     = new Map(this.room.tasks.map(t => [t.sequence, t]));
    this.completed   = new Set();   // sequences completed
    this.currentSeq  = 1;
  }

  /** Evaluate a terminal command output against the current task's flag condition. */
  evaluateTerminalOutput(command, output) {
    const task = this.taskMap.get(this.currentSeq);
    if (!task || this.completed.has(this.currentSeq)) return { flagCaptured: false };

    if (task.type !== 'terminal') return { flagCaptured: false };

    const condition = task.flag_condition || 'output_contains';
    const trigger   = task.flag_trigger   || '';

    const met = evaluateTaskCondition(condition, trigger, command, output);

    if (met) {
      this.completed.add(this.currentSeq);
      logger.info('Task flag condition met (terminal)', {
        seq: this.currentSeq, title: task.title, userId: this.userId,
      });
      this.currentSeq++;
      if (this.onFlagCaptured) {
        this.onFlagCaptured(this.currentSeq - 1, task);
      }
      return { flagCaptured: true, task, nextSeq: this.currentSeq };
    }
    return { flagCaptured: false };
  }

  /** Evaluate a GUI wizard event against the current task's flag condition. */
  evaluateGuiAction(screenId, flagTrigger) {
    const task = this.taskMap.get(this.currentSeq);
    if (!task || this.completed.has(this.currentSeq)) return { flagCaptured: false };

    if (task.type !== 'gui_wizard') return { flagCaptured: false };

    const trigger = task.flag_trigger || '';
    const met     = task.flag_condition === 'gui_action_complete' ||
                    (flagTrigger && new RegExp(trigger, 'i').test(flagTrigger));

    if (met) {
      this.completed.add(this.currentSeq);
      logger.info('Task flag condition met (GUI)', {
        seq: this.currentSeq, title: task.title, screenId,
      });
      this.currentSeq++;
      if (this.onFlagCaptured) {
        this.onFlagCaptured(this.currentSeq - 1, task);
      }
      return { flagCaptured: true, task, nextSeq: this.currentSeq };
    }
    return { flagCaptured: false };
  }

  /** Return the current task for display. */
  currentTask() {
    return this.taskMap.get(this.currentSeq) || null;
  }

  /** Return progress summary. */
  progress() {
    return {
      total:       this.room.tasks.length,
      completed:   this.completed.size,
      currentSeq:  this.currentSeq,
      isFinished:  this.completed.size === this.room.tasks.length,
      pointsEarned: [...this.completed].reduce((sum, seq) => {
        const t = this.taskMap.get(seq);
        return sum + (t?.points || 0);
      }, 0),
    };
  }

  /** Return hint for current task at given tier (1-3), deducting XP. */
  getHint(tier) {
    const task = this.currentTask();
    if (!task) return null;
    const hints = task.hints || [];
    return hints.find(h => h.tier === tier) || null;
  }
}

module.exports = { ScenarioRunner };
