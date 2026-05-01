#!/usr/bin/env node
const path = require('path');
const fs = require('fs/promises');

const PATHS = {
    config: path.join(__dirname, 'agents/config.json'),
    env: path.join(__dirname, '.env'),
    skills: path.join(__dirname, 'agents/skills'),
};

const DEFAULT_CONFIG = {
    'current-models': '',
    'current-provider': '',
    'gemini-api-key': '',
    'claude-api-key': '',
    'openai-api-key': '',
    'steam': true,
    'sandbox': false
};

const DEFAULT_ENV = `
    DATABASE_HOST=
    DATABASE_USER=
    DATABASE_PASSWORD=
    DATABASE_NAME=
`.replace(/^[ \t]+/gm, '').trim();

async function touchFile(filePath, content, successMessage) {
    try {
        await fs.access(filePath);
    } catch {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');
        console.log(`✔️ ${successMessage}`);
    }
}

async function touchDir(dirPath, successMessage) {
    try {
        await fs.access(dirPath);
    } catch {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`✔️ ${successMessage}`);
    }
}

async function setup() {
    await touchFile(
        PATHS.config,
        JSON.stringify(DEFAULT_CONFIG, null, 2),
        'Created default config.json. Please update it with your API keys and preferences.'
    );

    await touchFile(
        PATHS.env,
        DEFAULT_ENV,
        'Created .env file. Please update it with your Discord bot token and database credentials.'
    );

    await touchDir(
        PATHS.skills,
        'Created skills folder. Add your .md skill files here.'
    );

    console.log('✔️ Setup complete. You can now run the agents with "npm start" or "start-ryux".');
}

setup();