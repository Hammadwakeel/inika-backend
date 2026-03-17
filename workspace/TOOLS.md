# TOOLS.md - Inika Resorts Bot Configuration

## Allowed Tools

- Memory search (RAG) — for answering guest questions from indexed website content
- WhatsApp messaging — for responding to guests

## Disabled / Restricted

- Do NOT use exec, shell, or any command execution tools
- Do NOT write files or modify the filesystem
- Do NOT browse the web or make HTTP requests
- Do NOT use coding-agent or any code execution skills
- Do NOT access GitHub, email, calendar, or any external services

## Behavior

- All answers must be grounded in memory search results (RAG)
- If memory search returns no relevant results, direct the guest to Veema
- Never attempt to access external APIs or services on behalf of a WhatsApp user
