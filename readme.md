<div align="center">

```
██╗  ██╗ █████╗ ███╗   ██╗
██║  ██║██╔══██╗████╗  ██║
███████║███████║██╔██╗ ██║
██╔══██║██╔══██║██║╚██╗██║
██║  ██║██║  ██║██║ ╚████║
╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝
```

### **Your terminal. Now with a brain.**

*LLM-powered CLI assistant with real PC access, multi-provider AI, and natural language shell control.*

<br>

[![Node.js](https://img.shields.io/badge/Node.js-≥18.0-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Claude](https://img.shields.io/badge/Claude-Anthropic-d97706?style=flat-square)](https://anthropic.com)
[![Gemini](https://img.shields.io/badge/Gemini-Google-4285f4?style=flat-square)](https://deepmind.google/gemini)
[![OpenAI](https://img.shields.io/badge/GPT-OpenAI-10a37f?style=flat-square)](https://openai.com)

<br>

<img src="img/preview.png" width="720">

</div>

## 🧠 What is HAN?

HAN is a **terminal-based AI assistant** that goes beyond just answering questions. It can *act* — executing real shell commands on your machine, querying your database with plain English, and remembering your conversation context — all from a single terminal prompt.

Think of it as a CLI copilot that actually does things.

## ✨ Features at a glance

<table>
<tr>
<td width="50%">

### 🤖 Multi-Provider AI
Switch freely between **Claude**, **Gemini**, and **GPT** with a single config change. No code changes needed.

</td>
<td width="50%">

### 💻 Real PC Access
HAN can run shell commands on your machine — open apps, manage files, clone repos, and more — using plain language.

</td>
</tr>
<tr>
<td width="50%">

### 🗄️ NLP → SQL
Describe what you want from your database in plain English. HAN converts it to safe, parameterized MySQL queries automatically.

</td>
<td width="50%">

### 🔄 Streaming Output
Responses appear in real-time with a typewriter effect, markdown rendering, and live token usage tracking in the terminal.

</td>
</tr>
<tr>
<td width="50%">

### 🧩 Skill System
Drop a `.md` file into `skills/` and manage which ones are active from the Skill Manager. Only enabled skills are injected into the prompt — no restarts needed.

</td>
<td width="50%">

### 💬 Conversation History
Every conversation is **auto-saved** to disk. Resume any past session from the main menu — the full chat history is replayed in the terminal exactly as it looked live.

</td>
</tr>
<tr>
<td width="50%">

### 🧵 Smart History
Rolling context window with automatic summarization keeps conversations coherent without burning tokens.

</td>
<td width="50%">

### 🧪 Sandbox Mode
Preview the predicted side effects of every shell command before it touches your machine.

</td>
</tr>
</table>

## ⚡ Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/TsumuX/han.git
cd han

# 2. Install dependencies
npm install

# 3. Run first-time setup
#    This creates config.json, .env, and skills/
npm run setup

# 4. Launch HAN
npm start
```

On first launch, go to **⚙ Configure agent** to set your API key, provider, and model before starting a conversation.

> **Global install** — use HAN from anywhere:
> ```bash
> npm install -g .
> start-han   # launch
> ```

## ⚙️ Configuration

HAN comes with an **interactive configuration menu** built right into the CLI. You don't need to edit any files manually.

### Launching the config menu

Start HAN and select **⚙ Configure agent** from the main menu:

<img src="img/home.png" width="720">

### Configuration options

<img src="img/configure.png" width="720">

### Step 1 — Set your API key

Choose **🔑 Set API key**, then pick your provider. Input is **masked** as you type.

<img src="img/api-key.png" width="720">

<img src="img/input-key.png" width="720">

### Step 2 — Choose active provider

Choose **🌐 Choose active provider** and select one of the three supported providers.

<img src="img/provider.png" width="720">

### Step 3 — Set your model

Choose **🤖 Set model name**. A list of preset models for your active provider will appear:

**Claude (Anthropic)**
```
   claude-opus-4-5
   claude-sonnet-4-5
   claude-haiku-4-5
   ✏  Custom model name…
```

**Gemini (Google)**
```
   gemini-2.5-flash
   gemini-1.5-pro
   gemini-1.5-flash
   ✏  Custom model name…
```

**OpenAI**
```
   gpt-4o
   gpt-4o-mini
   gpt-3.5-turbo
   ✏  Custom model name…
```

Pick a preset or choose **✏ Custom model name…** to type any model string manually.

### Manual config (advanced)

If you prefer editing directly, `config.json` is created by `npm run setup` at the project root:

```json
{
    "current-provider": "claude",
    "current-models":   "claude-sonnet-4-5",
    "claude-api-key":   "sk-ant-...",
    "gemini-api-key":   "",
    "openai-api-key":   "",
    "stream-response":  true,
    "sandbox":          false,
    "active-skills":    ["nlp"]
}
```

> ⚠️ `config.json` is git-ignored by default. Never commit this file.

**Supported providers:**

| Provider | `current-provider` | Preset models |
|---|---|---|
| 🟠 Anthropic Claude | `claude` | `claude-opus-4-5` · `claude-sonnet-4-5` · `claude-haiku-4-5` |
| 🔵 Google Gemini | `gemini` | `gemini-2.5-flash` · `gemini-1.5-pro` · `gemini-1.5-flash` |
| 🟢 OpenAI GPT | `openai` | `gpt-4o` · `gpt-4o-mini` · `gpt-3.5-turbo` |

You only need to fill in the key for the provider you're actively using.

## 👤 Tell Han About You

From the main menu, select **💡 Tell Han About You** to run a short intro questionnaire. HAN will ask for your name and a brief description of yourself, then save the result to `skills/introduction.md`.

```
  What should Han call you?
  ❯ Alex

  How would you describe yourself?  —  brief is fine
  ❯ Backend developer, loves automation
```

This creates a skill file that gets injected into the system prompt whenever it's active, allowing HAN to greet you by name and tailor its responses to your background.

> The introduction skill is stored at `skills/introduction.md`. Enable it in the Skill Manager to activate it.

## 🗄️ Database Setup (optional)

To enable the NLP → SQL feature, configure your MySQL credentials in `.env` (created by `npm run setup`):

```env
DATABASE_HOST=localhost
DATABASE_USER=root
DATABASE_PASSWORD=yourpassword
DATABASE_NAME=yourdb
```

## 💬 Conversation History

HAN automatically saves every conversation to disk as a JSON file inside the `conversations/` folder. You never need to manually save — it happens silently after every AI response.

### Auto-save behaviour

After each completed turn (user message + AI reply), HAN writes the full message history and rolling summary to `conversations/<id>.json`. The title is derived automatically from the first message you sent. If a conversation already has a file, it is overwritten with the latest state.

```
conversations/
  1714900000000-a3f2.json   ← auto-named by timestamp + random suffix
  1714901234567-b7c1.json
  ...
```

Each file contains the conversation id, title, creation time, last-updated time, the full message array, and the compressed summary:

```json
{
    "id": "1714900000000-a3f2",
    "title": "How do I list running processes?",
    "createdAt": "2026-05-01T10:00:00.000Z",
    "updatedAt": "2026-05-01T10:04:22.000Z",
    "messages": [
        { "role": "user",      "content": "How do I list running processes?", "ts": "..." },
        { "role": "assistant", "content": "You can use `tasklist` on Windows…", "ts": "..." }
    ],
    "summary": "U:list running processes | A:use tasklist command"
}
```

### Accessing the Conversation History browser

From the main menu, select **💬 Conversation history**. The banner also shows how many conversations are currently saved.

```
  ╭────────────────────────────────────────╮
  │ ⚙  Active configuration               │
  ├────────────────────────────────────────┤
  │ Provider  │ [claude]                   │
  │ Model     │ claude-sonnet-4-5          │
  │ Status    │ ● ready                    │
  ╰────────────────────────────────────────╯
    (12 conversations saved)
```

### What you can do

From the Conversation History menu you can load a past conversation to resume it, start a fresh conversation (clearing the current in-memory session), list all saved conversations with message counts and timestamps, rename a conversation to something memorable, and delete a conversation with confirmation.

### Loading a conversation

Select **📂 Load conversation**, pick one from the list, and HAN will restore the full message history into the active session and drop you straight into the chat screen. All previous messages are **replayed to the terminal** — user bubbles and assistant responses with full markdown rendering — so you can see the entire context before continuing.

```
  📂  Loaded conversation — showing history   14 messages

  ─────────────────────────────────────────────────────────

  You    10:00:12
  │
  │  How do I list running processes?
  │

  Assistant  10:00:15
  │
  │  You can use `tasklist` on Windows to see all running
  │  processes. For more detail, try `tasklist /v`.
  │

  ─────────────────────────────────────────────────────────
    ↑ End of history — continue below

❯ _
```

After the history replay, the prompt appears and you can continue the conversation exactly where it left off. The AI retains full context of everything said previously.

### Starting a new conversation

Select **✦ Start new conversation** from the Conversation History menu, or simply select **⚡ Start conversation** from the main menu. Either way, the previous in-memory session is cleared and a new save file will be created on your first response.

> Your last session is always already saved — starting a new conversation does not lose any data.

### Renaming a conversation

Titles are auto-generated from your first message. If you want something more descriptive, select **✏ Rename conversation**, pick the entry, and type a new title. The change is saved immediately.

### Deleting a conversation

Select **🗑 Delete conversation**, choose the entry, and confirm. Deletion is permanent — there is no recycle bin.

### Conversation file location

```
conversations/           ← auto-created at project root on first save
  *.json
```

The folder is git-ignored by default. If you want to commit your conversations, remove `conversations/` from `.gitignore`.

## 🧩 Skill Manager

Skills are plain `.md` files that get injected into every system prompt, teaching HAN how to behave for specific tasks. HAN includes a full **interactive Skill Manager** accessible from the main menu under **⚔ Manage skills**.

### Active vs inactive skills

Skills are **opt-in** — a skill file being present in `skills/` does not mean it is active. Only skills you explicitly enable are injected into the AI prompt. This keeps the context lean and lets you swap skill sets without deleting files.

The `active-skills` array in `config.json` holds the list of currently enabled skill names (filename without `.md`):

```json
"active-skills": ["nlp", "my-custom-skill"]
```

An empty array means no skills are active. HAN still works normally — it just won't have any extra skill context.

### What you can do

From the Skill Manager menu you can enable or disable individual skills, add a new skill, edit an existing skill, view a skill's content with syntax highlighting, list all skills with their active status and line/character counts, and delete a skill with confirmation.

### Enabling and disabling skills

Select **🔧 Enable / Disable skills** from the Skill Manager menu. Each skill in the list shows its current state:

```
  [ ✔ enabled ]  nlp
  [ ○ disabled]  my-draft-skill
  [ ○ disabled]  experimental
  ← Done
```

Pick any skill to toggle it on or off instantly. The change takes effect on the next conversation turn — no restart needed. Select **← Done** when finished.

The **List skills** view also shows the active status badge next to each entry so you always have a quick overview.

### Adding a skill

Select **Add skill**, enter a name, and a full-screen **inline editor** opens directly in your terminal. The editor supports the following keyboard shortcuts:

| Key | Action |
|---|---|
| Arrow keys | Move cursor |
| Home / End | Jump to start or end of line |
| Page Up / Down | Scroll by screen height |
| Ctrl+S | Mark as saved (in-memory) |
| Ctrl+W | Save and exit |
| Ctrl+X or Ctrl+C | Exit without saving |

The editor shows line numbers, a modified indicator (● yellow when unsaved, ✔ green when clean), and the current line and column in the status bar. It handles horizontal scrolling automatically when a line exceeds the terminal width.

New skills are saved as **disabled** by default. Go to **🔧 Enable / Disable skills** to activate them.

### Editing a skill

Select **Edit skill**, choose from the list, and the same full-screen editor opens pre-loaded with the existing content. A `.bak` backup of the original file is written before saving.

### Skill file location

```
skills/
  ├── nlp.md              ← built-in: NLP-to-SQL
  ├── introduction.md     ← auto-generated by "Tell Han About You"
  └── your-skill.md       ← drop any .md here, subfolders supported
```

Skills are loaded recursively — subfolders work fine. The skill cache is invalidated automatically after any add, edit, delete, or toggle operation so the next conversation picks up the changes immediately without restarting HAN.

### Writing a good skill

A skill file typically contains three sections: what the skill does, the expected input and output format, and concrete examples with sample input and output. The more specific the examples, the more reliably HAN will apply the skill. See `skills/nlp.md` for a reference implementation.

## 💻 Shell Command Execution

> ⚠️ **HAN has real access to your PC.** It runs shell commands using your current user's permissions — the same things you can do in a terminal, HAN can do too. Use with care.

This is HAN's most powerful feature. When it detects a system-level task in your prompt, it doesn't just describe what to do — it **does it**.

### How it works, step by step

```
You type something
        │
        ▼
  ┌─────────────────────────────────────────┐
  │  1. INTENT CLASSIFICATION               │
  │     LLM decides: shell task or chat?    │
  └────────────────┬────────────────────────┘
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
  Shell Task               Conversation
       │                       │
       ▼                       ▼
  ┌──────────────┐      ┌──────────────────┐
  │ 2. GENERATE  │      │  stream response │
  │  LLM builds  │      │  with history    │
  │  task list + │      └──────────────────┘
  │  commands    │
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │ 3. SAFETY    │
  │  blocklist   │
  │  check       │
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │ 4. EXECUTE   │
  │  run on PC   │
  │  (10s limit) │
  └──────┬───────┘
         │
         ▼
  ┌──────────────────────────────┐
  │ 5. SELF-CORRECTION LOOP      │
  │  failed? → LLM fixes it      │
  │  done?   → stop              │
  │  more?   → continue          │
  │  max 3 rounds                │
  └──────────────────────────────┘
```

### Intent Classification

Before doing anything, HAN runs a lightweight **AI classifier** on every message to decide whether you're asking it to do a system task or just having a conversation. This prevents HAN from accidentally running commands when you're only asking questions, and ensures shell tasks are handled with the right pipeline.

Prompts are classified as shell intent when they describe OS-level operations (run, execute, install, delete, create files/folders, etc.) and as conversation when they ask for explanations, definitions, creative writing, or general chat. The classifier responds with either `VALID` or `INVALID: <reason>` — no grey area.

### Safety: Command Blocklist

Every generated command passes through a **hardcoded blocklist** before it is ever shown to the user or executed. Commands matching any of the following patterns are immediately blocked and logged:

| Pattern | Why it's blocked |
|---|---|
| `rm -rf` | Recursive delete with no confirmation |
| `format X:` | Disk formatting |
| `del /s` or `del /q` | Silent recursive delete |
| `rd /s` or `rd /q` | Recursive directory removal |
| `rmdir /s` or `rmdir /q` | Recursive directory removal |
| `diskpart` | Low-level disk partitioning |
| `cacls` / `icacls` | Modifying file ACLs |
| `net user` | User account manipulation |
| `shutdown` | System shutdown/restart |
| `reg delete` / `reg add` | Registry modification |
| `sfc /scannow` | System file checker (requires elevation) |

Blocked commands are flagged in the terminal with a ⛔ badge and written to the audit log. They are never sent to the shell.

### Sandbox Mode

Sandbox mode adds a **preview step** before every command runs, showing you the predicted side effects so you can decide whether to proceed, edit, or skip.

**Enable sandbox mode** by typing `sandbox` at the conversation prompt:

```
❯ sandbox
🧪 SANDBOX MODE ENABLED
```

This sets `"sandbox": true` in `config.json` and persists across restarts. To disable it, type `sandbox` again at the prompt to toggle it off.

### Effect Prediction

When sandbox mode is enabled, HAN runs `predictEffects()` on each command before asking for your confirmation. It scans the command text and tells you exactly what side effects to expect — before anything touches your machine:

```
🧪 SANDBOX PREVIEW
  · Creates/overwrites file: output.txt
  · Installs npm packages (modifies node_modules)
```

Detected effect categories include file creation and overwriting, copy and move operations, file deletion, folder creation, npm/pip package installs, git push/commit/reset, opening applications, and environment variable assignments. If none of these patterns match, the preview simply states "Runs a process (no filesystem changes detected)."

### Execution Confirmation Flow

Every command requires explicit user approval before it runs. The prompt changes based on whether sandbox mode is on or off:

**Standard mode** — four options:
```
  ✔  Yes, run it
  ✎  Edit before running
  ✖  Skip this command
  ⛔  Abort all remaining
```

**Sandbox mode** — four options:
```
  ✔  Confirm & run on PC
  ✎  Edit before running
  ✖  Skip this command
  ⛔  Abort all remaining
```

### Inline Command Editor

Choosing **✎ Edit before running** opens a single-line inline editor where you can rewrite the command before it runs. The editor supports rich keyboard shortcuts:

| Key | Action |
|---|---|
| ←/→ | Move cursor one character |
| Ctrl+←/→ | Jump one word left/right |
| Home / Ctrl+A | Jump to start of line |
| End / Ctrl+E | Jump to end of line |
| Backspace | Delete character to the left |
| Delete | Delete character to the right |
| Ctrl+K | Clear from cursor to end of line |
| Ctrl+U | Clear from start of line to cursor |
| Ctrl+W | Delete previous word |
| Enter | Confirm and run |
| Esc / Ctrl+C | Cancel — keep original command |

Paste support works as well; multi-character clipboard content is inserted at the cursor position in one operation.

The edited command is re-checked against the blocklist before execution.

### AI-Powered Output Explanation

After every command completes, HAN automatically sends the result to the AI and prints a **plain-English explanation** below the stdout/stderr output. You don't need to parse exit codes or decipher cryptic terminal output — HAN tells you what happened, what the output means, and if there's anything you should do next. This explanation is concise (1–3 sentences) and uses no markdown or bullet points. If the AI takes longer than 8 seconds to respond, the explanation step is silently skipped so it never blocks your workflow.

```
✔ OK  dir "%USERPROFILE%\Desktop"
┌── stdout ────────────────────────────
│  Volume in drive C is Windows
│  ...
└──────────────────────────────────────
  The Desktop folder contains 12 items including 3 directories.
  Everything looks normal — no errors detected.
```

### Shell Audit Log

Every command interaction is silently written to **`.shell-audit.log`** in your project root. Each entry is a JSON line containing:

* `ts` — ISO timestamp
* `status` — one of `ok`, `error`, `timeout`, `blocked`, `skipped`, `aborted`
* `command` — the exact command string
* `exitCode` — numeric exit code
* `stdout` / `stderr` — first 500 characters of output

The log is append-only and non-fatal — if writing fails for any reason, HAN continues without interruption. This gives you a full audit trail of everything HAN has done on your machine.

```json
{"ts":"2026-01-15T10:23:01.452Z","status":"ok","command":"dir \"%USERPROFILE%\\Desktop\"","exitCode":0,"stdout":"Volume in drive C...","stderr":""}
{"ts":"2026-01-15T10:23:45.881Z","status":"blocked","command":"rm -rf /"}
{"ts":"2026-01-15T10:24:12.003Z","status":"skipped","command":"npm install"}
```

### What HAN can do on your machine

| Category | Examples |
|---|---|
| 📁 **Files & Folders** | Create, move, rename, copy, delete anything |
| 🚀 **Launch Apps** | Open browsers, editors, apps by name |
| 🌐 **Web** | Open URLs, run curl, check connectivity |
| 🛠️ **Dev Tools** | Run `npm`, `git`, `python`, compilers, build tools |
| 🔍 **System Info** | Disk usage, running processes, env variables |
| 🔗 **Automation** | Chain multi-step tasks from a single prompt |

### See it in action

```
❯ create a folder called "projects" on my desktop and open it
```
```cmd
mkdir "%USERPROFILE%\Desktop\projects"
start "" "%USERPROFILE%\Desktop\projects"
✔ Done in 1 round
```

```
❯ clone https://github.com/user/repo into my documents
```
```cmd
cd "%USERPROFILE%\Documents" && git clone https://github.com/user/repo.git
✔ Done in 1 round
```

```
❯ find and delete all .tmp files in C:\Temp
```
```
Round 1 → command fails (access denied on some files)
Round 2 → LLM adjusts approach with error handling
Round 3 → success ✔
```

### Limitations to know

* 🪟 Targets **Windows CMD** by default — edit `SYSTEM_GENERATE` in `src/agents/utils/shell-command.js` for Linux/macOS
* 🔒 Runs as **your user** — no privilege escalation
* ⏱️ **10 second timeout** per command — may be too short for large downloads or installs
* 🚫 **No whitelist by default** — HAN is as powerful (and risky) as your own terminal

## 🗄️ NLP to SQL

When paired with a MySQL database, HAN can interpret natural language and convert it into safe, parameterized queries — no SQL knowledge needed.

```
❯ show all active projects
→ SELECT * FROM `proyek` WHERE `status` = ?  ['active']

❯ mark task 42 as done
→ UPDATE `work` SET `status` = ? WHERE `id` = ?  ['done', 42]

❯ delete the paint task
→ ⚠ Ambiguous — 3 tasks match. Confirmation required.
```

Queries with **low confidence** or **ambiguous matches** are flagged before execution. Nothing runs without your go-ahead.

> The NLP → SQL feature requires the `nlp` skill to be **enabled** in the Skill Manager.

### JOIN support

The NLP engine supports LEFT, RIGHT, INNER, and FULL JOIN operations on SELECT queries. When a join is needed, columns and WHERE clauses are automatically prefixed with the table name (e.g. `work.id`, `proyek.name`). JOIN is not permitted on INSERT, UPDATE, or DELETE operations.

### Confidence and ambiguity

Every generated action carries a `confidence` score from 0.0 to 1.0 and an `ambiguity_level` of `low`, `medium`, or `high`. Actions with confidence below 0.8 or ambiguity above `low` are routed to a confirmation queue and will not execute until you approve them. A maximum of 5 actions can be generated per request.

## 🧵 Conversation History & Memory

HAN maintains a per-user conversation history with automatic summarization so long conversations don't silently eat your token budget.

### How the rolling window works

The history manager keeps a **recent window of the last 20 messages** in full. When the conversation grows beyond that, the oldest messages are evicted from the window and compressed into a rolling summary that gets prepended to every new request as a system message.

```
[Summary]
U:how do I list files | A:Use dir in Windows CMD | U:what about hidden files | A:Add /a flag to dir
```

Individual messages are truncated at **800 characters** if they're too long, cutting at the last sentence boundary where possible. If the total history payload exceeds **6,000 characters**, older messages are trimmed further from the front until it fits — always preserving at least the two most recent turns for context continuity.

### Memory tuning (advanced)

These defaults live in `src/agents/response.js` inside the `HistoryManager` constructor call and can be adjusted:

| Option | Default | Description |
|---|---|---|
| `recentWindow` | `20` | How many messages to keep in full before summarizing |
| `maxMsgChars` | `800` | Max characters per individual message |
| `maxTotalChars` | `6000` | Max total character budget for history payload |
| `maxSummaryChars` | `800` | Max characters for the rolling summary |

Summaries use compressed notation (`U:` for user, `A:` for assistant) to maximize information density within the character budget.

## 🗂️ Project Structure

```
han/
├── src/
│   ├── agents/
│   │   ├── models/
│   │   │   ├── base-model.js          ← abstract base for all providers
│   │   │   ├── Anthropic.js           ← Claude
│   │   │   ├── Google.js              ← Gemini
│   │   │   └── OpenAi.js              ← GPT
│   │   ├── utils/
│   │   │   ├── config.js              ← read/write config.json
│   │   │   ├── conversation.js        ← conversation save/load engine 💬
│   │   │   ├── history.js             ← conversation memory & summarization
│   │   │   ├── insturctor.js          ← NLP-to-SQL engine
│   │   │   ├── load-skills.js         ← skill loader (respects active-skills list)
│   │   │   └── shell-command.js       ← PC execution engine ⚡
│   │   ├── configure.js               ← interactive config CLI
│   │   ├── conversation-ui.js         ← conversation history browser 💬
│   │   ├── response.js                ← main AI pipeline
│   │   └── skills.js                  ← interactive Skill Manager CLI
│   ├── core/
│   │   └── utils/
│   │       ├── deploySQL.js           ← MySQL connection pool
│   │       └── files.js               ← filesystem helpers
│   ├── UI/
│   │   ├── headers.js                 ← terminal header & label renderers
│   │   ├── introduction.js            ← "Tell Han About You" flow
│   │   ├── main.js                    ← chat loop + history replay
│   │   ├── renderer.js                ← markdown stream printer
│   │   ├── select.js                  ← interactive select menu
│   │   └── utils.js                   ← shared terminal utilities
│   ├── cli.js                         ← dependency check & entry point
│   ├── index.js                       ← main menu / launcher
│   └── setup.js                       ← first-time setup script
├── conversations/                     ← auto-created; one JSON file per session 💬
├── skills/                            ← drop .md skill files here
│   ├── nlp.md                         ← built-in: NLP-to-SQL (disabled by default)
│   └── introduction.md                ← auto-generated by "Tell Han About You"
├── .shell-audit.log                   ← auto-generated command audit trail
├── config.json                        ← main config (git-ignored)
└── .env                               ← database credentials (git-ignored)
```

## 📋 Config Reference

### `config.json`

| Key | Type | Description |
|---|---|---|
| `current-provider` | `string` | Active provider: `claude` / `gemini` / `openai` |
| `current-models` | `string` | Model string passed to the API |
| `claude-api-key` | `string` | Anthropic API key |
| `gemini-api-key` | `string` | Google API key |
| `openai-api-key` | `string` | OpenAI API key |
| `stream-response` | `boolean` | Typewriter streaming output (`true` / `false`) |
| `sandbox` | `boolean` | Sandbox mode — preview command effects before execution |
| `active-skills` | `string[]` | List of skill names (without `.md`) that are injected into the prompt. Empty array = no skills active. |

### `.env`

| Key | Description |
|---|---|
| `DATABASE_HOST` | MySQL host |
| `DATABASE_USER` | MySQL username |
| `DATABASE_PASSWORD` | MySQL password |
| `DATABASE_NAME` | Database name |

## 🔄 Reset Configuration

If you need to wipe all settings and start over, go to **⚙ Configure agent → ↩ Reset all settings**, or delete `config.json` and re-run `npm run setup`.

---

<div align="center">

**MIT License © 2026 TsumuX**

*Built for people who live in the terminal.*

</div>