const HistoryManager = require("./utils/history");
const { getSkillsContext } = require("./utils/load-skills");
const { loadConfig } = require("./utils/config");
const { executeWithContext } = require("./utils/shell-command");

const historyManager = new HistoryManager({ recentWindow: 20 });

const MODEL_PATHS = {
    gemini: "./models/Google",
    claude: "./models/Anthropic",
    openai: "./models/OpenAi",
};

const config = loadConfig();

async function _buildModel(config) {
    const modelname = config["current-models"]?.toLowerCase();
    const currentProvider = config["current-provider"]?.toLowerCase();

    if (!modelname) throw new Error("No model selected.");
    if (!MODEL_PATHS[currentProvider]) throw new Error(`Provider "${currentProvider}" not registered.`);

    const apiKey = config[`${currentProvider}-api-key`];
    if (!apiKey) throw new Error(`API key for "${currentProvider}" is not set.`);

    const Model = require(MODEL_PATHS[currentProvider]);
    return { model: new Model(apiKey), modelname };
}

async function validatePrompt(prompt, config) {
    const instruction = `You are an intent classifier. Your job is to determine whether the user's input is requesting a shell command to be executed, or just having a casual conversation.

    A prompt is VALID (shell command intent) if it:
    - Asks to run, execute, or perform a system operation (e.g. list files, install packages, check disk space)
    - Describes a task that maps naturally to a CLI operation (e.g. "zip this folder", "kill port 3000", "show running processes")
    - Requests automation or scripting of OS-level tasks
    - Uses technical terms implying terminal usage (e.g. "grep", "chmod", "ssh", "docker", "git")
    - Asks to create, delete, move, copy, or modify files/directories

    A prompt is INVALID (not shell command intent) if it:
    - Is general conversation, a greeting, or small talk (e.g. "hi", "thanks", "how are you")
    - Asks for explanations, definitions, or conceptual questions without action intent
    - Is a question about code logic without requesting execution
    - Requests creative writing, translation, or summarization
    - Is ambiguous but leans more toward information-seeking than task execution

    Respond with ONLY "VALID" or "INVALID: <one-line reason>". No extra text.

    User input: "${prompt}"`;

    const { model, modelname } = await _buildModel(config);
    const response = await model.generateResponse([{ role: "user", content: instruction }], modelname);
    return response.trim().toUpperCase().startsWith("VALID");
}
async function _buildMessages(userId, prompt) {
    const skillsContext = await getSkillsContext();
    const history = historyManager.getForPrompt(userId);
    const result = [
        {
            role: "dev",
            content: `You have the following skills:\n\n${skillsContext}`,
        },
        ...history,
        { role: "user", content: prompt },
    ];
    return result;
}

async function getResponse(userId, prompt) {
    if (config["stream-response"]) {
        return { stream: true, generator: streamModelResponse(userId, prompt) };
    }
    return { stream: false, text: await generateModelResponse(userId, prompt) };
}

function formatRoundsOutput(rounds) {
    return rounds.flatMap((round, ri) =>
        round.map(task => [
            `[Round ${ri + 1}] ${task.natural_command}`,
            task.formattedOutput
        ].join('\n'))
    ).join('\n\n');
}

async function generateModelResponse(userId, prompt) {
    const { model, modelname } = await _buildModel(config);
    const messages = await _buildMessages(userId, prompt);
    const isShell = await validatePrompt(prompt, config);

    let response;
    if (isShell) {
        const { rounds } = await executeWithContext(prompt);
        response = formatRoundsOutput(rounds);
    } else {
        response = await model.generateResponse(messages, modelname);
    }

    historyManager.add(userId, "user", prompt);
    historyManager.add(userId, "assistant", response);
    return response;
}

async function* streamModelResponse(userId, prompt) {
    const { model, modelname } = await _buildModel(config);
    const messages = await _buildMessages(userId, prompt);
    const isShell = await validatePrompt(prompt, config);

    let fullResponse = "";

    if (isShell) {
        const { rounds } = await executeWithContext(prompt);
        fullResponse = formatRoundsOutput(rounds);
        for (const line of fullResponse.split("\n")) {
            yield line + "\n";
        }
    } else {
        for await (const chunk of model.streamResponse(messages, modelname)) {
            fullResponse += chunk;
            yield chunk;
        }
    }

    historyManager.add(userId, "user", prompt);
    historyManager.add(userId, "assistant", fullResponse);
}

const clearHistory = (userId) => historyManager.clear(userId);

module.exports = { generateModelResponse, streamModelResponse, clearHistory, getResponse, historyManager };