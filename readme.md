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

---

## 🧠 What is HAN?

HAN is a **terminal-based AI assistant** that goes beyond just answering questions. It can *act* — executing real shell commands on your machine, querying your database with plain English, and remembering your conversation context — all from a single terminal prompt.

Think of it as a CLI copilot that actually does things.

---

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
Drop a `.md` file into `agents/skills/` and HAN immediately gains new capabilities — no restarts, no code changes.

</td>
<td width="50%">

### 🧵 Smart History
Rolling context window with automatic summarization keeps conversations coherent without burning tokens.

</td>
</tr>
</table>

---

## ⚡ Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/TsumuX/han.git
cd han

# 2. Install dependencies
npm install

# 3. Run first-time setup
#    This creates agents/config.json, .env, and agents/skills/
npm run setup

# 4. Launch HAN
npm start
```

On first launch, go to **⚙ Configure agent** to set your API key, provider, and model before starting a conversation.

> **Global install** — use HAN from anywhere:
> ```bash
> npm install -g .
> start-han   # launch
> setup-han   # re-run first-time setup
> ```

---

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

If you prefer editing directly, `agents/config.json` is created by `npm run setup`:

```json
{
    "current-provider": "claude",
    "current-models":   "claude-sonnet-4-5",
    "claude-api-key":   "sk-ant-...",
    "gemini-api-key":   "",
    "openai-api-key":   "",
    "stream-response":  true
}
```

> ⚠️ `agents/config.json` is git-ignored by default. Never commit this file.

**Supported providers:**

| Provider | `current-provider` | Preset models |
|---|---|---|
| 🟠 Anthropic Claude | `claude` | `claude-opus-4-5` · `claude-sonnet-4-5` · `claude-haiku-4-5` |
| 🔵 Google Gemini | `gemini` | `gemini-2.5-flash` · `gemini-1.5-pro` · `gemini-1.5-flash` |
| 🟢 OpenAI GPT | `openai` | `gpt-4o` · `gpt-4o-mini` · `gpt-3.5-turbo` |

You only need to fill in the key for the provider you're actively using.

---

## 🗄️ Database Setup (optional)

To enable the NLP → SQL feature, configure your MySQL credentials in `.env` (created by `npm run setup`):

```env
DATABASE_HOST=localhost
DATABASE_USER=root
DATABASE_PASSWORD=yourpassword
DATABASE_NAME=yourdb
```

---

## 💻 Shell Command Execution

> ⚠️ **HAN has real access to your PC.** It runs shell commands using your current user's permissions — the same things you can do in a terminal, HAN can do too. Use with care.

This is HAN's most powerful feature. When it detects a system-level task in your prompt, it doesn't just describe what to do — it **does it**.

### How it works, step by step

```
You type something
        │
        ▼
  ┌─────────────────────────────────────────┐
  │  1. INTENT CHECK                        │
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
  │ 3. EXECUTE   │
  │  run on PC   │
  │  (10s limit) │
  └──────┬───────┘
         │
         ▼
  ┌──────────────────────────────┐
  │ 4. SELF-CORRECTION LOOP      │
  │  failed? → LLM fixes it      │
  │  done?   → stop              │
  │  more?   → continue          │
  │  max 3 rounds                │
  └──────────────────────────────┘
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

---

```
❯ clone https://github.com/user/repo into my documents
```
```cmd
cd "%USERPROFILE%\Documents" && git clone https://github.com/user/repo.git
✔ Done in 1 round
```

---

```
❯ find and delete all .tmp files in C:\Temp
```
```
Round 1 → command fails (access denied on some files)
Round 2 → LLM adjusts approach with error handling
Round 3 → success ✔
```

### Limitations to know

- 🪟 Targets **Windows CMD** by default — edit `SYSTEM_GENERATE` in `agents/utils/shell-command.js` for Linux/macOS
- 🔒 Runs as **your user** — no privilege escalation
- ⏱️ **10 second timeout** per command — may be too short for large downloads or installs
- 🚫 **No sandbox or whitelist** — HAN is as powerful (and risky) as your own terminal

---

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

---

## 🧩 Skills

Skills are plain `.md` files that get injected into every system prompt. They teach HAN how to behave for specific tasks.

```
agents/skills/
  ├── nlp.md          ← built-in: NLP-to-SQL
  └── your-skill.md   ← drop any .md here, subfolders supported
```

A skill file typically contains:
- What the skill does
- Expected input/output format
- Examples

HAN scans recursively and picks up all `.md` files automatically on next launch. No restart needed if you add a skill while HAN is not running.

---

## 🗂️ Project Structure

```
han/
├── agents/
│   ├── models/
│   │   ├── base-model.js      ← abstract base for all providers
│   │   ├── Anthropic.js       ← Claude
│   │   ├── Google.js          ← Gemini
│   │   └── OpenAi.js          ← GPT
│   ├── skills/                ← drop .md skill files here
│   ├── utils/
│   │   ├── config.js          ← read/write agents/config.json
│   │   ├── history.js         ← conversation memory & summarization
│   │   ├── insturctor.js      ← NLP-to-SQL engine
│   │   ├── load-skills.js     ← recursive skill loader
│   │   └── shell-command.js   ← PC execution engine ⚡
│   ├── configure.js           ← interactive config CLI
│   └── response.js            ← main AI pipeline
├── core/
│   └── utils/
│       ├── deploySQL.js       ← MySQL connection pool
│       └── files.js           ← filesystem helpers
├── UI/
│   ├── headers.js             ← terminal header & label renderers
│   ├── renderer.js            ← markdown stream printer
│   ├── select.js              ← interactive select menu
│   └── utils.js               ← shared terminal utilities
├── index.js                   ← conversation entry point
├── cli.js                     ← main menu / launcher
└── setup.js                   ← first-time setup script
```

---

## 📋 Config Reference

### `agents/config.json`

| Key | Type | Description |
|---|---|---|
| `current-provider` | `string` | Active provider: `claude` / `gemini` / `openai` |
| `current-models` | `string` | Model string passed to the API |
| `claude-api-key` | `string` | Anthropic API key |
| `gemini-api-key` | `string` | Google API key |
| `openai-api-key` | `string` | OpenAI API key |
| `stream-response` | `boolean` | Typewriter streaming output (`true` / `false`) |

### `.env`

| Key | Description |
|---|---|
| `DATABASE_HOST` | MySQL host |
| `DATABASE_USER` | MySQL username |
| `DATABASE_PASSWORD` | MySQL password |
| `DATABASE_NAME` | Database name |

---

## 🔄 Reset Configuration

If you need to wipe all settings and start over, go to **⚙ Configure agent → ↩ Reset all settings**, or delete `agents/config.json` and re-run:

```bash
npm run setup
```

---

<div align="center">

**MIT License © 2026 TsumuX**

*Built for people who live in the terminal.*

</div>