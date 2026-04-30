const fs = require('fs');
const path = require('path');
const CONFIG_PATH = path.join(__dirname, '../config.json');

const VALID_PROVIDERS = ['gemini', 'claude', 'openai'];

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        throw new Error('Config file not found. Please run the setup script first.');
    }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function saveConfig(updates) {
    if (!fs.existsSync(CONFIG_PATH)) {
        throw new Error('Config file not found. Please run the setup script first.');
    }
    const config = { ...loadConfig(), ...updates };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4));
    return config;
}

module.exports = { loadConfig, saveConfig, VALID_PROVIDERS };