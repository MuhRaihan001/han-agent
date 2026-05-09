const chalk = require('chalk');
const { stripAnsi } = require('./utils');

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

function renderMarkdownLine(line) {
    const termWidth  = process.stdout.columns || 100;
    const innerWidth = termWidth - 4;

    if (/^```/.test(line))                     return { type: 'code-fence', text: line };

    const h3 = line.match(/^###\s+(.*)/);
    if (h3) return { type: 'print', text: chalk.bold.cyan('  ' + h3[1]) };

    const h2 = line.match(/^##\s+(.*)/);
    if (h2) return { type: 'print', text: chalk.bold.cyan(h2[1]) };

    const h1 = line.match(/^#\s+(.*)/);
    if (h1) return { type: 'print', text: chalk.bold.whiteBright.underline(h1[1]) };

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line))  return { type: 'print', text: chalk.dim('─'.repeat(innerWidth)) };

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

module.exports = {
    applyInline,
    renderMarkdownLine,
    StreamPrinter,
};