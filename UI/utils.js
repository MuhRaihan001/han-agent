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

function getProviderColor(provider) {
    return {
        claude: chalk.hex('#d97706'),
        openai: chalk.hex('#10a37f'),
        gemini: chalk.hex('#4285f4'),
    }[(provider || '').toLowerCase()] || chalk.white;
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
    loadConfig,
    stripAnsi,
    formatNumber,
    wrapText,
    getProviderColor,
    printDivider,
    getPromptPrefix,
    printError,
};