const chalk = require('chalk');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { showSelect } = require('../UI/select');
const { stripAnsi } = require('../UI/utils');
const { invalidateCache } = require('./utils/load-skills');
const { loadConfig, saveConfig } = require('./utils/config');

const SKILLS_DIR = path.join(__dirname, '../../skills');

function ensureSkillsDir() {
    if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });
}

function skillPath(name) {
    const safe = name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
    return path.join(SKILLS_DIR, `${safe}.md`);
}

function listSkills() {
    ensureSkillsDir();
    return fs.readdirSync(SKILLS_DIR)
        .filter(f => f.endsWith('.md'))
        .map(f => ({
            filename: f,
            name: f.replace(/\.md$/, ''),
            fullPath: path.join(SKILLS_DIR, f),
        }));
}

function readSkill(fullPath) {
    try { return fs.readFileSync(fullPath, 'utf-8'); }
    catch { return ''; }
}

function saveSkill(fullPath, content) {
    fs.writeFileSync(fullPath, content, 'utf-8');
}

function getActiveSkills() {
    const cfg = loadConfig();
    return Array.isArray(cfg['active-skills']) ? cfg['active-skills'] : [];
}

function setActiveSkills(list) {
    saveConfig({ 'active-skills': list });
    invalidateCache();
}

function isActive(name) {
    return getActiveSkills().includes(name);
}

function toggleSkill(name) {
    const active = getActiveSkills();
    const next = active.includes(name)
        ? active.filter(n => n !== name)
        : [...active, name];
    setActiveSkills(next);
    return next.includes(name);
}

const dim = s => chalk.dim(s);
const W = () => Math.min((process.stdout.columns || 100) - 2, 80);

function box(lines, { title = '', color = chalk.cyan } = {}) {
    const w = W();
    const inner = w - 2;
    const pad = s => {
        const v = stripAnsi(s).length;
        return s + ' '.repeat(Math.max(0, inner - v));
    };
    const hr = (l, r) => color(l + '─'.repeat(w - 2) + r);
    const row = s => color('│') + ' ' + pad(s) + color('│');
    const sep = () => color('├' + '─'.repeat(w - 2) + '┤');

    const out = [hr('╭', '╮')];
    if (title) {
        const badge = chalk.bgCyan.black(` ${title} `);
        const titlePad = ' '.repeat(Math.max(0, w - 2 - stripAnsi(badge).length));
        out.push(color('│') + badge + titlePad + color('│'));
        out.push(sep());
    }
    out.push(row(''));
    lines.forEach(l => out.push(row(l)));
    out.push(row(''));
    out.push(hr('╰', '╯'));
    return out.join('\n');
}

function printBox(lines, opts) { console.log(box(lines, opts)); }
function printSuccess(msg) { console.log('\n' + chalk.bgGreen.black(' ✔ OK ') + '  ' + chalk.green(msg) + '\n'); }
function printError(msg) { console.log('\n' + chalk.bgRed.white(' ✖ ERR ') + '  ' + chalk.red(msg) + '\n'); }
function printInfo(msg) { console.log('\n' + chalk.bgHex('#0f4c75').white(' ℹ ') + '  ' + chalk.white(msg) + '\n'); }

function makeRL() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
    });
}

function ask(rl, question) {
    return new Promise(res => rl.question(question, ans => res(ans.trim())));
}

async function multilineEditor({ title, initial = '', rl: parentRL }) {
    return new Promise((resolve) => {
        if (parentRL) parentRL.pause();

        const ESC = '\x1b';
        const write = s => process.stdout.write(s);
        const moveTo = (r, c) => write(`${ESC}[${r};${c}H`);
        const clearLine = () => write(`${ESC}[2K`);
        const clearScreen = () => write(`${ESC}[2J${ESC}[H`);
        const hideCursor = () => write(`${ESC}[?25l`);
        const showCursor = () => write(`${ESC}[?25h`);

        let lines = initial ? initial.split('\n') : [''];
        let curRow = 0;
        let curCol = 0;
        let scrollTop = 0;
        let hScrollOffset = 0;

        function getSize() {
            return { rows: process.stdout.rows || 24, cols: process.stdout.columns || 80 };
        }

        function gutterWidth() { return String(lines.length).length + 2; }

        function contentStartCol() { return gutterWidth() + 2; }

        function render() {
            const { rows, cols } = getSize();
            const gutter = gutterWidth();
            const contentStart = contentStartCol(); // 1-based terminal col where text begins
            const contentCols = cols - contentStart; // visible text columns

            const editorRows = rows - 2;

            if (curRow < scrollTop) scrollTop = curRow;
            if (curRow >= scrollTop + editorRows) scrollTop = curRow - editorRows + 1;

            // Recalculate hScrollOffset so cursor is always visible.
            if (curCol < hScrollOffset) {
                hScrollOffset = curCol;
            } else if (curCol >= hScrollOffset + contentCols) {
                hScrollOffset = curCol - contentCols + 1;
            }

            hideCursor();
            moveTo(1, 1); clearLine();
            const modMark = chalk.bgGreen.black(' ✔ ');
            const titleText = ` ✎  ${title} `;
            const titlePad = ' '.repeat(Math.max(0, cols - titleText.length - 3));
            write(chalk.bgHex('#0f4c75').white(titleText + titlePad) + modMark);

            for (let i = 0; i < editorRows; i++) {
                moveTo(i + 2, 1); clearLine();
                const lineIdx = scrollTop + i;
                if (lineIdx >= lines.length) continue;
                const num = chalk.dim(String(lineIdx + 1).padStart(gutter - 2) + ' │') + ' ';
                // Slice text according to hScrollOffset only for the current row so
                // other rows always show from col 0 (they aren't scrolled horizontally).
                const rawLine = lines[lineIdx];
                const displayText = (curRow === lineIdx)
                    ? rawLine.slice(hScrollOffset, hScrollOffset + contentCols)
                    : rawLine.slice(0, contentCols);
                write(num + chalk.white(displayText));
            }

            moveTo(rows, 1); clearLine();
            const statusText = ` ^S Save  ^W Save & Exit  ^X Exit   Ln ${curRow + 1}/${lines.length}  Col ${curCol + 1} `;
            const statusPad = ' '.repeat(Math.max(0, cols - statusText.length));
            write(chalk.bgHex('#1e2a3a').cyan(statusText + statusPad));

            // Cursor column: contentStart (1-based) + (curCol - hScrollOffset)
            const displayCol = contentStart + (curCol - hScrollOffset);
            const displayRow = curRow - scrollTop + 2;
            moveTo(displayRow, displayCol);
            showCursor();
        }

        function cleanup(saveResult) {
            showCursor();
            clearScreen();
            moveTo(1, 1);
            process.stdin.setRawMode(false);
            process.stdin.removeAllListeners('data');
            process.stdin.pause();
            if (parentRL) setImmediate(() => parentRL.resume());
            resolve(saveResult);
        }

        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        clearScreen();
        render();

        process.stdin.on('data', key => {
            if (key === '\x03') { cleanup(null); return; }
            if (key === '\x13') { render(); return; } // ^S: just re-render (save marker)
            if (key === '\x17') { cleanup(lines.join('\n')); return; } // ^W: save & exit
            if (key === '\x18') { cleanup(null); return; } // ^X: exit

            // Arrow keys
            if (key === `${ESC}[A`) {
                if (curRow > 0) { curRow--; curCol = Math.min(curCol, lines[curRow].length); }
                render(); return;
            }
            if (key === `${ESC}[B`) {
                if (curRow < lines.length - 1) { curRow++; curCol = Math.min(curCol, lines[curRow].length); }
                render(); return;
            }
            if (key === `${ESC}[C`) {
                if (curCol < lines[curRow].length) curCol++;
                else if (curRow < lines.length - 1) { curRow++; curCol = 0; }
                render(); return;
            }
            if (key === `${ESC}[D`) {
                if (curCol > 0) curCol--;
                else if (curRow > 0) { curRow--; curCol = lines[curRow].length; }
                render(); return;
            }

            // Home / End
            if (key === `${ESC}[H` || key === '\x01') { curCol = 0; render(); return; }
            if (key === `${ESC}[F` || key === '\x05') { curCol = lines[curRow].length; render(); return; }

            // Enter
            if (key === '\r' || key === '\n') {
                const before = lines[curRow].slice(0, curCol);
                const after = lines[curRow].slice(curCol);
                lines[curRow] = before;
                lines.splice(curRow + 1, 0, after);
                curRow++; curCol = 0;
                // Reset hScroll when moving to new line
                hScrollOffset = 0;
                render(); return;
            }

            // Backspace
            if (key === '\x7f' || key === '\b') {
                if (curCol > 0) {
                    lines[curRow] = lines[curRow].slice(0, curCol - 1) + lines[curRow].slice(curCol);
                    curCol--;
                } else if (curRow > 0) {
                    const prevLen = lines[curRow - 1].length;
                    lines[curRow - 1] += lines[curRow];
                    lines.splice(curRow, 1);
                    curRow--; curCol = prevLen;
                }
                render(); return;
            }

            // Delete
            if (key === `${ESC}[3~`) {
                if (curCol < lines[curRow].length) {
                    lines[curRow] = lines[curRow].slice(0, curCol) + lines[curRow].slice(curCol + 1);
                } else if (curRow < lines.length - 1) {
                    lines[curRow] += lines[curRow + 1];
                    lines.splice(curRow + 1, 1);
                }
                render(); return;
            }

            // Ignore other escape sequences
            if (key.startsWith(ESC)) return;

            // Printable characters
            if (key >= ' ' || key === '\t') {
                lines[curRow] = lines[curRow].slice(0, curCol) + key + lines[curRow].slice(curCol);
                curCol += key.length;
                render();
            }
        });

        process.stdout.on('resize', render);
    });
}


async function actionAdd(rl) {
    printBox(
        [chalk.white('Create a new skill.'), dim('Skills are stored as Markdown files in skills/')],
        { title: 'Add Skill' }
    );

    const name = await ask(rl, chalk.cyan('  Skill name: '));
    if (!name) { printError('Name cannot be empty.'); return; }

    const fp = skillPath(name);
    if (fs.existsSync(fp)) { printError(`Skill "${name}" already exists.`); return; }

    const template = `# ${name}\n\n## Instructions\n\n`;
    rl.pause();
    const content = await multilineEditor({ title: name, initial: template, rl });

    if (content === null) { printInfo('Add cancelled.'); return; }

    ensureSkillsDir();
    saveSkill(fp, content);
    invalidateCache();
    printSuccess(`Skill "${name}" saved → ${fp}`);
}

async function actionEdit(rl, skills) {
    if (skills.length === 0) { printInfo('No skills found.'); return; }

    const choice = await showSelect({
        title: 'Edit Skill',
        message: 'Choose a skill:',
        choices: skills.map(s => s.name),
        rl,
        helpers: { dim },
    });

    if (!choice) { printInfo('Edit cancelled.'); return; }

    const skill = skills[choice.index];
    const current = readSkill(skill.fullPath);

    rl.pause();
    const updated = await multilineEditor({ title: skill.name, initial: current, rl });

    if (updated === null) { printInfo('Edit cancelled.'); return; }

    const backupPath = skill.fullPath + '.bak';
    fs.writeFileSync(backupPath, current, 'utf-8');

    saveSkill(skill.fullPath, updated);
    invalidateCache();
    printSuccess(`Skill "${skill.name}" updated. Backup → ${backupPath}`);
}

async function actionView(rl, skills) {
    if (skills.length === 0) { printInfo('No skills found.'); return; }

    const choice = await showSelect({
        title: 'View Skill',
        message: 'Choose a skill:',
        choices: skills.map(s => s.name),
        rl,
        helpers: { dim },
    });

    if (!choice) return;

    const skill = skills[choice.index];
    const content = readSkill(skill.fullPath);
    const w = W();

    console.log('\n' + chalk.bgHex('#1e2a3a').white(` 📄  ${skill.name} `));
    console.log(chalk.cyan('─'.repeat(w)));

    content.split('\n').forEach((line, i) => {
        const num = chalk.dim(`${String(i + 1).padStart(3)}  `);
        if (/^# /.test(line)) { console.log(num + chalk.bold.whiteBright(line)); return; }
        if (/^## /.test(line)) { console.log(num + chalk.bold.cyan(line)); return; }
        if (/^### /.test(line)) { console.log(num + chalk.cyan(line)); return; }
        if (/^<!--/.test(line)) { console.log(num + chalk.dim(line)); return; }
        if (/^-/.test(line)) { console.log(num + chalk.white('  • ' + line.slice(1).trim())); return; }
        console.log(num + chalk.white(line));
    });

    console.log(chalk.cyan('─'.repeat(w)) + '\n');
}

async function actionDelete(rl, skills) {
    if (skills.length === 0) { printInfo('No skills found.'); return; }

    const choice = await showSelect({
        title: 'Delete Skill',
        message: 'Choose a skill:',
        choices: skills.map(s => s.name),
        rl,
        helpers: { dim },
    });

    if (!choice) { printInfo('Delete cancelled.'); return; }

    const skill = skills[choice.index];

    const confirm = await showSelect({
        title: '⚠  Confirm',
        message: `Delete "${skill.name}"?`,
        choices: ['Yes, delete', 'No, cancel'],
        rl,
        helpers: { dim },
    });

    if (!confirm || confirm.index !== 0) { printInfo('Delete cancelled.'); return; }

    const active = getActiveSkills().filter(n => n !== skill.name);
    setActiveSkills(active);

    fs.unlinkSync(skill.fullPath);
    invalidateCache();
    printSuccess(`Skill "${skill.name}" deleted.`);
}

function actionList(skills) {
    if (skills.length === 0) {
        printBox([dim('No skills found. Add one to get started.')], { title: 'Skills' });
        return;
    }

    const active = getActiveSkills();
    const rows = skills.map((s, i) => {
        const content = readSkill(s.fullPath);
        const lines = content.split('\n').length;
        const size = content.length;
        const badge = active.includes(s.name)
            ? chalk.green('✔ on ')
            : chalk.dim('○ off');
        return `  ${chalk.dim(`${String(i + 1).padStart(2)}.`)} [${badge}${chalk.dim(']')} ${chalk.bold.white(s.name)}${dim(` — ${lines} lines, ${size} chars`)}`;
    });

    printBox(rows, { title: `Skills (${skills.length})` });
}

async function actionToggle(rl, skills) {
    if (skills.length === 0) { printInfo('No skills found.'); return; }

    while (true) {
        const active = getActiveSkills();

        const choices = [
            ...skills.map(s => {
                const on = active.includes(s.name);
                const badge = on ? chalk.green('✔ enabled ') : chalk.dim('○ disabled');
                return `[${badge}${chalk.dim(']')}  ${chalk.white(s.name)}`;
            }),
            '← Done',
        ];

        const choice = await showSelect({
            title: '🔧  Enable / Disable Skills',
            message: 'Pick a skill to toggle, then press Enter. Select "← Done" when finished.',
            choices,
            rl,
            helpers: { dim },
        });

        if (!choice || choice.value === '← Done') break;

        const skill = skills[choice.index];
        const nowActive = toggleSkill(skill.name);

        printSuccess(
            `"${skill.name}" is now ${nowActive ? chalk.green('enabled') : chalk.red('disabled')}.`
        );
    }
}


async function skillManager() {
    const rl = makeRL();
    const w = W();

    console.log('\n' + chalk.cyan('╭' + '─'.repeat(w - 2) + '╮'));
    console.log(
        chalk.cyan('│') +
        chalk.bgHex('#0f4c75').white('  ✦  Skill Manager  ✦  ') +
        dim('  Manage your AI skill files') +
        ' '.repeat(Math.max(0, w - 2 - 22 - 28)) +
        chalk.cyan('│')
    );
    console.log(chalk.cyan('╰' + '─'.repeat(w - 2) + '╯') + '\n');

    while (true) {
        const skills = listSkills();
        const active = getActiveSkills();
        const activeCount = skills.filter(s => active.includes(s.name)).length;

        const choice = await showSelect({
            title: 'Skill Manager',
            message: 'What do you want to do?',
            choices: [
                `🔧  Enable / Disable skills${chalk.dim(` (${activeCount}/${skills.length} active)`)}`,
                'Add skill',
                `Edit skill${skills.length > 0 ? chalk.dim(` (${skills.length} available)`) : ''}`,
                'View skill',
                'List skills',
                'Delete skill',
                'Back to main menu',
            ],
            rl,
            helpers: { dim },
        });

        if (!choice || choice.index === 6) {
            delete require.cache[require.resolve('../index')]; require('../index');
            rl.close(); return;
        }

        switch (choice.index) {
            case 0: await actionToggle(rl, skills); break;
            case 1: await actionAdd(rl); break;
            case 2: await actionEdit(rl, skills); break;
            case 3: await actionView(rl, skills); break;
            case 4: actionList(skills); break;
            case 5: await actionDelete(rl, skills); break;
        }
    }

    rl.close();
}

module.exports = { skillManager };

skillManager().catch(err => {
    console.error(chalk.bgRed.white(' ✖ Unhandled Error ') + '  ' + chalk.red(err.message));
    process.exit(1);
});