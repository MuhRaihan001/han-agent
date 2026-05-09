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

    const features = [
        { name: 'Shell Execution', desc: 'Run real commands on your machine' },
        { name: 'Skill System', desc: 'Extend via .md files in skills/' },
        { name: 'Multi-Provider AI', desc: 'Claude · Gemini · GPT' },
        { name: 'Smart History', desc: 'Rolling context + summarization' },
        { name: 'NLP → SQL', desc: 'Plain English to MySQL queries' },
        { name: 'Streaming Output', desc: 'Real-time markdown in terminal' },
    ];

    // ── Box dimensions ─────────────────────────────────────────────
    // BOX_W = total inner width (excluding the two │ border chars)
    const BOX_W = Math.min((process.stdout.columns || 100) - 2, 74);
    const HALF = Math.floor(BOX_W / 2);

    // padTo: pads a styled string to `len` VISIBLE characters
    const padTo = (str, len) => {
        const vis = stripAnsi(str).length;
        return str + ' '.repeat(Math.max(0, len - vis));
    };

    // truncTo: truncates to `maxLen` visible chars (strips ANSI safely)
    const truncTo = (str, maxLen) => {
        const plain = stripAnsi(str);
        return plain.length <= maxLen ? str : plain.slice(0, maxLen - 1) + '…';
    };

    // Box drawing helpers — all produce BOX_W + 2 visible chars
    const border = (tl, tr) =>
        chalk.cyan(tl + '─'.repeat(BOX_W) + tr);

    const emptyRow = () =>
        chalk.cyan('│') + ' '.repeat(BOX_W) + chalk.cyan('│');

    //
    const leftW = Math.floor((BOX_W - 3) / 2);
    const rightW = BOX_W - leftW - 3;
    
    const twoCol = (l = '', r = '') =>
        chalk.cyan('│') +
        ' ' + padTo(truncTo(l, leftW), leftW) +
        ' ' + padTo(truncTo(r, rightW), rightW) +
        ' ' + chalk.cyan('│');

    // ── Render box ────────────────────────────────────────────────
    console.log(border('╭', '╮'));
    console.log(emptyRow());

    for (let i = 0; i < features.length; i += 2) {
        const a = features[i];
        const b = features[i + 1];

        // Feature name row
        const nameA = chalk.cyan('◆ ') + chalk.bold.white(a.name);
        const nameB = b ? chalk.cyan('◆ ') + chalk.bold.white(b.name) : '';
        console.log(twoCol(nameA, nameB));

        // Description row
        const descA = dim('  ' + a.desc);
        const descB = b ? dim('  ' + b.desc) : '';
        console.log(twoCol(descA, descB));

        // Spacer between groups (but not after the last one)
        if (i + 2 < features.length) console.log(emptyRow());
    }

    console.log(emptyRow());
    console.log(border('╰', '╯'));
    console.log();

    // ── Title bar ─────────────────────────────────────────────────
    const w = width();
    const title = '  ✦  Assistant powered by LLMs  ✦  ';
    const hint = 'type "exit" to quit  ';
    // Use stripAnsi-based length to handle any non-ASCII chars in title/hint
    const titleLen = stripAnsi(title).length;
    const hintLen = stripAnsi(hint).length;
    const pad = Math.max(0, w - titleLen - hintLen - 2); // -2 for the two │ borders

    console.log(chalk.cyan('╭' + '─'.repeat(w - 2) + '╮'));
    console.log(
        chalk.cyan('│') +
        bold(chalk.white(title)) +
        ' '.repeat(pad) +
        dim(hint) +
        chalk.cyan('│')
    );
    console.log(chalk.cyan('╰' + '─'.repeat(w - 2) + '╯'));
    console.log();
}

function printUserMessage(text, { dim }) {
    const termWidth = process.stdout.columns || 100;
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
    const cfg = loadConfig();
    const model = stats.model || cfg['current-models'] || 'unknown';
    const provider = stats.provider || cfg['current-provider'] || 'unknown';

    const badge = chalk.bgHex('#0f4c75').white(' Assistant ');
    const time = dim(new Date().toLocaleTimeString());
    const left = badge + '  ' + time;

    const pColor = getProviderColor(provider);
    const modelTag = pColor(`[${provider}]`) + ' ' + chalk.yellow(model);
    const right = modelTag;

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

    const cfg = loadConfig();
    const model = stats.model || cfg['current-models'] || 'unknown';
    const provider = stats.provider || cfg['current-provider'] || 'unknown';

    const pColor = getProviderColor(provider);
    const modelTag = pColor(`[${provider}]`) + ' ' + chalk.yellow(model);

    const used = stats.totalTokens || stats.used || 0;
    const limit = stats.limit || null;
    const bar = renderTokenBar(used, limit);
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