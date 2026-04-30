class HistoryManager {
    constructor(options = {}) {
        this.histories  = {};
        this.summaries  = {};

        this.recentWindow   = options.recentWindow   ?? 10;
        this.maxMsgChars    = options.maxMsgChars    ?? 800;
        this.maxTotalChars  = options.maxTotalChars  ?? 6000;
        this.maxSummaryChars= options.maxSummaryChars?? 800;

        this.enableSummary  = options.enableSummary  ?? true;
    }

    _strip(text) {
        return String(text ?? "")
            .replace(/\r\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .replace(/[ \t]{2,}/g, " ")
            .trim();
    }

    _truncate(text, maxChars = this.maxMsgChars) {
        const s = this._strip(text);
        if (s.length <= maxChars) return s;

        const cut = s.slice(0, maxChars);

        const lastDot = cut.lastIndexOf(".");
        if (lastDot > maxChars * 0.6) {
            return cut.slice(0, lastDot + 1) + "…";
        }

        return cut + "…";
    }

    _estimateTokens(text) {
        if (!text) return 0;
        return Math.ceil(text.length / 4);
    }

    _buildSummary(messages) {
        const parts = [];

        for (const m of messages) {
            const content = this._truncate(m.content, 100);

            if (m.role === "user") {
                parts.push(`U:${content}`);
            } else {
                parts.push(`A:${content}`);
            }
        }

        return parts.join(" | ");
    }

    _compressSummary(text) {
        return text
            .replace(/User:/g, "U:")
            .replace(/Assistant:/g, "A:")
            .replace(/\s+/g, " ")
            .slice(0, this.maxSummaryChars);
    }

    _updateSummary(userId, newMessages) {
        const prevSummary = this.summaries[userId] ?? "";
        const newPart     = this._buildSummary(newMessages);

        const combined = prevSummary
            ? prevSummary + " " + newPart
            : newPart;

        this.summaries[userId] = this._compressSummary(combined);
    }

    get(userId) {
        if (!this.histories[userId]) {
            this.histories[userId] = [];
        }
        return this.histories[userId];
    }

    add(userId, role, content) {
        const history = this.get(userId);

        history.push({
            role,
            content: this._strip(content),
        });

        if (this.enableSummary && history.length > this.recentWindow) {
            const overflow = history.splice(
                0,
                history.length - this.recentWindow
            );

            this._updateSummary(userId, overflow);
        }
    }


    getForPrompt(userId, summaryRole = "system") {
        const history = this.get(userId);
        const summary = this.summaries[userId];

        let messages = history.map(m => ({
            role: m.role,
            content: this._truncate(m.content),
        }));

        let totalChars = messages.reduce(
            (sum, m) => sum + m.content.length,
            0
        );

        while (messages.length > 2 && totalChars > this.maxTotalChars) {
            const removed = messages.shift();
            totalChars -= removed.content.length;
        }

        if (!summary) return messages;

        const summaryMsg = {
            role: summaryRole,
            content: `[Summary]\n${summary}`,
        };

        return [summaryMsg, ...messages];
    }

    stats(userId) {
        const history = this.get(userId);
        const summary = this.summaries[userId] ?? "";

        const historyText = history.map(m => m.content).join(" ");
        const totalText   = summary + " " + historyText;

        return {
            userId,
            recentMessages : history.length,
            summaryChars   : summary.length,
            summaryTokens  : this._estimateTokens(summary),
            historyChars   : historyText.length,
            historyTokens  : this._estimateTokens(historyText),
            totalTokens    : this._estimateTokens(totalText),
        };
    }


    clear(userId) {
        this.histories[userId] = [];
        delete this.summaries[userId];
    }

    clearAll() {
        this.histories = {};
        this.summaries = {};
    }

    has(userId) {
        return !!this.histories[userId]?.length;
    }
}

module.exports = HistoryManager;