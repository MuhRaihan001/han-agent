const { Anthropic } = require("@anthropic-ai/sdk");
const BaseModel = require("./base-model");

class ClaudeModel extends BaseModel {
    constructor(api_key) {
        super(api_key, "Claude");
    }

    _initClient(api_key) {
        return new Anthropic({ apiKey: api_key });
    }

    async _callApi(messages, model) {
        const systemMsg = messages.find(m => m.role === "system");
        const chatMsgs = messages.filter(m => m.role !== "system");
        return (await this.client.messages.create({
            model: model || "claude-sonnet-4-5",
            max_tokens: 1024,
            system: systemMsg?.content,
            messages: chatMsgs,
        })).content[0].text || "";
    }

    async *_streamApi(messages, model) {
        const systemMsg = messages.find(m => m.role === "system");
        const chatMsgs = messages.filter(m => m.role !== "system");
 
        const stream = await this.client.messages.stream({
            model: model || "claude-sonnet-4-5",
            max_tokens: 1024,
            system: systemMsg?.content,
            messages: chatMsgs,
        });
 
        for await (const event of stream) {
            if (
                event.type === "content_block_delta" &&
                event.delta?.type === "text_delta"
            ) {
                yield event.delta.text;
            }
        }
    }
}

module.exports = ClaudeModel;