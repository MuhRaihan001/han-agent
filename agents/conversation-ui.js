// agents/conversations-ui.js
//
// Interactive "Conversation History" screen.
// Called from index.js; mirrors the same pattern used by agents/skills.js.
//
'use strict';

const readline = require('readline');
const chalk    = require('chalk');
const { showSelect }          = require('../UI/select');
const { stripAnsi }           = require('../UI/utils');
const { conversationManager, loadConversation, newConversation } = require('./response');

const dim  = s => chalk.dim(s);
const bold = s => chalk.bold(s);
const W    = () => Math.min((process.stdout.columns || 100) - 2, 80);

// ── Box helpers (same style as skills.js) ────────────────────────────────────

function box(lines, { title = '', color = chalk.cyan } = {}) {
    const w     = W();
    const inner = w - 2;
    const pad   = s => { const v = stripAnsi(s).length; return s + ' '.repeat(Math.max(0, inner - v)); };
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

function printBox(lines, opts) { console.log(box(lines, opts)); }
function printSuccess(msg) { console.log('\n' + chalk.bgGreen.black(' ✔ OK ') + '  ' + chalk.green(msg) + '\n'); }
function printError(msg)   { console.log('\n' + chalk.bgRed.white(' ✖ ERR ') + '  ' + chalk.red(msg) + '\n'); }
function printInfo(msg)    { console.log('\n' + chalk.bgHex('#0f4c75').white(' ℹ ') + '  ' + chalk.white(msg) + '\n'); }

// ── Date formatting ───────────────────────────────────────────────────────────

function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const date = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return `${date}  ${time}`;
}

function pause(rl) {
    return new Promise(resolve => {
        process.stdout.write(dim('  Press Enter to continue…'));
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        rl.resume();
        rl.once('line', () => resolve());
    });
}

function askInput(rl, question) {
    return new Promise(resolve => {
        process.stdout.write(chalk.cyan('  ❯ ') + chalk.white(question + ' '));
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        rl.resume();
        rl.once('line', ans => {
            rl.pause();
            resolve(ans.trim());
        });
    });
}

// ── Actions ───────────────────────────────────────────────────────────────────

/** Show a paginated list of all saved conversations. */
function actionList() {
    const convs = conversationManager.listConversations();

    if (convs.length === 0) {
        printBox([dim('No saved conversations yet.')], { title: 'History' });
        return;
    }

    const rows = convs.map((c, i) => {
        const num   = chalk.dim(`${String(i + 1).padStart(3)}.`);
        const title = chalk.bold.white(c.title.slice(0, 38).padEnd(38));
        const msgs  = dim(`${String(c.messageCount).padStart(3)} msgs`);
        const date  = dim(fmtDate(c.updatedAt));
        return `  ${num} ${title}  ${msgs}  ${date}`;
    });

    printBox(rows, { title: `Saved Conversations (${convs.length})` });
}

/** Let the user pick a conversation to load into the active session. */
async function actionLoad(rl, userId) {
    const convs = conversationManager.listConversations();

    if (convs.length === 0) {
        printInfo('No saved conversations to load.');
        return false;
    }

    const choices = [
        ...convs.map(c => {
            const title = c.title.slice(0, 42);
            const date  = fmtDate(c.updatedAt);
            const msgs  = `${c.messageCount} msgs`;
            return `${title}  ${dim(msgs)}  ${dim(date)}`;
        }),
        '← Back',
    ];

    const choice = await showSelect({
        rl,
        title: '📂  Load Conversation',
        message: 'Select a conversation to continue:',
        choices,
        helpers: { dim, bold },
    });

    if (!choice || choice.value === '← Back') return false;

    const conv = convs[choice.index];
    const loaded = loadConversation(userId, conv.id);

    if (!loaded) {
        printError(`Could not load conversation "${conv.id}".`);
        return false;
    }

    printSuccess(
        `Loaded "${loaded.title}" — ${loaded.messageCount} messages restored.`
    );
    await pause(rl);
    return true;   // signal to caller that we should jump straight to chat
}

/** Delete one or more conversations. */
async function actionDelete(rl) {
    const convs = conversationManager.listConversations();

    if (convs.length === 0) {
        printInfo('No conversations to delete.');
        return;
    }

    const choices = [
        ...convs.map(c => `${c.title.slice(0, 45)}  ${dim(fmtDate(c.updatedAt))}`),
        '← Back',
    ];

    const choice = await showSelect({
        rl,
        title: '🗑  Delete Conversation',
        message: 'Choose a conversation to delete:',
        choices,
        helpers: { dim, bold },
    });

    if (!choice || choice.value === '← Back') return;

    const conv = convs[choice.index];

    const confirm = await showSelect({
        rl,
        title: '⚠  Confirm Delete',
        message: `Delete "${conv.title}"?  This cannot be undone.`,
        choices: ['✖  Yes, delete it', '← No, go back'],
        helpers: { dim, bold },
    });

    if (!confirm || confirm.index !== 0) {
        printInfo('Delete cancelled.');
        return;
    }

    conversationManager.deleteConversation(conv.id);
    printSuccess(`"${conv.title}" deleted.`);
}

/** Rename a conversation. */
async function actionRename(rl) {
    const convs = conversationManager.listConversations();

    if (convs.length === 0) {
        printInfo('No conversations to rename.');
        return;
    }

    const choices = [
        ...convs.map(c => `${c.title.slice(0, 45)}  ${dim(fmtDate(c.updatedAt))}`),
        '← Back',
    ];

    const choice = await showSelect({
        rl,
        title: '✏  Rename Conversation',
        message: 'Choose a conversation to rename:',
        choices,
        helpers: { dim, bold },
    });

    if (!choice || choice.value === '← Back') return;

    const conv = convs[choice.index];

    const newTitle = await askInput(rl, `New title (current: "${conv.title.slice(0, 40)}"):`);
    if (!newTitle) {
        printInfo('Rename cancelled.');
        return;
    }

    conversationManager.renameConversation(conv.id, newTitle);
    printSuccess(`Renamed to "${newTitle}".`);
}

/** Start a completely fresh conversation (clears current history). */
async function actionNew(rl, userId) {
    const confirm = await showSelect({
        rl,
        title: '✦  New Conversation',
        message: 'Starting fresh will clear the current in-memory session.\nYour last conversation was already auto-saved.',
        choices: ['✔  Yes, start fresh', '← Cancel'],
        helpers: { dim, bold },
    });

    if (!confirm || confirm.index !== 0) return false;

    newConversation(userId);
    printSuccess('Started a new conversation. History cleared.');
    await pause(rl);
    return true;
}

// ── Main conversation manager loop ───────────────────────────────────────────

const USER_ID = 'default-user';

async function conversationBrowser() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const w  = W();

    console.log('\n' + chalk.cyan('╭' + '─'.repeat(w - 2) + '╮'));
    console.log(
        chalk.cyan('│') +
        chalk.bgHex('#0f4c75').white('  💬  Conversation History  ') +
        dim('  Browse, load, or manage saved chats') +
        ' '.repeat(Math.max(0, w - 2 - 28 - 36)) +
        chalk.cyan('│')
    );
    console.log(chalk.cyan('╰' + '─'.repeat(w - 2) + '╯') + '\n');

    while (true) {
        const count = conversationManager.listConversations().length;

        const choice = await showSelect({
            rl,
            title: '💬  Conversation History',
            message: 'What would you like to do?',
            choices: [
                `📂  Load conversation${count > 0 ? dim(` (${count} saved)`) : ''}`,
                '✦   Start new conversation',
                `📋  List all conversations`,
                '✏   Rename conversation',
                '🗑   Delete conversation',
                '← Back to main menu',
            ],
            helpers: { dim, bold },
        });

        if (!choice || choice.index === 5) {
            // Back to main menu
            delete require.cache[require.resolve('../index')];
            require('../index');
            rl.close();
            return;
        }

        switch (choice.index) {
            case 0: {
                const loaded = await actionLoad(rl, USER_ID);
                if (loaded) {
                    // User loaded a conversation → jump straight into chat
                    rl.close();
                    require('./response');        // ensure module is warm
                    require('../UI/main');
                    return;
                }
                break;
            }
            case 1: {
                const fresh = await actionNew(rl, USER_ID);
                if (fresh) {
                    rl.close();
                    require('../UI/main');
                    return;
                }
                break;
            }
            case 2: actionList();                       break;
            case 3: await actionRename(rl);             break;
            case 4: await actionDelete(rl);             break;
        }
    }
}

module.exports = { conversationBrowser };

// Allow direct invocation: node agents/conversations-ui.js
if (require.main === module) {
    conversationBrowser().catch(err => {
        console.error(chalk.red('Fatal: ') + err.message);
        process.exit(1);
    });
}