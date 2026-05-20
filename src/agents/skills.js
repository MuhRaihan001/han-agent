'use strict';

const chalk = require('chalk');
const readline = require('readline');
const fs   = require('fs');
const path = require('path');

const { showSelect }      = require('../UI/select');
const { stripAnsi }       = require('../UI/utils');
const { openEditor }      = require('../UI/editor');
const { invalidateCache } = require('./utils/load-skills');
const { loadConfig, saveConfig } = require('./utils/config');

const SKILLS_DIR = path.join(__dirname, '../../skills');

// ─── file helpers ─────────────────────────────────────────────────────────────
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

function getActiveSkills() {
    const cfg = loadConfig();
    return Array.isArray(cfg['active-skills']) ? cfg['active-skills'] : [];
}

function setActiveSkills(list) {
    saveConfig({ 'active-skills': list });
    invalidateCache();
}

function toggleSkill(name) {
    const active = getActiveSkills();
    const next   = active.includes(name) ? active.filter(n => n !== name) : [...active, name];
    setActiveSkills(next);
    return next.includes(name);
}

const dim = s => chalk.dim(s);
const W   = () => Math.min((process.stdout.columns || 100) - 2, 80);

function box(lines, { title = '', color = chalk.cyan } = {}) {
    const w     = W();
    const inner = w - 2;
    const pad   = s => s + ' '.repeat(Math.max(0, inner - stripAnsi(s).length));
    const hr    = (l, r) => color(l + '─'.repeat(w - 2) + r);
    const row   = s => color('│') + ' ' + pad(s) + color('│');
    const sep   = () => color('├' + '─'.repeat(w - 2) + '┤');

    const out = [hr('╭', '╮')];
    if (title) {
        const badge    = chalk.bgCyan.black(` ${title} `);
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

function printBox(lines, opts)  { console.log(box(lines, opts)); }
function printSuccess(msg)      { console.log('\n' + chalk.bgGreen.black(' ✔ OK ') + '  ' + chalk.green(msg) + '\n'); }
function printError(msg)        { console.log('\n' + chalk.bgRed.white(' ✖ ERR ') + '  ' + chalk.red(msg) + '\n'); }
function printInfo(msg)         { console.log('\n' + chalk.bgHex('#0f4c75').white(' ℹ ') + '  ' + chalk.white(msg) + '\n'); }

function makeRL() {
    return readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
}

function ask(rl, question) {
    return new Promise(res => rl.question(question, ans => res(ans.trim())));
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

    // Write template so openEditor has a file to read
    ensureSkillsDir();
    fs.writeFileSync(fp, `# ${name}\n\n## Instructions\n\n`, 'utf-8');

    const saved = await openEditor(fp, { title: name, rl });

    if (!saved) {
        fs.unlinkSync(fp);
        printInfo('Add cancelled.');
        return;
    }

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

    const backupPath = skill.fullPath + '.bak';
    fs.writeFileSync(backupPath, readSkill(skill.fullPath), 'utf-8');

    const saved = await openEditor(skill.fullPath, { title: skill.name, rl });

    if (!saved) {
        fs.copyFileSync(backupPath, skill.fullPath);
        printInfo('Edit cancelled — file restored.');
        return;
    }

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

    const content = readSkill(skills[choice.index].fullPath);
    const w       = W();

    console.log('\n' + chalk.bgHex('#1e2a3a').white(` 📄  ${skills[choice.index].name} `));
    console.log(chalk.cyan('─'.repeat(w)));

    content.split('\n').forEach((line, i) => {
        const num = chalk.dim(`${String(i + 1).padStart(3)}  `);
        if (/^# /.test(line))   { console.log(num + chalk.bold.whiteBright(line)); return; }
        if (/^## /.test(line))  { console.log(num + chalk.bold.cyan(line)); return; }
        if (/^### /.test(line)) { console.log(num + chalk.cyan(line)); return; }
        if (/^<!--/.test(line)) { console.log(num + chalk.dim(line)); return; }
        if (/^-/.test(line))    { console.log(num + chalk.white('  • ' + line.slice(1).trim())); return; }
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

    const confirm = await showSelect({
        title: '⚠  Confirm',
        message: `Delete "${skills[choice.index].name}"?`,
        choices: ['Yes, delete', 'No, cancel'],
        rl,
        helpers: { dim },
    });
    if (!confirm || confirm.index !== 0) { printInfo('Delete cancelled.'); return; }

    const skill  = skills[choice.index];
    setActiveSkills(getActiveSkills().filter(n => n !== skill.name));
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
        const badge   = active.includes(s.name) ? chalk.green('✔ on ') : chalk.dim('○ off');
        return `  ${chalk.dim(`${String(i + 1).padStart(2)}.`)} [${badge}${chalk.dim(']')} ${chalk.bold.white(s.name)}${dim(` — ${content.split('\n').length} lines, ${content.length} chars`)}`;
    });
    printBox(rows, { title: `Skills (${skills.length})` });
}

async function actionToggle(rl, skills) {
    if (skills.length === 0) { printInfo('No skills found.'); return; }

    while (true) {
        const active  = getActiveSkills();
        const choices = [
            ...skills.map(s => {
                const on    = active.includes(s.name);
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

        const nowActive = toggleSkill(skills[choice.index].name);
        printSuccess(`"${skills[choice.index].name}" is now ${nowActive ? chalk.green('enabled') : chalk.red('disabled')}.`);
    }
}

async function skillManager() {
    const rl = makeRL();
    const w  = W();

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
        const skills      = listSkills();
        const active      = getActiveSkills();
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
            delete require.cache[require.resolve('../index')];
            require('../index');
            rl.close(); return;
        }

        switch (choice.index) {
            case 0: await actionToggle(rl, skills); break;
            case 1: await actionAdd(rl); break;
            case 2: await actionEdit(rl, listSkills()); break;
            case 3: await actionView(rl, listSkills()); break;
            case 4: actionList(listSkills()); break;
            case 5: await actionDelete(rl, listSkills()); break;
        }
    }

    rl.close();
}

module.exports = { skillManager };

skillManager().catch(err => {
    console.error(chalk.bgRed.white(' ✖ Unhandled Error ') + '  ' + chalk.red(err.message));
    process.exit(1);
});