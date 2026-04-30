const database = require('../../core/utils/deploySQL');
const { generateModelResponse } = require('../response');

// Allowed JOIN types for validation
const ALLOWED_JOIN_TYPES = ["INNER", "LEFT", "RIGHT", "FULL"];

// Regex to validate ON clause: allows table.column = table.column
// or `table`.`column` = `table`.`column`
const JOIN_ON_PATTERN = /^`?[\w]+`?\.`?[\w]+`?\s*=\s*`?[\w]+`?\.`?[\w]+`?$/;

class Instructor {

    async generateInstruction(command, workerContext = null) {
        console.log(`Generating structured action for: "${command}"`);

        const context = await this.#fetchSchemaContext();
        const prompt = this.#buildPrompt({ context, command, workerContext });

        const aiResponse = await generateModelResponse("instructor-agent", prompt);
        return this.#parseAndValidate(aiResponse);
    }

    isAmbiguous(meta) {
        const { ambiguity_level, confidence } = meta;
        return confidence < 0.8 || ambiguity_level === "medium" || ambiguity_level === "high";
    }

    /**
     * Validate join definitions against the known schema.
     * Throws if a join references an unknown table or ON clause is malformed.
     */
    #validateJoins(joins, schema) {
        for (const join of joins) {
            // Validate join type
            const type = (join.type || "INNER").toUpperCase();
            if (!ALLOWED_JOIN_TYPES.includes(type)) {
                throw new Error(`Invalid JOIN type: "${join.type}". Allowed: ${ALLOWED_JOIN_TYPES.join(", ")}`);
            }

            // Validate join table exists in schema
            if (schema && !schema[join.table]) {
                throw new Error(`JOIN references unknown table: "${join.table}"`);
            }

            // Validate ON clause format to prevent SQL injection
            if (!JOIN_ON_PATTERN.test(join.on.trim())) {
                throw new Error(
                    `Invalid JOIN ON clause: "${join.on}". ` +
                    `Expected format: table.column = table.column`
                );
            }
        }
    }

    generateMysqlQuery(action, schema = null) {
        if (!action || typeof action !== "object") {
            throw new Error("Action object is required");
        }

        const {
            method,
            table,
            columns = [],
            joins = [],
            where = [],
            params = [],
            ambiguity_level = "low",
            confidence = 0,
            matched_task_ids = [],
            reason = ""
        } = action;

        if (!method || !table) {
            throw new Error("method and table are required");
        }

        // JOIN is only supported for SELECT
        if (joins.length && method.toLowerCase() !== "select") {
            throw new Error(`JOIN is only supported for SELECT, not "${method}"`);
        }

        // Validate JOIN definitions before building any SQL
        if (joins.length) {
            this.#validateJoins(joins, schema);
        }

        let sql = "";
        let sqlParams = [];

        switch (method.toLowerCase()) {

            case "select": {
                // When JOINs are present, columns may be in "table.column" format,
                // so we skip per-column backtick wrapping and trust the AI output.
                // When no JOINs, wrap plain column names in backticks as before.
                let cols;
                if (columns.length && !columns.includes("*")) {
                    cols = joins.length
                        ? columns.join(", ")                            // e.g. "work.id, proyek.name"
                        : columns.map(c => `\`${c}\``).join(", ");     // e.g. "`id`, `name`"
                } else {
                    cols = "*";
                }

                sql = `SELECT ${cols} FROM \`${table}\``;

                // Append JOIN clauses
                for (const join of joins) {
                    const type = join.type.toUpperCase();
                    sql += ` ${type} JOIN \`${join.table}\` ON ${join.on}`;
                }

                if (where.length) {
                    if (params.length !== where.length) {
                        throw new Error(
                            `SELECT WHERE mismatch: ${where.length} column(s) but ${params.length} param(s)`
                        );
                    }
                    // When JOINs are present, WHERE columns may be "table.column"
                    const whereClauses = joins.length
                        ? where.map(c => `${c} = ?`)
                        : where.map(c => `\`${c}\` = ?`);

                    sql += " WHERE " + whereClauses.join(" AND ");
                    sqlParams = params;
                }
                break;
            }

            case "insert": {
                if (!columns.length || !params.length) {
                    throw new Error("INSERT requires columns and params");
                }
                if (columns.length !== params.length) {
                    throw new Error(
                        `INSERT mismatch: ${columns.length} column(s) but ${params.length} param(s)`
                    );
                }
                const colList = columns.map(c => `\`${c}\``).join(", ");
                const placeholders = columns.map(() => "?").join(", ");
                sql = `INSERT INTO \`${table}\` (${colList}) VALUES (${placeholders})`;
                sqlParams = params;
                break;
            }

            case "update": {
                if (!columns.length || !where.length) {
                    throw new Error("UPDATE requires columns and where");
                }

                const expectedParamCount = columns.length + where.length;
                if (params.length !== expectedParamCount) {
                    throw new Error(
                        `UPDATE params mismatch: expected ${expectedParamCount} ` +
                        `(${columns.length} SET + ${where.length} WHERE) but got ${params.length}`
                    );
                }
                const setParams   = params.slice(0, columns.length);
                const whereParams = params.slice(columns.length);

                const setClause   = columns.map(c => `\`${c}\` = ?`).join(", ");
                const whereClause = where.map(c => `\`${c}\` = ?`).join(" AND ");
                sql = `UPDATE \`${table}\` SET ${setClause} WHERE ${whereClause}`;
                sqlParams = [...setParams, ...whereParams];
                break;
            }

            case "delete": {
                if (!where.length) {
                    throw new Error("DELETE requires where");
                }
                if (params.length !== where.length) {
                    throw new Error(
                        `DELETE WHERE mismatch: ${where.length} column(s) but ${params.length} param(s)`
                    );
                }
                sql = `DELETE FROM \`${table}\` WHERE ` + where.map(c => `\`${c}\` = ?`).join(" AND ");
                sqlParams = params;
                break;
            }

            default:
                throw new Error(`Unsupported method: ${method}`);
        }

        const result = {
            sql,
            params: sqlParams,
            meta: { method, table, joins, ambiguity_level, confidence, matched_task_ids, reason }
        };

        console.dir(result, { depth: null });
        return result;
    }

    async buildQueries(command, workerContext = null) {
        const instruction = await this.generateInstruction(command, workerContext);
        console.log(instruction);

        // Fetch schema once so JOIN validation can check table names
        const schema = await this.#fetchSchemaContext();

        const ready = [];
        const needsConfirmation = [];

        for (const action of instruction.actions) {
            const query = this.generateMysqlQuery(action, schema);
            (this.isAmbiguous(query.meta) ? needsConfirmation : ready).push(query);
        }

        return { ready, needsConfirmation };
    }


    async #fetchSchemaContext() {
        return database.transaction(async (conn) => {

            const [tableRows] = await conn.query(`
                SELECT TABLE_NAME
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_TYPE = 'BASE TABLE'
            `);

            const tableNames = tableRows.map(r => r.TABLE_NAME);

            if (tableNames.length === 0) return {};

            const placeholders = tableNames.map(() => '?').join(', ');
            const [columnRows] = await conn.query(`
                SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME IN (${placeholders})
                ORDER BY TABLE_NAME, ORDINAL_POSITION
            `, tableNames);

            const schema = {};
            for (const col of columnRows) {
                const t = col.TABLE_NAME;
                if (!schema[t]) schema[t] = { columns: [], sample: [] };
                schema[t].columns.push({
                    name: col.COLUMN_NAME,
                    type: col.DATA_TYPE,
                    nullable: col.IS_NULLABLE === 'YES',
                    key: col.COLUMN_KEY || null,
                });
            }

            for (const table of tableNames) {
                const [rows] = await conn.query(
                    `SELECT * FROM \`${table}\` LIMIT 3`
                );
                schema[table].sample = rows;
            }

            return schema;
        });
    }


    #buildPrompt({ context, command, workerContext }) {
        const parts = [
            `Current database state:\n${JSON.stringify(context, null, 2)}`,
            `Command: "${command}"`,
        ];

        if (workerContext) {
            parts.push(
                `Worker context:\n` +
                `- Name: ${workerContext.worker_name}\n` +
                `- Current Task ID: ${workerContext.current_task}\n` +
                `- Current Task Name: ${workerContext.current_task_name}\n` +
                `If no specific task is mentioned, assume the worker means their current task.`
            );
        }

        parts.push(
            `IMPORTANT: You must respond using the "nlp-to-sql" skill.\n` +
            `Respond ONLY with a valid JSON object in this exact format:\n` +
            `{"actions":[{"method":"...","table":"...","joins":[{"type":"LEFT","table":"other_table","on":"main.fk = other_table.id"}],"columns":[...],"where":[...],"params":[...],"ambiguity_level":"low","confidence":0.99,"matched_task_ids":[],"reason":"..."}]}\n` +
            `JOIN rules:\n` +
            `- "joins" is optional. Omit it (or use []) when no JOIN is needed.\n` +
            `- JOIN is only allowed for SELECT operations.\n` +
            `- "on" must follow the format: table.column = table.column\n` +
            `- Allowed join types: INNER, LEFT, RIGHT, FULL\n` +
            `- When JOIN is used, columns must be prefixed: ["work.id", "proyek.name"]\n` +
            `- When JOIN is used, where columns must also be prefixed: ["work.id"]\n` +
            `For UPDATE actions, params must contain SET values first, then WHERE values in order.\n` +
            `Example UPDATE: columns:["progress"], where:["id"], params:[75, 3] → SET progress=75 WHERE id=3\n` +
            `Do NOT return SQL. Do NOT include markdown. Do NOT include any explanation outside the JSON.`
        );

        return parts.join("\n\n");
    }

    #parseAndValidate(text) {
        const result = this.#safeJSONParse(text);

        if (!Array.isArray(result.actions) || result.actions.length === 0) {
            throw new Error("actions must be a non-empty array");
        }

        for (const action of result.actions) {
            if (!action.method || !action.table) {
                throw new Error(`Invalid action — missing method or table: ${JSON.stringify(action)}`);
            }

            // Validate joins field type if present
            if (action.joins !== undefined && !Array.isArray(action.joins)) {
                throw new Error(`"joins" must be an array in action: ${JSON.stringify(action)}`);
            }

            // Validate each join has required fields
            for (const join of (action.joins || [])) {
                if (!join.type || !join.table || !join.on) {
                    throw new Error(`Invalid join — missing type, table, or on: ${JSON.stringify(join)}`);
                }
            }
        }

        return result;
    }

    #safeJSONParse(text) {
        console.log(text);
        try {
            let clean = text.replace(/```json\n?|```/g, "").trim();

            if (!clean.startsWith("{")) {
                const first = clean.indexOf("{");
                const last = clean.lastIndexOf("}");
                if (first !== -1 && last > first) {
                    clean = clean.substring(first, last + 1);
                }
            }

            return JSON.parse(clean);
        } catch (error) {
            console.error("Failed to parse AI response as JSON:");
            console.error("RAW TEXT:", text);
            throw new Error("AI returned invalid JSON: " + error.message);
        }
    }
}

module.exports = Instructor;