# Workspaces

Workspaces let you run multiple agent personalities from a single installation.

## Concept

Each workspace is a directory containing configuration files that define an agent's:
- **Personality** (SOUL.md)
- **Identity** (IDENTITY.md)
- **User context** (USER.md)
- **Memory** (MEMORY.md, memory/)
- **Tasks** (HEARTBEAT.md)
- **Security rules** (AGENTS.md)

## Directory Structure

```
workspaces/
  default/              # default workspace
    AGENTS.md           # security framework (don't modify)
    SOUL.md             # agent personality
    IDENTITY.md         # agent name and role
    USER.md             # your profile
    MEMORY.md           # long-term memory
    HEARTBEAT.md        # scheduled tasks
    memory/             # daily logs (YYYY-MM-DD.md)
  work/                 # work-focused agent
    ...
  creative/             # creative writing agent
    ...
```

## Creating a Workspace

```bash
make workspace-new NAME=work
```

This copies templates to `workspaces/work/`. Customize the files:

```bash
# edit the personality
$EDITOR workspaces/work/SOUL.md

# edit the identity
$EDITOR workspaces/work/IDENTITY.md
```

## Switching Workspaces

```bash
# use default workspace
make chat

# use work workspace
make chat WORKSPACE=work

# use creative workspace
make chat WORKSPACE=creative
```

## Workspace Files

### AGENTS.md (Don't Modify)

Security framework with:
- Trust levels for different input sources
- Red flags for prompt injection
- Output hygiene rules

### SOUL.md (Customize)

Agent personality:
```markdown
# SOUL.md

## Essence
- Direct, no filler
- Has opinions
- Acts first, asks permission for external actions

## Tone
Professional. Concise. Helpful.
```

### IDENTITY.md (Customize)

Name and role:
```markdown
# IDENTITY.md

## Name
Atlas

## Role
Personal productivity assistant

## Philosophy
Ship today, iterate tomorrow.
```

### USER.md (Customize)

Your profile:
```markdown
# USER.md

## Name
Alex

## Timezone
America/New_York

## Preferences
- Prefer code over explanations
- Use tabs, not spaces
- Always use TypeScript
```

### MEMORY.md (Agent Manages)

Long-term notes the agent curates over time.

### HEARTBEAT.md (Optional)

Tasks for the agent to execute on heartbeat:
```markdown
# HEARTBEAT.md

- [ ] Check email and summarize important messages
- [ ] Review calendar for tomorrow
```

### memory/ (Agent Manages)

Daily logs in `YYYY-MM-DD.md` format. The agent reads today and yesterday on each session.

## Example Workspaces

### Work Agent

`workspaces/work/SOUL.md`:
```markdown
# SOUL.md

## Essence
- Professional, task-oriented
- Respects work-life boundaries
- Proactive about deadlines

## Tone
Concise. Direct. Business-appropriate.
```

### Creative Agent

`workspaces/creative/SOUL.md`:
```markdown
# SOUL.md

## Essence
- Playful, exploratory
- Encourages wild ideas
- No judgment zone

## Tone
Casual. Enthusiastic. Imaginative.
```

### Research Agent

`workspaces/research/SOUL.md`:
```markdown
# SOUL.md

## Essence
- Thorough, methodical
- Cites sources
- Questions assumptions

## Tone
Academic. Precise. Balanced.
```

## Listing Workspaces

```bash
make workspace-list
```

## Backup and Restore

Workspaces are included in backups:

```bash
make backup     # includes all workspaces
make restore FILE=backup.tar.gz
```

## Tips

1. **Start with default** - Use it before creating specialized workspaces
2. **Copy working configs** - Base new workspaces on ones that work well
3. **Keep AGENTS.md unchanged** - Security rules should be consistent
4. **Let memory evolve** - Don't manually edit MEMORY.md often
5. **Use descriptive names** - `work`, `personal`, `creative`, `research`
