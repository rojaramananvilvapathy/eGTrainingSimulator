# eG Enterprise Simulation Platform — Player Guide

## Welcome

The eG Sim Platform is a hands-on training environment for eG Enterprise. It works like TryHackMe — you spin up a lab, complete tasks, capture flags, and earn XP. No slides. No videos. Just doing.

---

## Getting Started

### 1. Create your account
Go to the platform URL, click **Register**, and create your account. Your username will appear on the leaderboard.

### 2. Pick a lab
On the **Labs** page, rooms are organised by phase. Start from the top — prerequisites labs unlock the foundation you need for installation labs, and so on.

**Recommended order:**
1. Prerequisites labs (Phase 3) — Linux first, then Windows
2. Installation labs (Phase 4)
3. Configuration labs (Phase 5)
4. Troubleshooting labs (Phase 6)

### 3. Start the lab environment
Click a room, then click **Start Lab**. A sandboxed environment spins up in about 10 seconds. You get a real terminal (Linux) or a GUI wizard simulator (Windows).

### 4. Read the task
Each task appears in the right panel. Read the description carefully — it tells you what to do and why it matters for eG Enterprise.

### 5. Work in the terminal or GUI
For Linux labs: type commands in the terminal. For Windows labs: interact with the simulated GUI wizard.

### 6. Submit the flag
When you complete a task, the platform generates a flag in the format `eGSIM{...}`. Copy it and paste it into the **Submit flag** field. Press Enter.

### 7. Move to the next task
Correct flag → XP awarded → next task unlocks automatically.

---

## Hints

Each task has up to 3 hint tiers. Using a hint costs XP:
- **Hint 1** (10 XP) — gentle nudge toward the right approach
- **Hint 2** (20 XP) — specific command or UI path
- **Hint 3** (30 XP) — full answer with explanation

Use hints strategically. Completing a prerequisite lab with zero hints earns you the **Prereq Pro** badge.

---

## XP & Points

| Action | XP |
|--------|-----|
| Flag captured (base) | Varies per task (10–50 XP) |
| First Blood bonus | +50% of base XP |
| Hint used | −10/20/30 XP |
| Badge earned | +50 to +1000 XP |

Your total XP determines your position on the global leaderboard.

---

## Badges

| Badge | How to earn |
|-------|------------|
| First Flag | Capture your very first flag |
| First Install | Complete an installation lab |
| Prereq Pro | Complete all prereq labs with zero hints |
| Log Whisperer | Solve a log analysis challenge on the first attempt |
| Speed Demon | Complete a room in under half the estimated time |
| First Blood | Be the first globally to capture a flag in a room |
| Troubleshooter | Complete all troubleshooting labs |
| eG Master | Complete every room on the platform |

---

## Lab Rules

- Labs have a **60-minute timeout**. If you need more time, stop and restart the lab — your progress is saved.
- You can have up to **2 labs running simultaneously**.
- Flags are **session-scoped** — your flag is different from another learner's flag for the same task. Don't share flags.
- The hint system is per-user — hints you use don't affect other learners.

---

## Tips for Success

**Prerequisites labs:** Don't rush. Read every output carefully. Real eG installations fail because of prereqs checked too quickly.

**Installation labs:** Error injection is intentional. The first failure is the lesson — read the error message, identify the fix, then retry. That's exactly how real eG installs go.

**Troubleshooting labs:** Always start with the logs. The first error in the log file is almost always the root cause. Later errors are cascading effects.

**Log analysis labs:** Use `grep -E "ERROR|FATAL"` first. Then use `-B5 -A15` to get context around the error. The Java class name in the stack trace tells you which eG component failed.

---

## Keyboard Shortcuts (Terminal)

| Key | Action |
|-----|--------|
| `Tab` | Auto-complete commands and paths |
| `Ctrl+C` | Cancel running command |
| `Ctrl+L` | Clear terminal |
| `↑ / ↓` | Command history |
| `Ctrl+R` | Search command history |

---

## Getting Help

- **Stuck on a task?** Use the hints — they're designed to get you unstuck without giving the full answer.
- **Docs reference:** The **Docs** panel (right side of the lab room) contains eG-specific reference info for the current lab category.
- **Full docs:** https://docs.eginnovations.com
