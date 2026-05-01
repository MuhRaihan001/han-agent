const readline = require('readline');
const chalk = require('chalk');

const { exec } = require('child_process');
const { loadConfig } = require('../utils/config');
const { showSelect } = require('../../UI/select');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

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
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
}


async function executeShellCommands(commands, { stopOnError = true } = {}) {
    if (!Array.isArray(commands) || !commands.length)
        throw new Error('commands must be a non-empty array.');

    const results = [];
    const dim  = s => chalk.dim(s);
    const bold = s => chalk.bold(s);
    for (const cmd of commands) {

        const askToRun = await showSelect({
            rl,
            title: `Run command?`,
            message: `Would you like to run:\n${chalk.yellow(cmd)}`,
            choices: ['Yes', 'No'],
            helpers: { dim, bold }
        });

        if (!askToRun || askToRun.value === 'No') {
            results.push({ command: cmd, stdout: '', stderr: 'User skipped command', exitCode: 0, timedOut: false });
            rl.close();
            continue;
        }

        const result = await runCommand(cmd);
        results.push(result);
        if (stopOnError && result.exitCode !== 0) break;
    }
    return results;
}

const SYSTEM_GENERATE = `You are a shell command generator (Windows).
Respond ONLY with raw JSON, no markdown or explanation.
Format: {"tasks":[{"natural_command":"<step summary>","commands":["cmd1"]}]}
Split each logical action into its own task object.
Example input: "create file hello.txt and open youtube"
Example output: {"tasks":[{"natural_command":"Create hello.txt","commands":["echo Hello > hello.txt"]},{"natural_command":"Open YouTube in Chrome","commands":["start chrome https://youtube.com"]}]}`;

const SYSTEM_CHECK = `Reply ONLY JSON: {"done":true} or {"done":false,"next":"<remaining task>"}`;

async function askAiForCommands(request, context = '') {
    const { model, modelname } = await _buildModel();
    const userContent = context ? `${request}\n\nPrev output:\n${context}` : request;
    const raw = await model.generateResponse(
        [{ role: 'assistant', content: SYSTEM_GENERATE }, { role: 'user', content: userContent }],
        modelname
    );
    const parsed = parseJson(raw);
    return parsed.tasks;
}

async function executeWithContext(naturalRequest, { maxRounds = 3, stopOnError = true } = {}) {
    const rounds = [];
    let context = '';
    let request = naturalRequest;
    console.log(`Initial Request: ${naturalRequest}`);

    for (let round = 1; round <= maxRounds; round++) {
        const tasks = await askAiForCommands(request, context);

        const roundResults = [];
        for (const task of tasks) {
            console.log(`\n[Task] ${task.natural_command}`);
            console.log(`Commands:\n${task.commands.join('\n')}`);

            const results = await executeShellCommands(task.commands, { stopOnError });
            const formattedOutput = formatResults(results);
            roundResults.push({ ...task, results, formattedOutput });

            context += `\n${task.natural_command}\n${formattedOutput}`;

            if (stopOnError && results.find(r => r.exitCode !== 0)) break;
        }

        rounds.push(roundResults);
        if (round >= maxRounds) break;

        const anyFailed = roundResults.flatMap(t => t.results).find(r => r.exitCode !== 0);
        if (anyFailed) {
            request = `Fix: ${anyFailed.command}\nerr:${anyFailed.stderr}\nTask: ${naturalRequest}`;
            continue;
        }

        const { model, modelname } = await _buildModel();
        const checkRaw = await model.generateResponse(
            [
                { role: 'assistant', content: SYSTEM_CHECK },
                { role: 'user', content: `Task:"${naturalRequest}"\nDone:\n${context}` },
            ],
            modelname
        );

        let check;
        try { check = parseJson(checkRaw); } catch { break; }
        if (check.done) break;
        request = check.next;
    }

    return { rounds };
}
module.exports = { executeShellCommands, executeWithContext, askAiForCommands };