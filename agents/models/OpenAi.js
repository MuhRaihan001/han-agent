const { OpenAI } = require("openai");
const BaseModel = require("./base-model");

class OpenAiModel extends BaseModel {
    constructor(api_key) {
        super(api_key, "OpenAI");
    }

    _initClient(api_key) {
        return new OpenAI({ apiKey: api_key });
    }

    async _callApi(prompt, model) {
        const response = await this.client.chat.completions.create({
            model: model || "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
        });
        return response.choices[0].message.content || "";
    }

    async *_streamApi(messages, model) {
        const stream = await this.client.chat.completions.create({
            model: model || "gpt-4o-mini",
            messages: messages,
            stream: true,
        });
 
        for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) yield text;
        }
    }
}

module.exports = OpenAiModel;