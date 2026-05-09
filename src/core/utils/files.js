const fs = require('fs');
const path = require('path');

function getFiles(dir) {
    if (!fs.existsSync(dir)) return [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...getFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }

    return files;
}

function readFile(filePath) {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8');
}

function isFileExists(filePath) {
    return fs.existsSync(filePath);
}

function isFolderExists(folderPath) {
    return fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory();
}

function createFolder(folderPath) {
    if (!isFolderExists(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
}

module.exports = { getFiles, isFileExists, readFile, isFolderExists, createFolder };