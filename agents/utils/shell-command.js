const readline = require('readline');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { loadConfig } = require('../utils/config');
const { showSelect } = require('../../UI/select');

const LOG_FILE = path.join(process.cwd(), '.shell-audit.log');

function writeAuditLog(entry) {
    try {
        const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
        fs.appendFileSync(LOG_FILE, line, 'utf8');
    } catch { /* non-fatal */ }
}

const BLOCKLIST = [
    /\brm\s+-rf\b/i,
    /\bformat\s+[a-z]:/i,
    /\bdel\s+\/[sq]/i,
    /\brd\s+\/[sq]/i,
    /\brmdir\s+\/[sq]/i,
    /\bdiskpart\b/i,
    /\bcacls\b/i,
    /\bicacls\b/i,
    /\bnet\s+user\b/i,
    /\bshutdown\b/i,
    /\breg\s+(delete|add)\b/i,
    /\bsfc\s+\/scannow\b/i,
];

function isBlocked(cmd) {
    return BLOCKLIST.some(re => re.test(cmd));
}

const EFFECT_PATTERNS = [
    { re: /\becho\s+.+>\s*(\S+)/i, label: c => `Creates/overwrites file: ${c.match(/>\s*(\S+)/)?.[1]}` },
    { re: /\bcopy\s+\S+\s+(\S+)/i, label: c => `Copies to: ${c.match(/\bcopy\s+\S+\s+(\S+)/i)?.[1]}` },
    { re: /\bmove\s+\S+\s+(\S+)/i, label: c => `Moves to: ${c.match(/\bmove\s+\S+\s+(\S+)/i)?.[1]}` },
    { re: /\bdel\s+(\S+)/i, label: c => `Deletes file: ${c.match(/\bdel\s+(\S+)/i)?.[1]}` },
    { re: /\bmkdir\s+(\S+)/i, label: c => `Creates folder: ${c.match(/\bmkdir\s+(\S+)/i)?.[1]}` },
    { re: /\bnpm\s+install\b/i, label: () => 'Installs npm packages (modifies node_modules)' },
    { re: /\bnpm\s+run\b/i, label: c => `Runs npm script: ${c.match(/\bnpm\s+run\s+(\S+)/i)?.[1] ?? '?'}` },
    { re: /\bpip\s+install\b/i, label: () => 'Installs Python package (modifies global/venv)' },
    { re: /\bgit\s+(push|commit|reset)/i, label: c => `Git ${c.match(/\bgit\s+(\S+)/i)?.[1] ?? ''} — modifies repo` },
    { re: /\bstart\s+(\S+)/i, label: c => `Opens: ${c.match(/\bstart\s+(\S+)/i)?.[1]}` },
    { re: /\bset\s+\w+=/i, label: c => `Sets env var: ${c.match(/\bset\s+(\w+)=/i)?.[1]}` },
];

function predictEffects(cmd) {
    const matches = EFFECT_PATTERNS.filter(p => p.re.test(cmd)).map(p => p.label(cmd));
    return matches.length ? matches : ['Runs a process (no filesystem changes detected)'];
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

process.on('exit', () => rl.close());
process.on('SIGINT', () => { rl.close(); process.exit(0); });

function runCommand(command, timeoutMs = 10_000) {
    return new Promise((resolve) => {
        exec(command, { timeout: timeoutMs }, (error, stdout, stderr) => {
            resolve({
                command,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: error?.code ?? 0,
                timedOut: error?.killed ?? false,
            });
        });
    });
}

function formatResults(results) {
    return results.map((r, i) => {
        const parts = [`[${i + 1}]$ ${r.command}`];
        if (r.stdout) parts.push(`out:${r.stdout}`);
        if (r.stderr) parts.push(`err:${r.stderr}`);
        if (r.timedOut) parts.push(`TIMEOUT`);
        parts.push(`exit:${r.exitCode}`);
        return parts.join(' | ');
    }).join('\n');
}

async function _buildModel() {
    const config = await loadConfig();
    const provider = config['current-provider']?.toLowerCase();
    const apiKey = config[`${provider}-api-key`];
    if (!apiKey) throw new Error(`API key for "${provider}" is not set.`);

    const PATHS = { gemini: '../models/Google', claude: '../models/Anthropic', openai: '../models/OpenAi' };
    if (!PATHS[provider]) throw new Error(`Unknown provider: ${provider}`);

    const Model = require(PATHS[provider]);
    return { model: new Model(apiKey), modelname: config['current-models'] };
}

function parseJson(raw) {
    const cleaned = raw.replace(/```json|```/g, '').replace(/^\uFEFF/, '').trim();
    const extracted = cleaned.slice(cleaned.search(/[{[]/), Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']')) + 1);

    try {
        return JSON.parse(cleaned);
    } catch {
        if (!extracted) throw new SyntaxError(`No JSON found in AI response:\n${raw}`);
        return JSON.parse(extracted);
    }
}

async function executeShellCommands(commands, { stopOnError = true, sandbox = false } = {}) {
    if (!Array.isArray(commands) || !commands.length)
        throw new Error('commands must be a non-empty array.');

    const results = [];
    const dim = s => chalk.dim(s);
    const bold = s => chalk.bold(s);
    const termW = () => process.stdout.columns || 100;
    const divider = () => chalk.dim('─'.repeat(termW() - 2));

    for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        const index = `[${i + 1}/${commands.length}]`;

        console.log();
        console.log(divider());
        console.log(
            chalk.bgHex('#0f3460').white(` ⚡ Command ${index} `) +
            '  ' +
            dim(new Date().toLocaleTimeString())
        );
        console.log(dim('  $ ') + chalk.yellow(cmd));

        if (isBlocked(cmd)) {
            const msg = 'Blocked by safety rules — command matches dangerous pattern';
            console.log(chalk.bgRed.white(' ⛔ BLOCKED ') + '  ' + chalk.red(msg));
            writeAuditLog({ status: 'blocked', command: cmd });
            results.push({ command: cmd, stdout: '', stderr: msg, exitCode: 1, timedOut: false });
            if (stopOnError) break;
            continue;
        }

        if (sandbox) {
            const effects = predictEffects(cmd);
            console.log(chalk.bgHex('#1a3a5c').white(' 🧪 SANDBOX PREVIEW '));
            effects.forEach(e => console.log(dim('  · ') + chalk.cyan(e)));
        }

        console.log(divider());

        const choices = sandbox
            ? ['✔  Confirm & run on PC', '✎  Edit before running', '✖  Skip this command', '⛔  Abort all remaining']
            : ['✔  Yes, run it', '✖  Skip this command', '⛔  Abort all remaining'];

        const choice = await showSelect({
            rl,
            title: `Execute command ${index}?`,
            message: sandbox ? 'Sandbox preview shown above. Run for real?' : 'Run this on your machine?',
            choices,
            helpers: { dim, bold },
        });

        if (!choice || choice.value.startsWith('⛔')) {
            console.log();
            console.log(chalk.red('  ⛔ Aborted.') + dim(' Remaining commands cancelled.'));
            writeAuditLog({ status: 'aborted', command: cmd });
            results.push({ command: cmd, stdout: '', stderr: 'User aborted', exitCode: 1, timedOut: false });
            break;
        }

        if (choice.value.startsWith('✖')) {
            console.log();
            console.log(dim('  ⊘ Skipped.'));
            writeAuditLog({ status: 'skipped', command: cmd });
            results.push({ command: cmd, stdout: '', stderr: 'User skipped command', exitCode: 0, timedOut: false });
            continue;
        }

        let finalCmd = cmd;
        if (choice.value.startsWith('✎')) {
            finalCmd = await new Promise(resolve => {
                rl.question(chalk.yellow('  Edit command: '), answer => {
                    resolve(answer.trim() || cmd);
                });
            });
            if (isBlocked(finalCmd)) {
                console.log(chalk.bgRed.white(' ⛔ BLOCKED ') + '  ' + chalk.red('Edited command also blocked.'));
                writeAuditLog({ status: 'blocked', command: finalCmd, original: cmd });
                results.push({ command: finalCmd, stdout: '', stderr: 'Blocked', exitCode: 1, timedOut: false });
                if (stopOnError) break;
                continue;
            }
        }

        const spinner = require('ora')({
            text: chalk.dim('Running…'),
            color: 'cyan',
            spinner: 'dots',
        }).start();

        const result = await runCommand(finalCmd);
        spinner.stop();

        result.exitCode = result.exitCode ?? 0;

        const ok = result.exitCode === 0 && !result.timedOut;
        const statusBadge = ok
            ? chalk.bgGreen.black(' ✔ OK ')
            : result.timedOut
                ? chalk.bgYellow.black(' ⏱ TIMEOUT ')
                : chalk.bgRed.white(` ✖ EXIT ${result.exitCode} `);

        console.log();
        console.log(statusBadge + '  ' + dim(finalCmd));

        writeAuditLog({
            status: ok ? 'ok' : result.timedOut ? 'timeout' : 'error',
            command: finalCmd,
            exitCode: result.exitCode,
            stdout: result.stdout.slice(0, 500),
            stderr: result.stderr.slice(0, 500),
        });

        if (result.stdout) {
            const bar = chalk.dim('─'.repeat(Math.max(0, termW() - 14)));
            console.log(chalk.dim('┌── stdout ') + bar);
            result.stdout.split('\n').forEach(line =>
                console.log(chalk.dim('│ ') + chalk.white(line))
            );
            console.log(chalk.dim('└' + '─'.repeat(termW() - 3)));
        }

        if (result.stderr) {
            const bar = chalk.dim('─'.repeat(Math.max(0, termW() - 14)));
            console.log(chalk.dim('┌── stderr ') + bar);
            result.stderr.split('\n').forEach(line =>
                console.log(chalk.dim('│ ') + chalk.red(line))
            );
            console.log(chalk.dim('└' + '─'.repeat(termW() - 3)));
        }

        const explanation = await explainOutput(finalCmd, result.stdout, result.stderr, result.exitCode);
        
        console.log();
        console.log(chalk.bgHex('#1a1a2e').cyan + '  ' + chalk.cyan(explanation));
        

        if (!result.stdout && !result.stderr) {
            console.log(dim('  (no output)'));
        }

        // Store with potentially edited command
        results.push({ ...result, command: finalCmd });

        if (stopOnError && result.exitCode !== 0) {
            console.log();
            console.log(
                chalk.red('  ✖ Stopping — command failed (exit ') +
                chalk.bold(result.exitCode) +
                chalk.red(')')
            );
            break;
        }
    }

    console.log();
    return results;
}


const SYSTEM_EXPLAIN = `You are a helpful assistant explaining shell command results to the user.
Given a command and its output, explain in 1-3 short sentences:
- What happened (success/failure)
- What the output means in plain language
- Any important warnings or next steps if relevant

Be concise and friendly. No markdown, no bullet points, plain text only.`;

async function explainOutput(command, stdout, stderr, exitCode) {
    try {
        const { model, modelname } = await _buildModel();
        const content = `Command: ${command}\nExit code: ${exitCode}\nStdout: ${stdout || '(empty)'}\nStderr: ${stderr || '(empty)'}`;
        const raw = await model.generateResponse(
            [
                { role: 'dev', content: SYSTEM_EXPLAIN },
                { role: 'user', content: content }
            ],
            modelname
        );
        return raw.trim();
    } catch {
        return null; // non-fatal, skip silently
    }
}


const SYSTEM_GENERATE = `You are a Windows CMD shell command generator.
PLATFORM: Windows only. Use Windows CMD syntax exclusively.

RULES — STRICTLY ENFORCED:
- Return ONLY a single raw JSON object. No markdown, no backticks, no \`\`\`json.
- First character MUST be '{'. Last character MUST be '}'.
- NEVER use bash/Unix commands: no cat, ls, grep, rm, chmod, etc.
- Use Windows equivalents: type (not cat), dir (not ls), del (not rm), findstr (not grep).

SCHEMA: {"tasks":[{"natural_command":"<label>","commands":["cmd1","cmd2"]}]}

EXAMPLES:
- Read file  → type "C:\\path\\to\\file.txt"
- List dir   → dir "C:\\path"
- Delete     → del "C:\\path\\file.txt"
- Open URL   → start chrome https://example.com

BAD (DO NOT USE): cat, ls, rm, grep, nano, touch
GOOD (USE THESE): type, dir, del, findstr, notepad, echo`;

const SYSTEM_CHECK = `OUTPUT RULES: Reply ONLY with raw JSON. No markdown, no backticks, no prose.
Valid responses: {"done":true} or {"done":false,"next":"<remaining task description>"}`;
async function askAiForCommands(request, context = '') {
    const { model, modelname } = await _buildModel();
    const userContent = context ? `${request}\n\nPrev output:\n${context}` : request;
    const raw = await model.generateResponse(
        [{ role: 'dev', content: SYSTEM_GENERATE }, { role: 'user', content: userContent }],
        modelname
    );

    let parsed;
    try {
        parsed = parseJson(raw);
    } catch (err) {
        throw new Error(`AI returned unparseable JSON: ${err.message}\nRaw: ${raw.slice(0, 200)}`);
    }

    if (!Array.isArray(parsed?.tasks)) {
        throw new Error(`AI response missing "tasks" array. Got: ${JSON.stringify(parsed).slice(0, 200)}`);
    }

    return parsed.tasks;
}

async function executeWithContext(naturalRequest, { maxRounds = 3, stopOnError = true, sandbox = false } = {}) {
    const rounds = [];
    let context = '';
    let request = naturalRequest;
    console.log(`Initial Request: ${naturalRequest}`);
    if (sandbox) console.log(chalk.cyan('  [Sandbox mode on — each command previewed before execution]'));

    for (let round = 1; round <= maxRounds; round++) {
        let tasks;
        try {
            tasks = await askAiForCommands(request, context);
        } catch (err) {
            console.error(chalk.red(`  ✖ AI error: ${err.message}`));
            break;
        }

        const roundResults = [];
        let roundHadError = false;

        for (const task of tasks) {
            console.log(`\n[Task] ${task.natural_command}`);
            console.log(`Commands:\n${task.commands.join('\n')}`);

            const results = await executeShellCommands(task.commands, { stopOnError, sandbox });
            const formattedOutput = formatResults(results);
            roundResults.push({ ...task, results, formattedOutput });

            context += `\n${task.natural_command}\n${formattedOutput}`;

            const failed = results.find(r => r.exitCode !== 0);
            if (failed) {
                roundHadError = true;
                if (stopOnError) break;
            }
        }

        rounds.push(roundResults);
        if (round >= maxRounds) break;

        if (roundHadError) {
            const failed = roundResults.flatMap(t => t.results).find(r => r.exitCode !== 0);
            request = `Fix: ${failed.command}\nerr:${failed.stderr}\nTask: ${naturalRequest}`;
            continue;
        }

        let check;
        try {
            const { model, modelname } = await _buildModel();
            const checkRaw = await model.generateResponse(
                [
                    { role: 'dev', content: SYSTEM_CHECK },
                    { role: 'user', content: `Task:"${naturalRequest}"\nDone:\n${context}` },
                ],
                modelname
            );
            check = parseJson(checkRaw);
        } catch {
            break;  // can't parse check response — assume done
        }

        if (check.done) break;
        request = check.next;
    }

    return { rounds };
}

module.exports = { executeShellCommands, executeWithContext, askAiForCommands };