const readline = require('readline');
const chalk = require('chalk');
const ora = require('ora');
const { streamModelResponse } = require('./agents/response');

const width = () => process.stdout.columns || 80;
const line = (char = '─') => char.repeat(width());
const dim = (s) => chalk.dim(s);
const bold = (s) => chalk.bold(s);
const utils = { width, line, dim, bold };
const { printHeader, printUserMessage, printAssistantLabel, printAssistantChunkEnd, printDivider } = require('./UI/UI');

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
async function typeWrite(text, delay = 12) {
    for (const char of text) {
        process.stdout.write(chalk.white(char));
        await sleep(delay);
    }
}

async function main() {
    printHeader(utils);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = () => new Promise(resolve => {
        process.stdout.write('\n' + chalk.cyan('❯ '));
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

        const spinner = ora({ text: chalk.dim('Thinking…'), color: 'cyan', spinner: 'dots' }).start();
        let firstChunk = true;

        for await (const chunk of streamModelResponse('default-user', input)) {
            if (firstChunk) {
                spinner.stop();
                printAssistantLabel(utils);
                firstChunk = false;
            }
            await typeWrite(chunk);
        }

        printAssistantChunkEnd(utils);
        printDivider(utils);
    }
}

main().catch(console.error);