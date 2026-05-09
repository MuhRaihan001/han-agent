const { GoogleGenAI } = require("@google/genai");
const BaseModel = require("./base-model");

class GeminiModel extends BaseModel {
    constructor(api_key) {
        super(api_key, "Gemini");
    }

    _initClient(api_key) {
        return new GoogleGenAI({ apiKey: api_key });
    }

    _buildContents(messages) {
        return messages
            .filter(m => m.role !== "system")
            .map(m => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
            }));
    }

    async _callApi(messages, model) {
        const contents = this._buildContents(messages);
        const res = await this.client.models.generateContent({
            model: model || "gemini-2.0-flash",
            contents,
        });
        return res.text || "";
    }

    async *_streamApi(messages, model) {
        const contents = this._buildContents(messages);

        const stream = await this.client.models.generateContentStream({
            model: model || "gemini-2.0-flash",
            contents,
        });

        for await (const chunk of stream) {
            const text = chunk.text;
            if (text) yield text;
        }
    }
}

module.exports = GeminiModel;