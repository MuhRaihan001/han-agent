// agents/response.js  (patched — adds conversation save/load)
const HistoryManager  = require("./utils/history");
const { getSkillsContext } = require("./utils/load-skills");
const { loadConfig }       = require("./utils/config");
const { executeWithContext } = require("./utils/shell-command");
const Conversations   = require("./utils/conversation");

const historyManager      = new HistoryManager({ recentWindow: 20 });
const conversationManager = new Conversations();

const _activeConvId = {};

const MODEL_PATHS = {
    gemini: "./models/Google",
    claude: "./models/Anthropic",
    openai: "./models/OpenAi",
};

const config = loadConfig();

async function _buildModel(config) {
    const modelname       = config["current-models"]?.toLowerCase();
    const currentProvider = config["current-provider"]?.toLowerCase();

    if (!modelname) throw new Error("No model selected.");
    if (!MODEL_PATHS[currentProvider])
        throw new Error(`Provider "${currentProvider}" not registered.`);

    const apiKey = config[`${currentProvider}-api-key`];
    if (!apiKey)
        throw new Error(`API key for "${currentProvider}" is not set.`);

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
    const response = await model.generateResponse(
        [{ role: "user", content: instruction }],
        modelname
    );
    return response.trim().toUpperCase().startsWith("VALID");
}

async function _buildMessages(userId, prompt) {
    const skillsContext = await getSkillsContext();
    const history       = historyManager.getForPrompt(userId);
    return [
        { role: "dev", content: `You have the following skills:\n\n${skillsContext}` },
        ...history,
        { role: "user", content: prompt },
    ];
}

function formatRoundsOutput(rounds) {
    return rounds.flatMap((round, ri) =>
        round.map(task => [
            `[Round ${ri + 1}] ${task.natural_command}`,
            task.formattedOutput
        ].join('\n'))
    ).join('\n\n');
}

function _autoSave(userId) {
    const history = historyManager.get(userId);
    const summary = historyManager.summaries[userId] || '';

    // Create a new file if this user doesn't have an active conversation yet
    if (!_activeConvId[userId]) {
        _activeConvId[userId] = conversationManager.createConversation();
    }

    conversationManager.saveConversation(
        _activeConvId[userId],
        history,
        summary
    );
}

function loadConversation(userId, conversationId) {
    const data = conversationManager.restoreToHistory(
        conversationId,
        historyManager,
        userId
    );
    if (!data) return null;

    _activeConvId[userId] = conversationId;
    return {
        id:           data.id,
        title:        data.title,
        messageCount: (data.messages || []).length,
    };
}

function newConversation(userId) {
    historyManager.clear(userId);
    _activeConvId[userId] = null;
}

async function getResponse(userId, prompt) {
    if (config["stream-response"]) {
        return { stream: true, generator: streamModelResponse(userId, prompt) };
    }
    return { stream: false, text: await generateModelResponse(userId, prompt) };
}

async function generateModelResponse(userId, prompt) {
    const { model, modelname } = await _buildModel(config);
    const messages             = await _buildMessages(userId, prompt);
    const isShell              = await validatePrompt(prompt, config);

    let response;
    if (isShell) {
        const { rounds } = await executeWithContext(prompt);
        response = formatRoundsOutput(rounds);
    } else {
        response = await model.generateResponse(messages, modelname);
    }

    historyManager.add(userId, "user",      prompt);
    historyManager.add(userId, "assistant", response);
    _autoSave(userId);
    return response;
}

async function* streamModelResponse(userId, prompt) {
    const { model, modelname } = await _buildModel(config);
    const messages             = await _buildMessages(userId, prompt);
    const isShell              = await validatePrompt(prompt, config);

    let fullResponse = "";

    if (isShell) {
        const { rounds } = await executeWithContext(prompt, { sandbox: config.sandbox });
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

    historyManager.add(userId, "user",      prompt);
    historyManager.add(userId, "assistant", fullResponse);
    _autoSave(userId);
}

const clearHistory = (userId) => {
    historyManager.clear(userId);
    _activeConvId[userId] = null;
};

module.exports = {
    generateModelResponse,
    streamModelResponse,
    clearHistory,
    getResponse,
    historyManager,
    conversationManager,    // ← export so UI can use it
    loadConversation,       // ← new
    newConversation,        // ← new
};