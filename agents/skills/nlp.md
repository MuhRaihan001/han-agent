# nlp-to-sql

This skill converts natural language commands into structured MySQL instruction objects (JSON), which are then used to generate safe, parameterized queries.

---

## How It Works

When a user gives a command in plain language (e.g. *"mark my task as done"*), this skill will:

1. **Identify the intent** — SELECT / INSERT / UPDATE / DELETE
2. **Map entities** to the correct tables and columns
3. **Output a JSON instruction set** containing one or more actions
4. **Detect ambiguity** and score confidence for each action

---

## Output Format (JSON)

This skill always responds with the following structure:
a
```json
{
  "actions": [
    {
      "method": "update",
      "table": "work",
      "columns": ["status"],
      "where": ["id"],
      "params": ["done", 42],
      "ambiguity_level": "low",
      "confidence": 0.95,
      "matched_task_ids": [42],
      "reason": "Update status of task id 42 to done"
    }
  ]
}
```

### Field Reference

| Field              | Type      | Description                                                                 |
|--------------------|-----------|-----------------------------------------------------------------------------|
| `method`           | string    | SQL operation: `select`, `insert`, `update`, `delete`                       |
| `table`            | string    | Target table name                                                           |
| `columns`          | string[]  | Columns involved — SET columns for UPDATE, result columns for SELECT        |
| `where`            | string[]  | Columns used in the WHERE clause                                            |
| `params`           | any[]     | Parameter values in order: [set_values..., where_values...]                 |
| `ambiguity_level`  | string    | `low` / `medium` / `high`                                                   |
| `confidence`       | number    | Score from 0.0–1.0 indicating how certain the interpretation is             |
| `matched_task_ids` | number[]  | IDs of matched tasks (empty if not applicable)                              |
| `reason`           | string    | Short explanation of why this action was chosen                             |

---

## Interpretation Rules

### Intent → Method Mapping

| User Intent                                    | Method   |
|------------------------------------------------|----------|
| "show", "list", "get", "fetch", "check"        | select   |
| "add", "create", "register", "log", "record"   | insert   |
| "update", "change", "mark", "set", "finish"    | update   |
| "delete", "remove", "drop"                     | delete   |

### Ambiguity Detection

Set `ambiguity_level` to `"medium"` or `"high"` when:
- No specific ID is given and multiple rows could match
- The task name is a partial or fuzzy match with more than one result
- The command can be interpreted in more than one way

Set `confidence` below `0.8` when:
- Keywords are vague or unclear
- Worker context is insufficient to determine which task is meant

### Worker Context

When available, use `WORKER CONTEXT` to:
- Automatically fill in `where` using the worker's `current_task` ID
- Assume the active task is the target unless the command says otherwise

---

## Examples

### Example 1 — Mark task as done (with worker context)

**Input:**
```
"finish my task"
WORKER CONTEXT: Name: John, Current Task ID: 7, Current Task Name: Install electrical panel
```

**Output:**
```json
{
  "actions": [
    {
      "method": "update",
      "table": "work",
      "columns": ["status"],
      "where": ["id"],
      "params": ["done", 7],
      "ambiguity_level": "low",
      "confidence": 0.97,
      "matched_task_ids": [7],
      "reason": "Worker John requested to finish their active task (id: 7)"
    }
  ]
}
```

---

### Example 2 — List all projects

**Input:**
```
"show all projects"
```

**Output:**
```json
{
  "actions": [
    {
      "method": "select",
      "table": "proyek",
      "columns": ["*"],
      "where": [],
      "params": [],
      "ambiguity_level": "low",
      "confidence": 0.99,
      "matched_task_ids": [],
      "reason": "Fetching all rows from the proyek table"
    }
  ]
}
```

---

### Example 3 — Ambiguous command

**Input:**
```
"delete the paint task"
CONTEXT: 3 tasks found with names containing "paint"
```

**Output:**
```json
{
  "actions": [
    {
      "method": "delete",
      "table": "work",
      "columns": [],
      "where": ["name"],
      "params": ["paint"],
      "ambiguity_level": "high",
      "confidence": 0.45,
      "matched_task_ids": [3, 11, 19],
      "reason": "Found 3 tasks matching 'paint' — user confirmation required"
    }
  ]
}
```

---

## Constraints

- This skill **does not execute** queries directly — it only produces a JSON instruction set
- Actions with `confidence < 0.8` or `ambiguity_level` of `medium`/`high` **must be confirmed** by the user before execution
- Maximum **5 actions** per response
- Only standard **CRUD operations** are supported (SELECT, INSERT, UPDATE, DELETE)
- JOINs, subqueries, and complex aggregations are not supported