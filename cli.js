#!/usr/bin/env node
const readline = require('readline');
const chalk = require('chalk');
const { printHeader } = require('./UI/headers');
const { showSelect } = require('./UI/select');
const { loadConfig, getProviderColor } = require('./UI/utils');

const dim = s => chalk.dim(s);
const bold = s => chalk.bold(s);

const termWidth = () => process.stdout.columns || 100;
const line = () => '─'.repeat(termWidth() - 2);

function printBanner() {

    const cfg = loadConfig();
    const provider = cfg['current-provider'] || 'unknown';
    const model = cfg['current-models'] || 'unknown';
    const pColor = getProviderColor(provider);

    const w = Math.min(termWidth() - 4, 80);
    const colLeft = Math.floor(w * 0.5);
    const colRight = w - colLeft - 3;

    function padR(str, width) {
        const v = str.replace(/\x1B\[[0-9;]*m/g, '').length;
        return str + ' '.repeat(Math.max(0, width - v));
    }

    function infoRow(label, value) {
        const l = padR(dim(label), colLeft);
        const r = padR(value, colRight);
        return chalk.cyan('│') + ' ' + l + chalk.cyan('│') + ' ' + r + ' ' + chalk.cyan('│');
    }

    const topSep = chalk.cyan('╭' + '─'.repeat(w) + '╮');
    const midSep = chalk.cyan('├' + '─'.repeat(w) + '┤');
    const botSep = chalk.cyan('╰' + '─'.repeat(w) + '╯');

    const hdrText = ' ⚙  Active configuration';
    const hdrPad = ' '.repeat(Math.max(0, w - hdrText.length));
    const hdrLine = chalk.cyan('│') + chalk.bold.white(hdrText) + hdrPad + chalk.cyan('│');

    console.log(topSep);
    console.log(hdrLine);
    console.log(midSep);
    console.log(infoRow('Provider', pColor(`[${provider}]`)));
    console.log(infoRow('Model', chalk.yellow(model)));
    console.log(infoRow('Status', chalk.green('● ready')));
    console.log(botSep);
    console.log();
}

async function main() {
    printBanner();

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const result = await showSelect({
        rl,
        title: '✦  Main Menu',
        message: 'What would you like to do?',
        choices: [
            '⚡  Start conversation',
            '⚙   Configure agent',
            '✖   Exit',
        ],
        helpers: { dim, bold },
    });

    if (!result) {
        console.log('\n' + dim('Cancelled.'));
        rl.close();
        return;
    }

    const choice = result.value.trim();

    if (choice.startsWith('✖')) {
        console.log('\n' + chalk.cyan('Goodbye! ') + dim('See you next time.\n'));
        rl.close();
        process.exit(0);
    } else if (choice.startsWith('⚡')) {
        rl.close();
        require('./index');
    } else if (choice.startsWith('⚙')) {
        rl.close();
        require('./agents/configure');
    }
}

main().catch(err => {
    console.error(chalk.red('Fatal error: ') + err.message);
    process.exit(1);
});