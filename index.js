const readline = require('readline');
const chalk    = require('chalk');
const ora      = require('ora');

const { streamModelResponse, historyManager } = require('./agents/response');

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
    printDivider,
    getPromptPrefix,
    printError,
    StreamPrinter,
} = require('./UI/UI');

const USER_ID = 'default-user';

async function main() {
    printHeader(utils);

    const rl  = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = () => new Promise(resolve => {
        process.stdout.write('\n' + getPromptPrefix());
        rl.once('line', resolve);
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

        const spinner   = ora({ text: chalk.dim('Thinking…'), color: 'cyan', spinner: 'dots' }).start();
        let firstChunk  = true;
        const printer   = new StreamPrinter(utils);

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