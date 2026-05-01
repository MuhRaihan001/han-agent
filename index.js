const readline = require('readline');
const chalk = require('chalk');
const ora = require('ora');

const { streamModelResponse, historyManager } = require('./agents/response');

const width = () => process.stdout.columns || 80;
const line = (char = '─') => char.repeat(width());
const dim = (s) => chalk.dim(s);
const bold = (s) => chalk.bold(s);
const utils = { width, line, dim, bold };


const {
    printHeader,
    printUserMessage,
    printAssistantLabel,
    printAssistantChunkEnd
} = require('./UI/headers');


const {
    printDivider,
    getPromptPrefix,
    printError
} = require('./UI/utils');

const { StreamPrinter } = require('./UI/renderer');

const USER_ID = 'default-user';

async function main() {
    printHeader(utils);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });

    const ask = () => new Promise(resolve => {
        // Pastikan raw mode OFF dan echo dikontrol readline saja
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }

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

        printUserMessage(input, utils);
        printDivider(utils);

        const spinner = ora({ text: chalk.dim('Thinking…'), color: 'cyan', spinner: 'dots' }).start();
        let firstChunk = true;
        const printer = new StreamPrinter(utils);

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