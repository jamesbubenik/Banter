# Banter

An AI-powered discussion platform that lets two locally-running LLM personas hold a structured, streaming conversation with each other on any topic you choose.

> **Note:** Banter is a variant of [Ellagent](https://github.com/jamesbubenik/Ellagent) and was created as part of a personal **Vibe Coding** demonstration — built iteratively with AI assistance to explore rapid prototyping workflows.

---

## Purpose

Banter makes it easy to stage a conversation between two distinct AI personas. You define who each participant is (their name, personality, and perspective), set a discussion context, and watch them engage in real-time. It's useful for exploring how different viewpoints interact on a topic, stress-testing arguments, or just experimenting with persona design.

---

## Features

### People
Create and manage AI personas. Each person has:
- A **name** and optional **description**
- A **system prompt** that defines their personality, communication style, and areas of expertise
- An optional **model override** (falls back to the global default)

### Vibe Creator
A chat-based persona builder. Describe the person you want in plain language and the LLM drafts a name, description, and full system prompt for you. Refine through conversation before saving.

### Discussion
Pick two personas, write a discussion context (a topic, scenario, question, or task), and start the conversation. Each turn streams in real-time via Server-Sent Events. Features include:
- **Rolling context window** — automatically trims history to fit within the configured token budget
- **Reasoning token support** — strips `<think>` blocks from models that emit explicit reasoning phases so only the final response is shown
- **Condense** — summarizes the conversation so far into 2–3 paragraphs when the exchange gets long

### Settings
Configure the LM Studio connection without restarting the server:
- Base URL, API key, and default model
- Context window token limit and request timeout
- Server log level (Off / Error / Info / Debug)

---

## Requirements

- [Node.js](https://nodejs.org/) v18 or later
- [LM Studio](https://lmstudio.ai/) with the local server running (default: `http://localhost:1234`)
- At least one model loaded in LM Studio

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/jamesbubenik/Banter.git
cd Banter

# 2. Install dependencies
npm install

# 3. Configure the connection (optional — defaults work for a standard LM Studio setup)
cp data/config.example.json data/config.json
# Edit data/config.json and set your model name

# 4. Start the server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Configuration

Settings are stored in `data/config.json` (created automatically on first run, or copy from `data/config.example.json`). They can also be changed live from the **Settings** view in the UI.

| Field | Default | Description |
|---|---|---|
| `baseUrl` | `http://localhost:1234/v1` | LM Studio server URL |
| `apiKey` | `lm-studio` | API key (LM Studio ignores this, but it must be set) |
| `model` | *(empty)* | Default model identifier — set this to a loaded model name |
| `contextWindowTokens` | `8192` | Token budget for conversation history |
| `timeoutMs` | `120000` | Per-request timeout in milliseconds |
| `logLevel` | `info` | Server log verbosity: `off`, `error`, `info`, or `debug` |

`data/config.json` is excluded from version control. Do not commit it.

---

## Project Structure

```
Banter/
├── public/          # Frontend (HTML, CSS, vanilla JS)
│   ├── index.html
│   ├── css/
│   └── js/
├── src/
│   ├── routes/      # Express route handlers
│   └── services/    # LLM client, config, agent storage, logger
├── data/            # Runtime config (gitignored)
├── agents/          # Saved persona JSON files (gitignored)
├── logs/            # Server log files (gitignored)
└── server.js        # Entry point
```

---

## Tech Stack

- **Backend:** Node.js, Express
- **Frontend:** Vanilla HTML/CSS/JavaScript (no build step)
- **LLM integration:** OpenAI-compatible streaming API via `fetch`, with optional LM Studio SDK for model management
