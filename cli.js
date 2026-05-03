#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
    console.log('\n  Installing dependencies...\n');
    const result = spawnSync('npm', ['install'], { stdio: 'inherit', shell: true, cwd: __dirname });
    if (result.status !== 0) process.exit(1);
}

require('./index');