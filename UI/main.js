const readline = require('readline');
const chalk    = require('chalk');
const ora      = require('ora');
const { streamModelResponse, historyManager } = require('../agents/response');

const width = () => process.stdout.columns || 80;
const line  = (char = '─') => char.repeat(width());
const dim   = (s) => chalk.dim(s);
const bold  = (s) => chalk.bold(s);
const utils = { width, line, dim, bold };

const {
    printHeader,
    printUserMessage,
    printAssistantLabel,
    printAssistantChunkEnd,
} = require('./headers');

const {
    printDivider,
    getPromptPrefix,
    printError,
} = require('./utils');

const { StreamPrinter } = require('./renderer');
const { saveConfig, loadConfig } = require('../agents/utils/config');

const USER_ID = 'default-user';

function printHistory() {
    const messages = historyManager.get(USER_ID);
    if (!messages || messages.length === 0) return;

    const termWidth  = width();
    const innerWidth = termWidth - 4;

    const cfg      = loadConfig();
    const convMgr  = (() => {
        try { return require('../agents/response').conversationManager; }
        catch { return null; }
    })();

    console.log();
    console.log(
        chalk.bgHex('#1a3a5c').white(' 📂  Loaded conversation — showing history ') +
        dim(`  ${messages.length} message${messages.length === 1 ? '' : 's'}`)
    );
    console.log(dim('─'.repeat(Math.min(termWidth - 2, 74))));
    console.log();

    for (const msg of messages) {
        if (msg.role === 'user') {
            const ts = msg.ts ? new Date(msg.ts).toLocaleTimeString() : '';
            console.log(
                chalk.bgHex('#1e1e2e').white(' You ') +
                '  ' +
                dim(ts)
            );
            console.log(dim('│'));
            const lines = wrapText(msg.content, innerWidth);
            lines.forEach(l => console.log(dim('│ ') + chalk.white(l)));
            console.log(dim('│'));

        } else if (msg.role === 'assistant') {
            const ts = msg.ts ? new Date(msg.ts).toLocaleTimeString() : '';
            console.log();
            console.log(chalk.bgHex('#0f4c75').white(' Assistant ') + '  ' + dim(ts));
            console.log(dim('│'));

            const printer = new StreamPrinter(utils);
            process.stdout.write(dim('│ '));
            printer.write(msg.content);
            printer.flush();
            console.log();
            console.log(dim('│'));
            console.log();
        }
    }

    console.log(dim('─'.repeat(Math.min(termWidth - 2, 74))));
    console.log(dim('  ↑ End of history — continue below'));
    console.log();
}

function wrapText(text, maxWidth) {
    const lines = [];
    for (const rawLine of String(text).split('\n')) {
        if (rawLine.length <= maxWidth) { lines.push(rawLine); continue; }
        const words = rawLine.split(' ');
        let current = '';
        for (const word of words) {
            if ((current + (current ? ' ' : '') + word).length > maxWidth) {
                if (current) lines.push(current);
                current = word.length > maxWidth ? word.slice(0, maxWidth) : word;
            } else {
                current = current ? current + ' ' + word : word;
            }
        }
        if (current) lines.push(current);
    }
    return lines;
}


async function main() {
    printHeader(utils);
    printHistory();

    const rl = readline.createInterface({
        input:    process.stdin,
        output:   process.stdout,
        terminal: false,
    });

    const ask = () => new Promise(resolve => {
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdout.write('\n' + getPromptPrefix());
        rl.resume();
        rl.once('line', (input) => {
            process.stdout.write('\x1B[1A\x1B[2K');
            rl.pause();
            resolve(input);
        });
    });

    while (true) {
        const input = await ask();
        if (!input.trim()) continue;

        if (input.trim().toLowerCase() === 'exit') {
            console.log('\n' + dim('Goodbye.\n'));
            rl.close();
            break;
        }

        if (input.trim().toLowerCase() === 'sandbox') {
            const config    = await loadConfig();
            const newStatus = !config.sandbox;
            const statusText = newStatus ? 'ENABLED' : 'DISABLED';
            const bgColor    = newStatus ? '#1a3a5c' : '#4a1a1a';

            console.log('\n' + chalk.bgHex(bgColor).white(` 🧪 SANDBOX MODE ${statusText} `));
            await saveConfig({ ...config, sandbox: newStatus });
            continue;
        }

        printUserMessage(input, utils);
        printDivider(utils);

        const spinner  = ora({ text: chalk.dim('Thinking…'), color: 'cyan', spinner: 'dots' }).start();
        let firstChunk = true;
        const printer  = new StreamPrinter(utils);

        try {
            for await (const chunk of streamModelResponse(USER_ID, input)) {
                if (firstChunk) {
                    spinner.stop();
                    printAssistantLabel(utils);
                    firstChunk = false;
                }
                printer.write(chunk);
            }

            printer.flush();
            const stats = historyManager.stats(USER_ID);
            printAssistantChunkEnd(utils, stats);

        } catch (err) {
            spinner.stop();
            printError(err.message || String(err));
        }

        printDivider(utils);
    }
}

main().catch(console.error);