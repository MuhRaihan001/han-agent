const { saveConfig } = require("../utils/config");

class BaseModel {
    constructor(api_key, providerName) {
        if (new.target === BaseModel) {
            throw new Error("BaseModel is abstract and cannot be instantiated directly.");
        }
        this.client = this._initClient(api_key);
        this.providerName = providerName;
    }

    _initClient(api_key) {
        throw new Error(`${this.constructor.name} must implement _initClient()`);
    }

    _callApi(prompt, model) {
        throw new Error(`${this.constructor.name} must implement _callApi()`);
    }

    *_streamApi(prompt, model) {
        throw new Error(`${this.constructor.name} must implement _streamResponse()`);
    }

    async generateResponse(prompt, model) {
        try {
            return await this._callApi(prompt, model);
        } catch (error) {
            console.error(`Error generating response from ${this.providerName}:`, error);
            throw error;
        }
    }

    async *streamResponse(prompt, model, onChunk = null) {
        try {
            for await (const chunk of this._streamApi(prompt, model)) {
                if (onChunk) onChunk(chunk);
                yield chunk;
            }
        } catch (error) {
            console.error(`Error streaming response from ${this.providerName}:`, error);
            throw error;
        }
    }

    static setupModel(provider, apiKey, model, setAsCurrent = false) {

        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
            throw new Error(`API key for "${provider}" cannot be empty.`);
        }

        if (!model || typeof model !== 'string' || model.trim() === '') {
            throw new Error(`Model for "${provider}" cannot be empty.`);
        }

        saveConfig({
            [`${provider}-api-key`]: apiKey.trim(),
            ...(setAsCurrent && {
                'current-provider': provider,
                'current-models': model.trim()
            })
        });

        console.log(`Setup "${provider}" successful.${setAsCurrent ? ` Now active with model "${model}".` : ''}`);
    }
}

module.exports = BaseModel;