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
    const instruction =
        `check if the following prompt is valid for generating shell commands. If it is valid, respond with "VALID". If it is not valid, respond with "INVALID" and a brief explanation.\n\n` +
        prompt;

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
    const config = await loadConfig();
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
    const config = await loadConfig();
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
    const config = await loadConfig();
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