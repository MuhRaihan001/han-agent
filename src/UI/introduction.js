const readline = require('readline');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const introductionPath = path.join(__dirname, '../skills/introduction.md');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
});

const ask = (label, hint) => new Promise(resolve => {
    process.stdout.write(
        '\n' +
        chalk.cyan('  ' + label) +
        (hint ? chalk.dim('  —  ' + hint) : '') +
        '\n' +
        chalk.cyan('  ❯ ')
    );
    rl.once('line', answer => resolve(answer.trim()));
});

async function main() {
    console.clear();

    console.log();
    console.log(chalk.bold.white('  Han — Setup'));
    console.log(chalk.dim('  ─────────────────────────────'));
    console.log(chalk.dim('  Tell Han a bit about yourself.'));
    console.log();

    const name        = await ask('What should Han call you?');
    const description = await ask('How would you describe yourself?', 'brief is fine');

    rl.close();

    console.log();
    console.log(chalk.dim('  ─────────────────────────────'));
    console.log('  ' + chalk.dim('Name   ') + chalk.white(name));
    console.log('  ' + chalk.dim('About  ') + chalk.white(description));
    console.log(chalk.dim('  ─────────────────────────────'));
    console.log();

    const content = `# Introduction
# This skill provides an introduction to the user, allowing them to share their name and a brief description about themselves. It helps Han understand the user better and personalize interactions based on the provided information.

## User
- Name: ${name}
- Description: ${description}

## Usage
Han can use this information to greet the user by name, remember their preferences, and tailor responses to better suit their personality and interests. This skill can be invoked at the start of a conversation or whenever the user wants to update their information.
`;

    await fs.promises.mkdir(path.dirname(introductionPath), { recursive: true });
    await fs.promises.writeFile(introductionPath, content);

    console.log(chalk.dim('  ✔  Saved to skills/introduction.md'));
    console.log();
    delete require.cache[require.resolve('../index')];
    require('../index');
}

main().catch(err => {
    console.error(chalk.red('\n  ✖  ' + (err.message || err)));
    process.exit(1);
});