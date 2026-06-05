/**
 * screenshotLabService.js
 *
 * Phase 8 — Screenshot-to-Lab Generator
 *
 * Takes eG Enterprise UI screenshots (uploaded by admin), uses the
 * Anthropic Claude API vision capability to:
 *   1. Extract all visible UI fields, labels, and parameter names
 *   2. Identify the eG component/screen type
 *   3. Generate a complete YAML room definition with realistic tasks,
 *      hints, and flag conditions based on what's in the screenshot
 *
 * This fulfils the roadmap Phase 5 correction:
 *   "screenshot-based GUI replication — import eG screenshots to auto-generate
 *    DB config panels, initial setup screens, and configuration forms as
 *    interactive simulations"
 */

const logger = require('../config/logger');
const db     = require('../db');
const yaml   = require('js-yaml');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL             = 'claude-sonnet-4-20250514';

/**
 * Analyse a screenshot and generate a YAML lab room definition.
 *
 * @param {string} base64Image   Base64-encoded screenshot (PNG/JPEG)
 * @param {string} mediaType     'image/png' | 'image/jpeg'
 * @param {object} context       { os, difficulty, phase, component_type, admin_notes }
 * @param {string} authorId      UUID of the admin creating the lab
 * @returns {{ room, yamlText, taskCount, extractedFields }}
 */
async function generateLabFromScreenshot(base64Image, mediaType, context, authorId) {
  logger.info('Screenshot lab generation started', { authorId, component: context.component_type });

  // ── Step 1: Extract UI fields from screenshot ────────────────
  const extractionPrompt = `You are an expert at analysing eG Enterprise monitoring software screenshots.

Analyse this screenshot and extract:
1. The exact screen/page title or navigation path
2. All visible form fields, labels, input types, and their current values
3. Any dropdowns and their visible options
4. Buttons and their labels
5. Any error messages or status indicators
6. The component type being configured (e.g. Windows Server, Citrix, VMware, eG Manager DB config)

Respond ONLY with a JSON object (no markdown, no explanation):
{
  "screen_title": "string",
  "navigation_path": "string",
  "component_type": "string",
  "fields": [
    { "label": "string", "type": "text|select|checkbox|password|number", "value": "string", "required": true/false, "options": [] }
  ],
  "buttons": ["string"],
  "status_indicators": ["string"],
  "error_messages": ["string"],
  "description": "one paragraph describing what this screen is for"
}`;

  const extractionResponse = await callAnthropicVision(base64Image, mediaType, extractionPrompt);
  let extracted;
  try {
    extracted = JSON.parse(extractionResponse);
  } catch {
    throw new Error('Failed to parse screenshot analysis. Ensure the image is a clear eG Enterprise screenshot.');
  }

  // ── Step 2: Generate YAML lab from extracted fields ──────────
  const labGenPrompt = `You are building a TryHackMe-style simulation lab for eG Enterprise training.

Based on this extracted UI data from an eG Enterprise screenshot:
${JSON.stringify(extracted, null, 2)}

Additional context:
- OS: ${context.os || 'both'}
- Difficulty: ${context.difficulty || 'medium'}
- Phase: ${context.phase || 5}
- Admin notes: ${context.admin_notes || 'none'}

Generate a complete YAML room definition for this eG Enterprise configuration screen simulation.
The lab should:
1. Teach learners what this screen does and why each field matters
2. Have 3-5 sequential tasks guiding the learner through completing this configuration
3. Include realistic hints (3 tiers) and flag conditions for each task
4. Reference eG Enterprise-specific knowledge (correct values, common mistakes, prerequisites)
5. Match the exact field names and values visible in the screenshot

RESPOND ONLY with valid YAML. No explanation, no markdown fences. Start directly with the YAML.
Follow this exact structure:

id: config-<slug-from-screen-title>
title: "eG Enterprise — <screen title>"
description: |
  <description of what this lab covers>
os: ${context.os || 'both'}
difficulty: ${context.difficulty || 'medium'}
category: configuration
component_type: <from screenshot>
phase: ${context.phase || 5}
estimated_minutes: 25
docker_image: eg-sim-linux-lab:latest
tasks:
  - sequence: 1
    title: "..."
    type: gui_wizard
    points: 20
    description: |
      ...
    gui_action: <screen_id>
    flag_condition: gui_action_complete
    flag_trigger: "..."
    hints:
      - tier: 1
        cost: 10
        text: "..."
      - tier: 2
        cost: 20
        text: "..."
      - tier: 3
        cost: 30
        text: "..."
    answer_explanation: |
      ...`;

  const yamlText = await callAnthropicVision(base64Image, mediaType, labGenPrompt);

  // Clean YAML (strip any accidental markdown fences)
  const cleanYaml = yamlText
    .replace(/^```ya?ml\n?/i, '')
    .replace(/^```\n?/m, '')
    .replace(/```$/m, '')
    .trim();

  // Validate YAML parses correctly
  let room;
  try {
    room = yaml.load(cleanYaml);
    if (!room?.id || !room?.tasks) throw new Error('Invalid room structure');
  } catch (err) {
    throw new Error(`Generated YAML is invalid: ${err.message}`);
  }

  // Compute total points
  const pointsTotal = (room.tasks || []).reduce((s, t) => s + (t.points || 0), 0);

  // ── Step 3: Save to database ─────────────────────────────────
  const { rows } = await db.query(
    `INSERT INTO rooms
       (slug, title, description, os, difficulty, status, phase, category,
        component_type, yaml_definition, points_total, estimated_minutes,
        docker_image, author_id)
     VALUES ($1,$2,$3,$4,$5,'draft',$6,'configuration',$7,$8,$9,$10,$11,$12)
     RETURNING id, slug, title`,
    [
      room.id,
      room.title,
      room.description || '',
      room.os || context.os || 'both',
      room.difficulty || context.difficulty || 'medium',
      room.phase || context.phase || 5,
      room.component_type || extracted.component_type || 'eG Manager',
      cleanYaml,
      pointsTotal,
      room.estimated_minutes || 25,
      room.docker_image || 'eg-sim-linux-lab:latest',
      authorId,
    ]
  );

  const roomId = rows[0].id;

  // Insert tasks
  for (const task of (room.tasks || [])) {
    await db.query(
      `INSERT INTO tasks
         (room_id, sequence, title, description, task_type, points,
          hint_1, hint_1_cost, hint_2, hint_2_cost, hint_3, hint_3_cost, answer_explanation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        roomId, task.sequence, task.title, task.description || '',
        task.type || 'gui_wizard', task.points || 20,
        task.hints?.[0]?.text || null, task.hints?.[0]?.cost || 10,
        task.hints?.[1]?.text || null, task.hints?.[1]?.cost || 20,
        task.hints?.[2]?.text || null, task.hints?.[2]?.cost || 30,
        task.answer_explanation || '',
      ]
    );
  }

  logger.info('Screenshot lab generated', {
    roomSlug: room.id, tasks: room.tasks?.length, authorId,
  });

  return {
    room:            rows[0],
    yamlText:        cleanYaml,
    taskCount:       room.tasks?.length || 0,
    extractedFields: extracted,
  };
}

// ── Anthropic API helper ──────────────────────────────────────
async function callAnthropicVision(base64Image, mediaType, prompt) {
  const response = await fetch(ANTHROPIC_API_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 4096,
      messages: [
        {
          role:    'user',
          content: [
            {
              type:   'image',
              source: { type: 'base64', media_type: mediaType, data: base64Image },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

module.exports = { generateLabFromScreenshot };
