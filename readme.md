# HAN — LLM-Powered CLI Assistant

> A terminal-based AI assistant that supports multiple LLM providers, NLP-to-SQL conversion, and intelligent shell command execution.

---

## Features

- **Multi-provider LLM support** — switch between Claude (Anthropic), Gemini (Google), and OpenAI with a simple config
- **Streaming responses** — real-time typewriter output in the terminal
- **NLP-to-SQL** — convert plain English into safe, parameterized MySQL queries
- **Shell command execution** — AI-driven multi-round shell task execution with self-correction
- **Conversation history** — rolling context window with automatic summarization
- **Skill system** — extend the assistant's behavior by dropping `.md` files into the `agents/skills/` folder
- **Modular model architecture** — easily add new LLM providers by extending `BaseModel`

---

## Preview

<img src="img/preview.png">

---

## Requirements

- **Node.js** `>= 18.0.0`
- **npm** `>= 8.0.0`
- A MySQL database (required only for NLP-to-SQL features)
- At least one LLM API key (Anthropic, Google, or OpenAI)

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/TsumuX/han.git
cd han
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the setup script

The setup script creates the required `agents/config.json`, `.env`, and `agents/skills/` folder automatically.

```bash
npm run setup
# or using the custom CLI command:
npx setup-han
```

> After running setup, you'll see:
> ```
> ✔️ Created default config.json.
> ✔️ Created .env file.
> ✔️ Created skills folder.
> ✔️ Setup complete.
> ```

### 4. Configure your API keys

Open `agents/config.json` and fill in your credentials:

```json
{
  "current-models": "claude-sonnet-4-5",
  "current-provider": "claude",
  "gemini-api-key": "YOUR_GEMINI_KEY",
  "claude-api-key": "YOUR_CLAUDE_KEY",
  "openai-api-key": "YOUR_OPENAI_KEY",
  "stream-response": true
}
```

**Supported providers and example model strings:**

| Provider | `current-provider` value | Example `current-models` value |
|---|---|---|
| Anthropic Claude | `claude` | `claude-sonnet-4-5` |
| Google Gemini | `gemini` | `gemini-2.0-flash` |
| OpenAI | `openai` | `gpt-4o-mini` |

You only need to fill in the API key for the provider you intend to use.

### 5. Configure the database (optional)

If you plan to use the NLP-to-SQL skill, fill in your MySQL credentials in `.env`:

```env
DATABASE_HOST=localhost
DATABASE_USER=root
DATABASE_PASSWORD=yourpassword
DATABASE_NAME=yourdb
```

### 6. Start the assistant

```bash
npm start
# or using the custom CLI command:
npx start-han
```

---

## Global Installation (Custom CLI)

To use `start-han` and `setup-han` as global commands from anywhere on your machine:

```bash
npm install -g .
```

Then you can run from any directory:

```bash
setup-han   # first-time setup
start-han   # launch the assistant
```

To uninstall the global commands:

```bash
npm uninstall -g ryux-remake
```

---

## Usage

Once running, type your message at the `❯` prompt:

```
❯ show all active projects
❯ mark task 42 as done
❯ create a folder called reports on the desktop
❯ what is the capital of Indonesia?
```

Type `exit` to quit.

### How it works

1. **Plain conversation** — the assistant answers using the configured LLM with your conversation history
2. **Shell commands** — if your input looks like a system task, the assistant generates and executes shell commands, then shows you the output
3. **NLP-to-SQL** — if you integrate the `Instructor` utility in your own code, plain-language database commands are converted to safe parameterized queries before execution

---

## Adding Skills

Skills extend the assistant's knowledge by injecting context into every prompt. Drop a `.md` file into `agents/skills/`:

```
agents/
  skills/
    nlp.md        ← included by default
    your-skill.md ← create your own
```

Each skill file should describe a capability, its output format, and examples. The content is automatically prepended to every system prompt.

---

## Project Structure

```
han/
├── agents/
│   ├── models/
│   │   ├── base-model.js      # Abstract base class for LLM providers
│   │   ├── Anthropic.js       # Claude integration
│   │   ├── Google.js          # Gemini integration
│   │   └── OpenAi.js          # OpenAI integration
│   ├── skills/
│   │   └── nlp.md             # NLP-to-SQL skill definition
│   ├── utils/
│   │   ├── config.js          # Config read/write helpers
│   │   ├── history.js         # Conversation history manager
│   │   ├── insturctor.js      # NLP-to-SQL query builder
│   │   ├── load-skills.js     # Skills loader
│   │   └── shell-command.js   # Shell execution engine
│   └── response.js            # Main response pipeline
├── core/
│   └── utils/
│       ├── deploySQL.js       # MySQL connection pool
│       └── files.js           # Filesystem utilities
├── UI/
│   └── UI.js                  # Terminal UI rendering
├── index.js                   # Main entry point
├── cli.js                     # CLI entry point
├── setup.js                   # Setup script
├── package.json
└── .env                       # Database credentials (not committed)
```

---

## Configuration Reference

### `agents/config.json`

| Key | Type | Description |
|---|---|---|
| `current-provider` | string | Active LLM provider: `claude`, `gemini`, or `openai` |
| `current-models` | string | Model name string passed to the provider API |
| `claude-api-key` | string | Anthropic API key |
| `gemini-api-key` | string | Google Gemini API key |
| `openai-api-key` | string | OpenAI API key |
| `stream-response` | boolean | Enable streaming (typewriter) output |

### `.env`

| Key | Description |
|---|---|
| `DATABASE_HOST` | MySQL host |
| `DATABASE_USER` | MySQL username |
| `DATABASE_PASSWORD` | MySQL password |
| `DATABASE_NAME` | Database name |

---

## License

MIT © 2026 TsumuX