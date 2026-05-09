const fs = require('fs/promises');
const path = require('path');

const skillsFolder = path.join(__dirname, '../../../skills');
let cachedSkills = null;

async function loadSkillsRecursive(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const results = await Promise.all(
        entries.map(async (entry) => {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                return loadSkillsRecursive(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                const skillName = path.basename(entry.name, '.md');
                const content = await fs.readFile(fullPath, 'utf-8');
                return [{ name: skillName, content }];
            }
            return [];
        })
    );
    return results.flat();
}

async function getSkillsContext() {
    if (!cachedSkills) {
        const { loadConfig } = require('./config');
        const cfg = loadConfig();
        const activeSkills = Array.isArray(cfg['active-skills']) ? cfg['active-skills'] : [];

        const skills = await loadSkillsRecursive(skillsFolder);

        const filtered = activeSkills.length > 0
            ? skills.filter(s => activeSkills.includes(s.name))
            : [];

        cachedSkills = filtered
            .map(s => `# ${s.name}\n${s.content}`)
            .join('\n\n');
    }
    return cachedSkills;
}

async function createNewSkill(name, content) {
    if (!name || !content) throw new Error('Skill name and content are required.');

    const safeName = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');

    const filePath = path.join(skillsFolder, `${safeName}.md`);

    try {
        await fs.access(filePath);
        throw new Error('Skill already exists.');
    } catch (err) {
        if (err.message === 'Skill already exists.') throw err;
    }

    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
}

function invalidateCache() {
    cachedSkills = null;
}

module.exports = { getSkillsContext, createNewSkill, invalidateCache };