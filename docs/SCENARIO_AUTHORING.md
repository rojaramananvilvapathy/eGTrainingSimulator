# eG Enterprise Simulation Platform — Scenario Authoring Guide

## Overview

Labs are defined as YAML files in `scenario-engine/rooms/`. Each YAML file fully describes a room: metadata, tasks, hints, flag conditions, and answer explanations. You can also create rooms through the Admin UI.

---

## Room YAML Structure

```yaml
id: unique-room-slug                      # URL slug — lowercase, hyphens only
title: "Room Title"
description: |
  Multi-line description shown to learners.
  Explain what they will learn and why it matters.

os: linux                                 # linux | windows | both
difficulty: easy                          # easy | medium | hard | expert
category: prerequisites                   # prerequisites | installation | configuration | troubleshooting
component_type: "eG Manager"              # Free text — shown in filters
phase: 3                                  # 3=prereqs, 4=install, 5=config, 6=trouble
estimated_minutes: 25
docker_image: eg-sim-linux-lab:latest     # Container image for this lab

tasks:
  - sequence: 1
    title: "Task title"
    type: terminal                         # terminal | gui_wizard | mcq | flag_submit | log_analysis
    points: 15
    description: |
      What the learner needs to do. Be specific.
      Mention what eG Enterprise does here and why this matters.
    expected_commands:
      - command-one
      - alternate-command
    flag_condition: output_contains        # See flag conditions below
    flag_trigger: "pattern|to|match"       # Regex pattern
    hints:
      - tier: 1
        cost: 10
        text: "Gentle nudge — don't give the answer"
      - tier: 2
        cost: 20
        text: "Specific command or UI path"
      - tier: 3
        cost: 30
        text: "Full answer — used only as last resort"
    answer_explanation: |
      Full explanation shown after the task is completed.
      Explain WHY this is the correct approach for eG Enterprise.
```

---

## Flag Conditions

| Condition | Triggers when |
|-----------|--------------|
| `output_contains` | Terminal output matches the regex in `flag_trigger` |
| `output_does_not_contain` | Output does NOT match `flag_trigger` (e.g. port is free) |
| `command_matches` | The command itself matches `flag_trigger` |
| `gui_action_complete` | A GUI wizard screen is advanced (Windows labs) |
| `gui_field_value` | A specific GUI field matches `flag_trigger` |

### Examples

```yaml
# Flag when 'java -version' output contains version 11 or 17
flag_condition: output_contains
flag_trigger: "version \"11|version \"17"

# Flag when port 7077 is NOT listening (port is free)
flag_condition: output_does_not_contain
flag_trigger: "7077.*LISTEN"

# Flag when a GUI wizard screen is advanced
flag_condition: gui_action_complete
flag_trigger: "db_configured"
```

---

## Task Types

### `terminal`
Used for Linux/command-line tasks. Learner types commands in xterm.js. The terminal output is evaluated against the flag condition.

### `gui_wizard`
Used for Windows tasks. The learner interacts with a simulated GUI (screen-by-screen wizard). The GUI action triggers the flag condition.

The `gui_action` field references a screen ID from `windowsSimService.js`:
- `eg_installer_welcome` → `eg_installer_license` → `eg_installer_install_type` → etc.
- `msinfo32`, `taskmgr_performance`, `disk_properties`, `firewall_advanced`

### `log_analysis`
The learner reads pre-populated log files and submits a diagnosis flag. Use `flag_submit` type with specific flag values as options.

### `flag_submit`
The learner manually enters a flag string (e.g. after a CTF-style diagnosis challenge). List available flags in the task description.

---

## Writing Good Hints

**Hint 1** should be the category of solution, not the solution itself:
> ✅ "Use a command that reads system memory information."
> ❌ "Run free -h"

**Hint 2** should give the specific approach:
> ✅ "Try: free -h (h = human-readable)"

**Hint 3** should give the full answer with context:
> ✅ "free -h — the 'total' column under Mem: shows total RAM. Must be ≥ 8G for eG Manager."

---

## Error Injection

For installation and troubleshooting labs, inject deliberate errors to make the lab realistic:

```yaml
description: |
  ⚠ Error injected: The installer will fail on the first attempt.
  Read the error message carefully and identify the fix before retrying.
```

Document the injected error in the `answer_explanation`:
```yaml
answer_explanation: |
  The injected error is a missing JAVA_HOME environment variable.
  Fix: export JAVA_HOME=$(readlink -f /usr/bin/java | sed 's:/bin/java::')
  Then rerun the installer.
```

---

## Importing a YAML Room

### Via Admin UI
1. Admin → Rooms → (use the Generate Lab or Screenshot → Lab tool)
2. Or: Admin → Generate Lab → Custom → paste YAML

### Via API
```bash
curl -X POST http://localhost:4000/api/admin/rooms \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"yaml_definition": "<yaml_string>"}'
```

### Via CLI (development)
```bash
node -e "
const { loadRoom } = require('./scenario-engine/engine/parser');
const fs = require('fs');
const room = loadRoom(fs.readFileSync('./scenario-engine/rooms/my-room.yaml','utf8'));
console.log('Valid:', room.id, '-', room.tasks.length, 'tasks,', room.points_total, 'pts');
"
```

---

## Screenshot → Lab Generator

Upload any eG Enterprise screenshot in Admin → Screenshot → Lab. The AI will:
1. Extract all visible field names, labels, and parameters
2. Generate a full YAML room with tasks, hints, and flag conditions
3. Save it as a draft room ready for review and publishing

Best screenshots to use:
- Component configuration screens (Windows, Linux, Citrix, VMware setup forms)
- DB configuration panels
- Threshold / alert rule pages
- Any screen with specific eG parameters that learners need to fill in correctly

---

## Quality Checklist

Before publishing a room, verify:

- [ ] Room has at least 3 tasks
- [ ] Every task has 3 hint tiers
- [ ] Every task has `answer_explanation`
- [ ] Flag conditions are testable (regex works against expected output)
- [ ] Error injection is clearly flagged in the task description
- [ ] Points are proportional to difficulty (easy task: 10-15 XP, hard: 30-50 XP)
- [ ] `estimated_minutes` is realistic (test it yourself first)
- [ ] YAML validates: `node -e "require('./scenario-engine/engine/parser').loadRoom(require('fs').readFileSync('room.yaml','utf8'))"`
