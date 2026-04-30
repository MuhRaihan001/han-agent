#!/usr/bin/env node
const readline = require('readline');
const chalk    = require('chalk');
const { showSelect }  = require('../UI/select');
const { loadConfig, getProviderColor, printError } = require('../UI/utils');
const { saveConfig, VALID_PROVIDERS } = require('./utils/config');

const dim  = s => chalk.dim(s);
const bold = s => chalk.bold(s);

const termWidth = () => process.stdout.columns || 100;

function boxTop(w)    { return chalk.cyan('╭' + '─'.repeat(w) + '╮'); }
function boxBottom(w) { return chalk.cyan('╰' + '─'.repeat(w) + '╯'); }
function boxSep(w)    { return chalk.cyan('├' + '─'.repeat(w) + '┤'); }

function padR(str, width) {
    const vis = str.replace(/\x1B\[[0-9;]*m/g, '').length;
    return str + ' '.repeat(Math.max(0, width - vis));
}

function boxRow(content, w) {
    const inner = padR(content, w - 1);
    return chalk.cyan('│') + ' ' + inner + chalk.cyan('│');
}

function printConfigHeader() {
    console.clear();
    const w = Math.min(termWidth() - 4, 80);

    const title    = '  ⚙   Configure Agent';
    const subtitle = '  Set provider, model, and API keys';

    console.log(boxTop(w));
    console.log(boxRow(bold(chalk.white(title)), w));
    console.log(boxRow(dim(subtitle), w));
    console.log(boxBottom(w));
    console.log();
    const cfg      = loadConfig();
    const provider = cfg['current-provider'] || 'not set';
    const model    = cfg['current-models']   || 'not set';
    const pColor   = getProviderColor(provider);

    const colL = Math.floor((w - 3) * 0.45);
    const colR = w - colL - 3;

    function infoRow(label, value) {
        const l = padR(dim(label), colL);
        const r = padR(value,      colR);
        return chalk.cyan('│') + ' ' + l + chalk.cyan('│') + ' ' + r + ' ' + chalk.cyan('│');
    }

    const hdr    = chalk.bgHex('#0f3460').white('  Current Configuration  ');
    const hdrPad = ' '.repeat(Math.max(0, w - hdr.replace(/\x1B\[[0-9;]*m/g,'').length));

    console.log(boxTop(w));
    console.log(chalk.cyan('│') + hdr + hdrPad + chalk.cyan('│'));
    console.log(boxSep(w));

    console.log(infoRow('Provider', pColor(`[${provider}]`)));
    console.log(infoRow('Model',    chalk.yellow(model)));

    for (const p of VALID_PROVIDERS) {
        const key = cfg[`${p}-api-key`] || '';
        const masked = key
            ? chalk.green('✔ ') + dim(key.slice(0, 6) + '••••••••' + key.slice(-4))
            : chalk.red('✖ ') + dim('not set');
        console.log(infoRow(`${p} API key`, masked));
    }

    console.log(boxBottom(w));
    console.log();
}

function askInput(rl, question, { mask = false, validate = null } = {}) {
    return new Promise(resolve => {
        const w     = Math.min(termWidth() - 4, 80);
        const label = chalk.cyan('❯ ') + chalk.white(question + ' ');

        function attempt() {
            process.stdout.write(label);

            if (mask && process.stdin.isTTY) {
                // raw mode for password masking
                process.stdin.setRawMode(true);
                let buf = '';

                function onKey(b) {
                    const ch = b.toString();
                    if (ch === '\r' || ch === '\n') {
                        process.stdin.setRawMode(false);
                        process.stdin.removeListener('data', onKey);
                        process.stdout.write('\n');
                        const val = buf.trim();
                        if (validate) {
                            const err = validate(val);
                            if (err) {
                                printError(err);
                                buf = '';
                                attempt();
                                return;
                            }
                        }
                        resolve(val);
                    } else if (ch === '\x03') {   // Ctrl-C
                        process.stdin.setRawMode(false);
                        process.stdin.removeListener('data', onKey);
                        process.stdout.write('\n');
                        resolve(null);
                    } else if (ch === '\x7F') {   // backspace
                        if (buf.length > 0) {
                            buf = buf.slice(0, -1);
                            process.stdout.write('\b \b');
                        }
                    } else {
                        buf += ch;
                        process.stdout.write('*');
                    }
                }

                process.stdin.on('data', onKey);
            } else {
                rl.resume();
                rl.question('', ans => {
                    const val = ans.trim();
                    if (validate) {
                        const err = validate(val);
                        if (err) {
                            printError(err);
                            attempt();
                            return;
                        }
                    }
                    resolve(val || null);
                });
            }
        }

        attempt();
    });
}


async function pageSetApiKey(rl) {
    printConfigHeader();

    // Step 1 – choose provider
    const providerResult = await showSelect({
        rl,
        title:   '⚙   Set API Key  →  Choose Provider',
        message: 'Which provider\'s API key do you want to set?',
        choices: [
            ...VALID_PROVIDERS.map(p => `${getProviderIcon(p)}  ${p}`),
            '← Back',
        ],
        helpers: { dim, bold },
    });

    if (!providerResult || providerResult.value === '← Back') return;

    const provider = VALID_PROVIDERS[providerResult.index];

    printConfigHeader();
    console.log(chalk.cyan('┌─') + ' ' + bold(chalk.white(`Set API key for ${chalk.hex(providerHex(provider))(provider)}`)));
    console.log(chalk.cyan('│'));
    console.log(chalk.cyan('│') + '  ' + dim('Paste your API key below. Input will be masked.'));
    console.log(chalk.cyan('│') + '  ' + dim('Leave blank to keep the current value.'));
    console.log(chalk.cyan('│'));

    const cfg = loadConfig();
    const current = cfg[`${provider}-api-key`] || '';
    if (current) {
        console.log(chalk.cyan('│') + '  ' + dim('Current: ') + dim(current.slice(0, 6) + '••••' + current.slice(-4)));
        console.log(chalk.cyan('│'));
    }

    const apiKey = await askInput(rl, `${provider} API key:`, {
        mask: true,
        validate: val => {
            if (!val && !current) return `API key for "${provider}" cannot be empty.`;
            return null;
        },
    });

    if (apiKey === null) {
        console.log('\n' + dim('Cancelled.'));
        return;
    }

    if (apiKey) {
        saveConfig({ [`${provider}-api-key`]: apiKey });
        console.log('\n' + chalk.green('✔  API key saved for ') + chalk.hex(providerHex(provider))(provider) + '\n');
    } else {
        console.log('\n' + dim('No change — key kept as-is.\n'));
    }

    await pause(rl);
}

async function pageChooseProvider(rl) {
    printConfigHeader();

    const result = await showSelect({
        rl,
        title:   '⚙   Choose Active Provider',
        message: 'Select the provider you want to use:',
        detail:       'About providers',
        detailBody:   'Claude → Anthropic\nGemini → Google\nOpenAI → OpenAI\n\nMake sure the API key\nfor the selected provider\nis already set.',
        choices: [
            ...VALID_PROVIDERS.map(p => `${getProviderIcon(p)}  ${p}`),
            '← Back',
        ],
        helpers: { dim, bold },
    });

    if (!result || result.value === '← Back') return;

    const provider = VALID_PROVIDERS[result.index];
    const cfg      = loadConfig();
    const key      = cfg[`${provider}-api-key`];

    if (!key) {
        printConfigHeader();
        console.log(chalk.yellow('⚠  Warning: ') + `No API key set for "${provider}".`);
        console.log(dim('   You can still set the provider, but set the API key before using it.\n'));
    }

    saveConfig({ 'current-provider': provider });
    console.log('\n' + chalk.green('✔  Active provider set to ') + chalk.hex(providerHex(provider))(provider) + '\n');

    await pause(rl);
}

async function pageSetModel(rl) {
    printConfigHeader();
    const cfg      = loadConfig();
    const provider = (cfg['current-provider'] || '').toLowerCase();

    const suggestions = {
        claude: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
        gemini: ['gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
        openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
    };

    const modelList = suggestions[provider] || [];

    if (modelList.length > 0) {
        const result = await showSelect({
            rl,
            title:   '⚙   Set Model',
            message: `Choose a preset model for ${provider}, or pick "Custom" to type your own:`,
            choices: [
                ...modelList,
                '✏  Custom model name…',
                '← Back',
            ],
            helpers: { dim, bold },
        });

        if (!result || result.value === '← Back') return;

        if (!result.value.startsWith('✏')) {
            saveConfig({ 'current-models': result.value.trim() });
            console.log('\n' + chalk.green('✔  Model set to ') + chalk.yellow(result.value.trim()) + '\n');
            await pause(rl);
            return;
        }
    }

    printConfigHeader();
    console.log(chalk.cyan('┌─') + ' ' + bold(chalk.white('Enter custom model name')));
    console.log(chalk.cyan('│'));
    const current = cfg['current-models'];
    if (current) {
        console.log(chalk.cyan('│') + '  ' + dim('Current model: ') + chalk.yellow(current));
        console.log(chalk.cyan('│'));
    }
    console.log(chalk.cyan('│') + '  ' + dim('Example: claude-3-7-sonnet-20250219, gpt-4-turbo, gemini-ultra'));
    console.log(chalk.cyan('│'));

    const modelName = await askInput(rl, 'Model name:', {
        validate: val => {
            if (!val) return 'Model name cannot be empty.';
            if (val.length < 3) return 'Model name too short.';
            return null;
        },
    });

    if (!modelName) {
        console.log('\n' + dim('Cancelled.'));
        return;
    }

    saveConfig({ 'current-models': modelName });
    console.log('\n' + chalk.green('✔  Model set to ') + chalk.yellow(modelName) + '\n');

    await pause(rl);
}

async function pageResetConfig(rl) {
    printConfigHeader();

    const result = await showSelect({
        rl,
        title:   '⚠   Reset Configuration',
        message: 'This will clear all API keys, provider, and model settings.\n\nAre you sure?',
        choices: [
            '✖  Yes, reset everything',
            '← No, go back',
        ],
        helpers: { dim, bold },
    });

    if (!result || result.value.startsWith('←')) return;

    saveConfig({
        'current-models':   '',
        'current-provider': '',
        'gemini-api-key':   '',
        'claude-api-key':   '',
        'openai-api-key':   '',
        'stream':           false,
    });

    console.log('\n' + chalk.red('✔  Configuration reset.\n'));
    await pause(rl);
}

async function main() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    while (true) {
        printConfigHeader();

        const result = await showSelect({
            rl,
            title:   '⚙   Configure Agent',
            message: 'What would you like to configure?',
            choices: [
                '🔑  Set API key',
                '🌐  Choose active provider',
                '🤖  Set model name',
                '↩   Reset all settings',
                '← Back to main menu',
            ],
            helpers: { dim, bold },
        });

        if (!result) break;

        const choice = result.value;

        if (choice.includes('Set API key')) {
            await pageSetApiKey(rl);
        } else if (choice.includes('provider')) {
            await pageChooseProvider(rl);
        } else if (choice.includes('model')) {
            await pageSetModel(rl);
        } else if (choice.includes('Reset')) {
            await pageResetConfig(rl);
        } else {
            break; // Back
        }
    }

    rl.close();

    require('../cli');
}

function pause(rl) {
    return new Promise(resolve => {
        process.stdout.write(dim('  Press Enter to continue…'));
        rl.resume();
        rl.once('line', () => resolve());
    });
}

function getProviderIcon(provider) {
    return { claude: '🟠', gemini: '🔵', openai: '🟢' }[provider] || '⚪';
}

function providerHex(provider) {
    return { claude: '#d97706', openai: '#10a37f', gemini: '#4285f4' }[provider] || '#ffffff';
}

main().catch(err => {
    console.error(chalk.red('Fatal error: ') + err.message);
    process.exit(1);
});