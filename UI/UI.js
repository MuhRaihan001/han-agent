const chalk = require('chalk');
const fs    = require('fs');
const path  = require('path');

const configPath = path.join(__dirname, '../agents/config.json');

function loadConfig() {
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
        return { 'current-models': 'unknown', 'current-provider': 'unknown' };
    }
}

const stripAnsi = s => s.replace(/\x1B\[[0-9;]*m/g, '');

function formatNumber(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1)     + 'k';
    return String(n);
}

function wrapText(text, maxWidth) {
    const lines = [];
    for (const rawLine of text.split('\n')) {
        if (rawLine.length <= maxWidth) {
            lines.push(rawLine);
            continue;
        }
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

function renderTokenBar(used, limit, barWidth = 16) {
    if (!limit || used === 0) return '';

    const ratio  = Math.min(used / limit, 1);
    const filled = Math.round(ratio * barWidth);
    const empty  = barWidth - filled;
    const pct    = Math.round(ratio * 100);

    const barColor = ratio < 0.6  ? chalk.green
                   : ratio < 0.85 ? chalk.yellow
                   : chalk.red;

    const bar   = barColor('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
    const label = barColor(`${formatNumber(used)}/${formatNumber(limit)} (${pct}%)`);

    return `${bar} ${label}`;
}

function getProviderColor(provider) {
    return {
        claude: chalk.hex('#d97706'),
        openai: chalk.hex('#10a37f'),
        gemini: chalk.hex('#4285f4'),
    }[(provider || '').toLowerCase()] || chalk.white;
}

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
    const cfg      = loadConfig();
    const model    = stats.model    || cfg['current-models']   || 'unknown';
    const provider = stats.provider || cfg['current-provider'] || 'unknown';

    const badge   = chalk.bgHex('#0f4c75').white(' Assistant ');
    const time    = dim(new Date().toLocaleTimeString());
    const left    = badge + '  ' + time;

    const pColor   = getProviderColor(provider);
    const modelTag = pColor(`[${provider}]`) + ' ' + chalk.yellow(model);

    const used  = stats.totalTokens || stats.used || 0;
    const limit = stats.limit       || null;
    const bar   = renderTokenBar(used, limit);
    const right = modelTag + (bar ? '  ' + bar : '');

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

function renderMarkdownLine(line) {
    const termWidth  = process.stdout.columns || 100;
    const innerWidth = termWidth - 4;

    if (/^```/.test(line))                    return { type: 'code-fence', text: line };

    const h3 = line.match(/^###\s+(.*)/);
    if (h3) return { type: 'print', text: chalk.bold.cyan('  ' + h3[1]) };

    const h2 = line.match(/^##\s+(.*)/);
    if (h2) return { type: 'print', text: chalk.bold.cyan(h2[1]) };

    const h1 = line.match(/^#\s+(.*)/);
    if (h1) return { type: 'print', text: chalk.bold.whiteBright.underline(h1[1]) };

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) return { type: 'print', text: chalk.dim('─'.repeat(innerWidth)) };

    const bq = line.match(/^>\s*(.*)/);
    if (bq) return { type: 'print', text: chalk.dim('▌ ') + chalk.italic.gray(applyInline(bq[1])) };

    const ul = line.match(/^(\s*)[-*+]\s+(.*)/);
    if (ul) {
        const bullet = ul[1].length > 0 ? chalk.dim('  ◦ ') : chalk.cyan('  • ');
        return { type: 'print', text: bullet + applyInline(ul[2]) };
    }

    const ol = line.match(/^(\s*)(\d+)\.\s+(.*)/);
    if (ol) return { type: 'print', text: chalk.cyan(`  ${ol[2]}. `) + applyInline(ol[3]) };

    if (line.trim() === '') return { type: 'print', text: '' };

    return { type: 'print', text: applyInline(line) };
}

function applyInline(text) {
    return text
        .replace(/`([^`]+)`/g,         (_, c) => chalk.bgHex('#2d2d2d').hex('#e6db74')(` ${c} `))
        .replace(/\*\*\*(.+?)\*\*\*/g, (_, c) => chalk.bold.italic.white(c))
        .replace(/\*\*(.+?)\*\*/g,     (_, c) => chalk.bold.white(c))
        .replace(/__(.+?)__/g,          (_, c) => chalk.bold.white(c))
        .replace(/\*(.+?)\*/g,          (_, c) => chalk.italic.white(c))
        .replace(/_(.+?)_/g,            (_, c) => chalk.italic.white(c))
        .replace(/~~(.+?)~~/g,          (_, c) => chalk.strikethrough.dim(c))
        .replace(/\[(.+?)\]\((.+?)\)/g, (_, label, url) => chalk.cyan.underline(label) + chalk.dim(` (${url})`));
}

class StreamPrinter {
    constructor({ dim }) {
        this._dim       = dim;
        this._prefix    = dim('│ ');
        this._max       = (process.stdout.columns || 100) - 4;
        this._buffer    = '';
        this._inCode    = false;
        this._codeLang  = '';
        this._codeLines = [];
        this._firstLine = true;
    }

    _printLine(rendered) {
        if (!this._firstLine) {
            process.stdout.write('\n' + this._prefix);
        }
        this._firstLine = false;

        const words = rendered.split(' ');
        let col     = 0;
        let out     = '';

        for (const word of words) {
            const wLen = stripAnsi(word).length;
            if (col > 0 && col + 1 + wLen > this._max) {
                process.stdout.write(out);
                process.stdout.write('\n' + this._prefix);
                out = word;
                col = wLen;
            } else {
                out += (col > 0 ? ' ' : '') + word;
                col += (col > 0 ? 1 : 0) + wLen;
            }
        }
        if (out) process.stdout.write(out);
    }

    _flushCode() {
        const lang  = this._codeLang || 'code';
        const width = Math.min(this._max, 44);

        process.stdout.write('\n' + this._prefix);
        process.stdout.write(
            chalk.bgHex('#1e1e1e').hex('#888888')(' ' + lang + ' ') +
            chalk.dim('─'.repeat(Math.max(0, width - lang.length - 2)))
        );

        for (const cl of this._codeLines) {
            process.stdout.write('\n' + this._prefix);
            process.stdout.write(chalk.bgHex('#1e1e1e').hex('#e6db74')(cl));
        }

        process.stdout.write('\n' + this._prefix);
        process.stdout.write(chalk.dim('─'.repeat(width)));

        this._codeLines = [];
        this._codeLang  = '';
        this._firstLine = false;
    }

    _processLine(line) {
        if (this._inCode) {
            if (/^```/.test(line)) {
                this._inCode = false;
                this._flushCode();
            } else {
                this._codeLines.push(line);
            }
            return;
        }

        const result = renderMarkdownLine(line);
        if (result.type === 'code-fence') {
            this._inCode   = true;
            this._codeLang = line.replace(/^```/, '').trim();
            return;
        }

        this._printLine(result.text);
    }

    write(chunk) {
        this._buffer += chunk;
        const parts  = this._buffer.split('\n');
        this._buffer = parts.pop();
        for (const line of parts) this._processLine(line);
    }

    flush() {
        if (this._buffer) {
            this._processLine(this._buffer);
            this._buffer = '';
        }
        if (this._inCode && this._codeLines.length) this._flushCode();
    }
}

function printDivider({ dim, line }) {
    console.log(dim(line()));
}

function getPromptPrefix() {
    return chalk.cyan('❯ ');
}

function printError(message) {
    console.log();
    console.log(
        chalk.bgRed.white(' ✖ ERROR ') +
        '  ' +
        chalk.red(message)
    );
    console.log();
}

module.exports = {
    printHeader,
    printUserMessage,
    printAssistantLabel,
    printAssistantChunkEnd,
    printAssistantLabelUpdate,
    printDivider,
    getPromptPrefix,
    printError,
    StreamPrinter,
};