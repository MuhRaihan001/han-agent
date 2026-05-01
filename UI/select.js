const chalk = require('chalk');
const { stripAnsi } = require('./utils');

function showSelect({ title, message, detail, detailBody, choices, rl, helpers = {} }) {
    return new Promise((resolve) => {
        const dim = helpers.dim || (s => chalk.dim(s));

        if (rl) rl.pause();

        // Matikan raw mode dulu sebelum masuk, baru aktifkan
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
        process.stdin.pause();

        // Tunda sedikit agar buffer input sebelumnya bersih
        setImmediate(() => {
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(true);
            }
            process.stdin.resume();
            process.stdin.on('data', onKey);
            render();
        });

        let selectedIndex = 0;

        const termWidth = process.stdout.columns || 100;
        const BOX_WIDTH = Math.min(termWidth - 4, 80);
        const HAS_DETAIL = !!detail;

        const LEFT_WIDTH = HAS_DETAIL ? Math.floor(BOX_WIDTH * 0.55) : BOX_WIDTH - 2;
        const RIGHT_WIDTH = HAS_DETAIL ? BOX_WIDTH - LEFT_WIDTH - 3 : 0;

        const BORDER_TOP = chalk.cyan('╭' + '─'.repeat(BOX_WIDTH) + '╮');
        const BORDER_BOTTOM = chalk.cyan('╰' + '─'.repeat(BOX_WIDTH) + '╯');
        const BORDER_SEP = chalk.cyan('├' + '─'.repeat(BOX_WIDTH) + '┤');

        function padR(str, width) {
            const visible = stripAnsi(str).length;
            return str + ' '.repeat(Math.max(0, width - visible));
        }

        function rowSingle(content) {
            const inner = padR(content, BOX_WIDTH - 1);
            return chalk.cyan('│') + ' ' + inner + chalk.cyan('│');
        }

        function rowDouble(leftContent, rightContent = '') {
            const l = padR(leftContent, LEFT_WIDTH);
            const r = padR(rightContent, RIGHT_WIDTH);
            return chalk.cyan('│') + ' ' + l + chalk.cyan('│') + ' ' + r + ' ' + chalk.cyan('│');
        }

        const row = HAS_DETAIL ? rowDouble : rowSingle;

        function buildLines() {
            const lines = [];

            const titleStr = chalk.bgCyan.black(` ${title} `);
            const titlePad = ' '.repeat(Math.max(0, BOX_WIDTH - stripAnsi(titleStr).length));
            lines.push(chalk.cyan('│') + titleStr + titlePad + chalk.cyan('│'));

            lines.push(BORDER_SEP);
            lines.push(row(''));

            const wrapWidth = HAS_DETAIL ? LEFT_WIDTH : BOX_WIDTH - 4;
            const msgLines = wrapSimple(message, wrapWidth);

            if (HAS_DETAIL) {
                const detailLines = [chalk.bold.white(detail), '', ...wrapSimple(detailBody || '', RIGHT_WIDTH)];
                const rowCount = Math.max(msgLines.length, detailLines.length);
                for (let i = 0; i < rowCount; i++) {
                    const l = i < msgLines.length ? chalk.white(msgLines[i]) : '';
                    const r = i < detailLines.length ? detailLines[i] : '';
                    lines.push(rowDouble(l, r));
                }
            } else {
                msgLines.forEach(l => lines.push(rowSingle(chalk.white(l))));
            }

            lines.push(row(''));
            lines.push(BORDER_SEP);
            lines.push(row(''));

            choices.forEach((c, i) => {
                const isSelected = i === selectedIndex;
                const label = isSelected
                    ? chalk.bgBlue.white(' ' + c + ' ')
                    : chalk.white('  ' + c);
                lines.push(row(label));
            });

            lines.push(row(''));

            const hint = dim(' ↑↓ Navigate   Enter: Select   Esc/q: Cancel ');
            lines.push(row(hint));
            lines.push(row(''));

            return lines;
        }

        let rendered = false;
        let lineCount = 0;

        function render() {
            if (rendered) {
                process.stdout.write(`\x1B[${lineCount}A`);
            }

            const contentLines = buildLines();
            lineCount = contentLines.length + 2;

            const out = [
                BORDER_TOP,
                ...contentLines,
                BORDER_BOTTOM,
            ].join('\n') + '\n';

            process.stdout.write(out);
            rendered = true;
        }

        function done(result) {
            process.stdin.removeListener('data', onKey);

            // Matikan raw mode, bersihkan buffer, baru serahkan ke readline
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(false);
            }
            process.stdin.pause();

            // Gunakan setImmediate agar buffer event loop bersih dulu
            // sebelum readline mengambil alih — ini yang mencegah echo dobel
            setImmediate(() => {
                if (rl) {
                    rl.resume();
                }
                resolve(result);
            });
        }

        function onKey(buf) {
            const key = buf.toString();

            if (key === '\x1B[A' || key === 'k') {
                selectedIndex = (selectedIndex - 1 + choices.length) % choices.length;
                render();
                return;
            }
            if (key === '\x1B[B' || key === 'j') {
                selectedIndex = (selectedIndex + 1) % choices.length;
                render();
                return;
            }
            if (key === '\r' || key === '\n') {
                done({ index: selectedIndex, value: choices[selectedIndex] });
                return;
            }
            if (key === '\x1B' || key === 'q') {
                done(null);
                return;
            }
            const num = parseInt(key, 10);
            if (!isNaN(num) && num >= 1 && num <= choices.length) {
                selectedIndex = num - 1;
                render();
                setTimeout(() => done({ index: selectedIndex, value: choices[selectedIndex] }), 120);
            }
        }
    });
}

function wrapSimple(text, maxWidth) {
    if (!text) return [''];
    const result = [];
    for (const raw of text.split('\n')) {
        if (raw.length <= maxWidth) { result.push(raw); continue; }
        const words = raw.split(' ');
        let line = '';
        for (const w of words) {
            if ((line + (line ? ' ' : '') + w).length > maxWidth) {
                if (line) result.push(line);
                line = w;
            } else {
                line = line ? line + ' ' + w : w;
            }
        }
        if (line) result.push(line);
    }
    return result;
}

module.exports = { showSelect };