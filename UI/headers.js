const chalk = require('chalk');
const { loadConfig, stripAnsi, wrapText, getProviderColor } = require('./utils');

function printHeader({ width, line, dim, bold }) {
    console.clear();

    const ascii = [
        '██╗  ██╗ █████╗ ███╗   ██╗',
        '██║  ██║██╔══██╗████╗  ██║',
        '███████║███████║██╔██╗ ██║',
        '██╔══██║██╔══██║██║╚██╗██║',
        '██║  ██║██║  ██║██║ ╚████║',
        '╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝',
    ];

    ascii.forEach(row => console.log(chalk.cyan(row)));
    console.log();

    const w     = width();
    const title = '  ✦  Assistant powered by LLMs  ✦  ';
    const hint  = 'type "exit" to quit  ';
    const pad   = w - title.length - hint.length;

    console.log(chalk.cyan('╭' + '─'.repeat(w - 2) + '╮'));
    console.log(
        chalk.cyan('│') +
        bold(chalk.white(title)) +
        ' '.repeat(Math.max(0, pad)) +
        dim(hint) +
        chalk.cyan('│')
    );
    console.log(chalk.cyan('╰' + '─'.repeat(w - 2) + '╯'));
    console.log();
}

function printUserMessage(text, { dim }) {
    const termWidth  = process.stdout.columns || 100;
    const innerWidth = termWidth - 4;

    console.log();
    console.log(
        chalk.bgHex('#1e1e2e').white(' You ') +
        '  ' +
        dim(new Date().toLocaleTimeString())
    );
    console.log(dim('│'));
    const wrappedLines = wrapText(text, innerWidth);
    wrappedLines.forEach(l => console.log(dim('│ ') + chalk.white(l)));
    console.log(dim('│'));
}

function printAssistantLabel({ dim }, stats = {}) {
    const cfg      = loadConfig();
    const model    = stats.model    || cfg['current-models']   || 'unknown';
    const provider = stats.provider || cfg['current-provider'] || 'unknown';

    const badge   = chalk.bgHex('#0f4c75').white(' Assistant ');
    const time    = dim(new Date().toLocaleTimeString());
    const left    = badge + '  ' + time;

    const pColor   = getProviderColor(provider);
    const modelTag = pColor(`[${provider}]`) + ' ' + chalk.yellow(model);
    const right    = modelTag;

    const termWidth = process.stdout.columns || 100;
    const gap = Math.max(2, termWidth - stripAnsi(left).length - stripAnsi(right).length - 2);

    console.log();
    console.log(left + ' '.repeat(gap) + right);
    console.log(dim('│'));
    process.stdout.write(dim('│ '));
}

function printAssistantChunkEnd({ dim }, _stats = {}) {
    console.log();
    console.log(dim('│'));
    console.log();
}

function printAssistantLabelUpdate(labelRow, { dim }, stats = {}) {
    if (typeof labelRow !== 'number') return;

    const cfg      = loadConfig();
    const model    = stats.model    || cfg['current-models']   || 'unknown';
    const provider = stats.provider || cfg['current-provider'] || 'unknown';

    const pColor   = getProviderColor(provider);
    const modelTag = pColor(`[${provider}]`) + ' ' + chalk.yellow(model);

    const used  = stats.totalTokens || stats.used || 0;
    const limit = stats.limit || null;
    const bar   = renderTokenBar(used, limit);
    const right = modelTag + (bar ? '  ' + bar : '');

    const termWidth = process.stdout.columns || 100;
    const col = termWidth - stripAnsi(right).length - 1;

    process.stdout.write(
        `\x1B7` +
        `\x1B[${labelRow};${col}H` +
        right +
        `\x1B8`
    );
}

module.exports = {
    printHeader,
    printUserMessage,
    printAssistantLabel,
    printAssistantChunkEnd,
    printAssistantLabelUpdate,
};