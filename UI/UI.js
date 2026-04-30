const chalk = require('chalk');
const ora = require('ora');
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
    const w = width();
    const asciiW = Math.max(...ascii.map(l => l.length));
    const leftPad = ' '.repeat(Math.max(0, Math.floor((w - asciiW) / 2)));

    ascii.forEach(row => console.log(leftPad + chalk.cyan(row)));

    console.log();

    const title = '  ✦  Assistant powered by LLMs  ✦  ';
    const hint = 'type "exit" to quit  ';
    const pad = w - title.length - hint.length;

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
    console.log();
    console.log(chalk.bgHex('#1e1e2e').white(' You ') + '  ' + dim(new Date().toLocaleTimeString()));
    console.log(dim('│'));
    text.split('\n').forEach(l => console.log(dim('│ ') + chalk.white(l)));
    console.log(dim('│'));
}

function printAssistantLabel({ dim }) {
    console.log();
    console.log(chalk.bgHex('#0f4c75').white(' Assistant ') + '  ' + dim(new Date().toLocaleTimeString()));
    console.log(dim('│'));
    process.stdout.write(dim('│ '));
}

function printAssistantChunkEnd({ dim }) {
    console.log();
    console.log(dim('│'));
}

function printDivider({ dim, line }) {
    console.log(dim(line()));
}

module.exports = { printHeader, printUserMessage, printAssistantLabel, printAssistantChunkEnd, printDivider };