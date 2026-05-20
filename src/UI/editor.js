'use strict';

const fs = require('fs');
const chalk = require('chalk');

const ESC = '\x1b';

// ─── terminal helpers ────────────────────────────────────────────────────────
const write = s => process.stdout.write(s);
const moveTo = (r, c) => write(`${ESC}[${r};${c}H`);
const clearLine = () => write(`${ESC}[2K`);
const clearScreen = () => write(`${ESC}[2J${ESC}[H`);
const hideCursor = () => write(`${ESC}[?25l`);
const showCursor = () => write(`${ESC}[?25h`);

// ─── multilineEditor ─────────────────────────────────────────────────────────
/**
 * @param {object}   opts
 * @param {string}   opts.title      – title shown in the header bar
 * @param {string}  [opts.initial]   – initial text content (default '')
 * @param {object}  [opts.rl]        – parent readline interface to pause/resume
 * @param {function}[opts.onSave]    – called with (text) on ^S checkpoint
 * @returns {Promise<string|null>}   – final text, or null if cancelled (^C / ^X)
 */
async function multilineEditor({ title, initial = '', rl: parentRL, onSave } = {}) {
    return new Promise((resolve) => {
        if (parentRL) parentRL.pause();

        // ── State ────────────────────────────────────────────────────────────
        let lines = initial ? initial.split('\n') : [''];
        let curRow = 0;
        let curCol = 0;
        let scrollTop = 0;
        let hScrollOffset = 0;
        let isDirty = false;

        // Undo history — snapshot taken BEFORE each mutation
        const MAX_HISTORY = 500;
        let history = []; // { lines, curRow, curCol }

        function snapshot() {
            history.push({ lines: lines.map(l => l), curRow, curCol });
            if (history.length > MAX_HISTORY) history.shift();
        }

        function undo() {
            if (history.length === 0) return;
            const prev = history.pop();
            lines = prev.lines;
            curRow = prev.curRow;
            curCol = prev.curCol;
            isDirty = history.length > 0;
            recalcHScroll();
        }

        const getSize = () => ({
            rows: process.stdout.rows || 24,
            cols: process.stdout.columns || 80,
        });

        const digitWidth = () => String(lines.length).length;
        const gutterWidth = () => digitWidth() + 4;
        const contentStartCol = () => gutterWidth() + 1;

        function recalcHScroll() {
            const { cols } = getSize();
            const contentCols = Math.max(1, cols - contentStartCol());
            if (curCol < hScrollOffset) {
                hScrollOffset = curCol;
            } else if (curCol >= hScrollOffset + contentCols) {
                hScrollOffset = curCol - contentCols + 1;
            }
        }

        function render() {
            const { rows, cols } = getSize();
            const dw = digitWidth();
            const contentStart = contentStartCol();
            const contentCols = Math.max(1, cols - contentStart);
            const editorRows = rows - 2;

            if (curRow < scrollTop) scrollTop = curRow;
            if (curRow >= scrollTop + editorRows) scrollTop = curRow - editorRows + 1;
            recalcHScroll();

            hideCursor();

            moveTo(1, 1); clearLine();
            const dirtyMark = isDirty ? chalk.bgYellow.black(' ✎ ') : chalk.bgGreen.black(' ✔ ');
            const titleText = ` ✎  ${title}${isDirty ? ' *' : ''} `;
            const titlePad = ' '.repeat(Math.max(0, cols - titleText.length - 3));
            write(chalk.bgHex('#0f4c75').white(titleText + titlePad) + dirtyMark);

            for (let i = 0; i < editorRows; i++) {
                const row = i + 2;
                const lineIdx = scrollTop + i;

                moveTo(row, 1);
                clearLine();

                if (lineIdx >= lines.length) continue;
                const numStr = String(lineIdx + 1).padStart(dw);
                write(chalk.dim(` ${numStr} │ `));

                moveTo(row, contentStart);
                const displayText = lines[lineIdx].slice(hScrollOffset, hScrollOffset + contentCols);
                write(chalk.white(displayText));
            }

            moveTo(rows, 1); clearLine();
            const lineLen = lines[curRow].length;
            const statusText = ` ^S Save  ^W Save & Exit  ^X Exit  ^Z Undo  PgUp/Dn   Ln ${curRow + 1}/${lines.length}  Col ${curCol + 1}  Len ${lineLen} `;
            const statusPad = ' '.repeat(Math.max(0, cols - statusText.length));
            write(chalk.bgHex('#1e2a3a').cyan(statusText + statusPad));

            // cursorCol dihitung dari contentStart + offset horizontal kursor
            const cursorCol = Math.min(
                contentStart + (curCol - hScrollOffset),
                cols,
            );
            moveTo(curRow - scrollTop + 2, cursorCol);
            showCursor();
        }

        function cleanup(saveResult) {
            showCursor();
            clearScreen();
            moveTo(1, 1);
            process.stdin.setRawMode(false);
            process.stdin.removeAllListeners('data');
            process.stdin.pause();
            process.stdout.removeListener('resize', onResize);
            if (parentRL) setImmediate(() => parentRL.resume());
            resolve(saveResult);
        }

        function saveCheckpoint() {
            if (onSave) onSave(lines.join('\n'));
            isDirty = false;
        }

        function onResize() { render(); }

        function applyPaste(text) {
            snapshot();
            const parts = text.split('\n');
            const before = lines[curRow].slice(0, curCol);
            const after = lines[curRow].slice(curCol);

            if (parts.length === 1) {
                lines[curRow] = before + parts[0] + after;
                curCol += parts[0].length;
            } else {
                lines[curRow] = before + parts[0];
                lines.splice(curRow + 1, 0, ...parts.slice(1, -1), parts[parts.length - 1] + after);
                curRow += parts.length - 1;
                curCol = parts[parts.length - 1].length;
            }
            isDirty = true;
            recalcHScroll();
        }

        function wordLeft() {
            if (curCol === 0) {
                if (curRow > 0) { curRow--; curCol = lines[curRow].length; }
                return;
            }
            let c = curCol - 1;
            while (c > 0 && /\W/.test(lines[curRow][c])) c--;
            while (c > 0 && /\w/.test(lines[curRow][c - 1])) c--;
            curCol = c;
        }

        function wordRight() {
            const len = lines[curRow].length;
            if (curCol === len) {
                if (curRow < lines.length - 1) { curRow++; curCol = 0; }
                return;
            }
            let c = curCol;
            while (c < len && /\W/.test(lines[curRow][c])) c++;
            while (c < len && /\w/.test(lines[curRow][c])) c++;
            curCol = c;
        }

        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        process.stdin.on('data', key => {
            hideCursor();

            // Exit
            if (key === '\x03' || key === '\x18') { cleanup(null); return; }
            // ^S — checkpoint
            if (key === '\x13') { saveCheckpoint(); render(); return; }
            // ^W — save & exit
            if (key === '\x17') { cleanup(lines.join('\n')); return; }
            // ^Z — undo
            if (key === '\x1a') { undo(); render(); return; }

            // Arrows
            if (key === `${ESC}[A`) { if (curRow > 0) { curRow--; curCol = Math.min(curCol, lines[curRow].length); } recalcHScroll(); render(); return; }
            if (key === `${ESC}[B`) { if (curRow < lines.length - 1) { curRow++; curCol = Math.min(curCol, lines[curRow].length); } recalcHScroll(); render(); return; }
            if (key === `${ESC}[C`) { if (curCol < lines[curRow].length) curCol++; else if (curRow < lines.length - 1) { curRow++; curCol = 0; hScrollOffset = 0; } recalcHScroll(); render(); return; }
            if (key === `${ESC}[D`) { if (curCol > 0) curCol--; else if (curRow > 0) { curRow--; curCol = lines[curRow].length; } recalcHScroll(); render(); return; }

            // Ctrl+Arrow word jump
            if (key === `${ESC}[1;5C` || key === `${ESC}f`) { wordRight(); recalcHScroll(); render(); return; }
            if (key === `${ESC}[1;5D` || key === `${ESC}b`) { wordLeft(); recalcHScroll(); render(); return; }

            // Home / End
            if (key === `${ESC}[H` || key === '\x01') { curCol = 0; hScrollOffset = 0; render(); return; }
            if (key === `${ESC}[F` || key === '\x05') { curCol = lines[curRow].length; recalcHScroll(); render(); return; }

            // Page Up / Down
            if (key === `${ESC}[5~`) { const { rows } = getSize(); curRow = Math.max(0, curRow - (rows - 3)); curCol = Math.min(curCol, lines[curRow].length); recalcHScroll(); render(); return; }
            if (key === `${ESC}[6~`) { const { rows } = getSize(); curRow = Math.min(lines.length - 1, curRow + (rows - 3)); curCol = Math.min(curCol, lines[curRow].length); recalcHScroll(); render(); return; }

            // Enter
            if (key === '\r' || key === '\n') {
                snapshot();
                const before = lines[curRow].slice(0, curCol);
                const after = lines[curRow].slice(curCol);
                lines[curRow] = before;
                lines.splice(curRow + 1, 0, after);
                curRow++; curCol = 0; hScrollOffset = 0;
                isDirty = true; render(); return;
            }

            // Backspace
            if (key === '\x7f' || key === '\b') {
                snapshot();
                if (curCol > 0) {
                    lines[curRow] = lines[curRow].slice(0, curCol - 1) + lines[curRow].slice(curCol);
                    curCol--;
                } else if (curRow > 0) {
                    const prevLen = lines[curRow - 1].length;
                    lines[curRow - 1] += lines[curRow];
                    lines.splice(curRow, 1);
                    curRow--; curCol = prevLen;
                    recalcHScroll();
                }
                isDirty = true; render(); return;
            }

            // Delete
            if (key === `${ESC}[3~`) {
                snapshot();
                if (curCol < lines[curRow].length) {
                    lines[curRow] = lines[curRow].slice(0, curCol) + lines[curRow].slice(curCol + 1);
                } else if (curRow < lines.length - 1) {
                    lines[curRow] += lines[curRow + 1];
                    lines.splice(curRow + 1, 1);
                }
                isDirty = true; render(); return;
            }

            // Ignore other escape sequences
            if (key.startsWith(ESC)) { showCursor(); return; }

            // Tab → 4 spaces
            if (key === '\t') {
                snapshot();
                const sp = '    ';
                lines[curRow] = lines[curRow].slice(0, curCol) + sp + lines[curRow].slice(curCol);
                curCol += sp.length;
                isDirty = true; recalcHScroll(); render(); return;
            }

            // Multiline paste
            if (key.includes('\n') && key.length > 1) {
                applyPaste(key.replace(/\r\n/g, '\n').replace(/\r/g, '\n'));
                render(); return;
            }

            // Printable characters
            if (key >= ' ') {
                snapshot();
                lines[curRow] = lines[curRow].slice(0, curCol) + key + lines[curRow].slice(curCol);
                curCol += key.length;
                isDirty = true; recalcHScroll(); render();
            }
        });

        process.stdout.on('resize', onResize);
        clearScreen();
        render();
    });
}

/**
 * Read a file, open the TUI editor, write the result back on save.
 *
 * @param {string}  filePath        – absolute or relative path to the file
 * @param {object} [opts]
 * @param {string} [opts.title]     – override title in the header bar (defaults to basename)
 * @param {object} [opts.rl]        – parent readline interface to pause/resume
 * @returns {Promise<boolean>}      – true if file was saved, false if cancelled
 */
async function openEditor(filePath, { title, rl } = {}) {
    const path = require('path');
    const label = title ?? path.basename(filePath);

    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '', 'utf-8');

    const initial = fs.readFileSync(filePath, 'utf-8');

    const result = await multilineEditor({
        title: label,
        initial,
        rl,
        onSave: (text) => fs.writeFileSync(filePath, text, 'utf-8'),
    });

    if (result === null) return false;

    fs.writeFileSync(filePath, result, 'utf-8');
    return true;
}

module.exports = { multilineEditor, openEditor };