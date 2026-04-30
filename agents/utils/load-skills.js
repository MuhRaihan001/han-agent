const fs = require('fs/promises');
const path = require('path');

const skillsFolder = path.join(__dirname, '../skills');
let cachedSkills = null;

async function loadSkillsRecursive(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    const results = await Promise.all(
        entries.map(async (entry) => {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                return loadSkillsRecursive(fullPath); // ← masuk subfolder
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
        const skills = await loadSkillsRecursive(skillsFolder);
        cachedSkills = skills
            .map(s => `# ${s.name}\n${s.content}`)
            .join("\n\n");
    }
    return cachedSkills;
}

module.exports = { getSkillsContext };