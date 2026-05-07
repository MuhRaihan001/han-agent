const fs   = require('fs');
const path = require('path');

class Conversations {

    constructor(baseDir) {
        this.conversationPath = baseDir || path.join(__dirname, '../../conversations');
        this._ensureDir();
    }

    _ensureDir() {
        if (!fs.existsSync(this.conversationPath)) {
            fs.mkdirSync(this.conversationPath, { recursive: true });
        }
    }

    _filePath(id) {
        const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
        return path.join(this.conversationPath, `${safe}.json`);
    }

    _generateId() {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    }

    _read(id) {
        const fp = this._filePath(id);
        if (!fs.existsSync(fp)) return null;
        try {
            return JSON.parse(fs.readFileSync(fp, 'utf-8'));
        } catch {
            return null;
        }
    }

    _write(data) {
        fs.writeFileSync(this._filePath(data.id), JSON.stringify(data, null, 2), 'utf-8');
    }

    _autoTitle(messages) {
        const first = messages.find(m => m.role === 'user');
        if (!first) return 'Untitled conversation';
        const text = String(first.content).replace(/\s+/g, ' ').trim();
        return text.length <= 60 ? text : text.slice(0, 57) + '…';
    }

    createConversation(title = '') {
        const id  = this._generateId();
        const now = new Date().toISOString();

        this._write({
            id,
            title:     title || '',
            createdAt: now,
            updatedAt: now,
            messages:  [],
            summary:   '',
        });

        return id;
    }

    saveConversation(id, messages, summary = '', title = '') {
        const existing = this._read(id) || {};
        const now      = new Date().toISOString();

        // Stamp each message with the current time if it doesn't already have one
        const stamped = messages.map(m => ({
            role:    m.role,
            content: m.content,
            ts:      m.ts || now,
        }));

        const data = {
            id,
            title:     title || existing.title || this._autoTitle(stamped),
            createdAt: existing.createdAt || now,
            updatedAt: now,
            messages:  stamped,
            summary,
        };

        this._write(data);
        return data;
    }

    loadConversation(id) {
        return this._read(id);
    }

    listConversations() {
        this._ensureDir();

        return fs.readdirSync(this.conversationPath)
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const id   = f.replace(/\.json$/, '');
                const data = this._read(id);
                if (!data) return null;
                return {
                    id,
                    title:        data.title  || this._autoTitle(data.messages),
                    createdAt:    data.createdAt,
                    updatedAt:    data.updatedAt,
                    messageCount: (data.messages || []).length,
                };
            })
            .filter(Boolean)
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }

    deleteConversation(id) {
        const fp = this._filePath(id);
        if (!fs.existsSync(fp)) return false;
        fs.unlinkSync(fp);
        return true;
    }

    renameConversation(id, newTitle) {
        const data = this._read(id);
        if (!data) return false;
        data.title     = newTitle;
        data.updatedAt = new Date().toISOString();
        this._write(data);
        return true;
    }

    restoreToHistory(id, historyManager, userId) {
        const data = this._read(id);
        if (!data) return null;

        historyManager.clear(userId);

        for (const msg of data.messages || []) {
            historyManager.add(userId, msg.role, msg.content);
        }

        if (data.summary) {
            historyManager.summaries[userId] = data.summary;
        }

        return data;
    }
}

module.exports = Conversations;