const fs = require('fs/promises');
const path = require('path');
const { getFiles } = require('../../core/utils/files');
const skillsFolder = path.join(__dirname, '../skills');
let cachedSkills = null;

async function loadSkills() {
    try {
        const files = await fs.readdir(skillsFolder);
        const skillFiles = files.filter(f => f.endsWith('.md'));

        const skills = await Promise.all(
            skillFiles.map(async (file) => {
                const skillName = path.basename(file, '.md');
                const content = await fs.readFile(path.join(skillsFolder, file), 'utf-8');
                return { name: skillName, content };
            })
        );

        return skills;
    } catch (error) {
        console.error('Error loading skills:', error);
        throw error;
    }
}

async function getSkillsContext() {
    if (!cachedSkills) {
        const skills = await loadSkills();

        cachedSkills = skills
            .map(s => `# ${s.name}\n${s.content}`)
            .join("\n\n");
    }
    return cachedSkills;
}

module.exports = { loadSkills, getSkillsContext };