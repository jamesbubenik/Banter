const OpenAI = require('openai');
const { LMStudioClient } = require('@lmstudio/sdk');
const { getConfig } = require('./configService');

function getClient() {
  const cfg = getConfig();
  return new OpenAI({
    baseURL: cfg.baseUrl || 'http://localhost:1234/v1',
    apiKey: cfg.apiKey || 'lm-studio',
  });
}

async function listModels() {
  const client = getClient();
  const response = await client.models.list();
  return (response.data || []).map(m => m.id);
}

async function checkHealth() {
  const cfg = getConfig();
  return {
    ok: null,
    skipped: true,
    baseUrl: cfg.baseUrl || 'http://localhost:1234/v1',
    message: 'LM Studio is only contacted for chat completions or explicit model refreshes.',
  };
}

async function streamTurn({ messages, model, onChunk }) {
  const cfg = getConfig();

  // Resolve model without querying /v1/models during generation.
  const resolvedModel = model || cfg.model || 'local-model';
  const baseUrl = (cfg.baseUrl || 'http://localhost:1234/v1').replace(/\/+$/, '');
  const controller = new AbortController();
  let timeout = null;
  const resetTimeout = () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => controller.abort(), cfg.timeoutMs || 120000);
  };
  resetTimeout();

  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey || 'lm-studio'}`,
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages,
        temperature: 0.7,
        max_tokens: cfg.maxTokens || 4096,
        stream: true,
      }),
      signal: controller.signal,
    });
    resetTimeout();
  } catch (err) {
    if (timeout) clearTimeout(timeout);
    throw err;
  }

  if (!response.ok) {
    if (timeout) clearTimeout(timeout);
    const details = await response.text().catch(() => '');
    throw new Error(`LM Studio returned HTTP ${response.status}${details ? `: ${details}` : ''}`);
  }

  if (!response.body) {
    if (timeout) clearTimeout(timeout);
    throw new Error('LM Studio returned an empty streaming response.');
  }

  let fullText = '';
  let buffer = '';
  let inThinkBlock = false;
  const decoder = new TextDecoder();

  const emit = (type, content) => {
    if (!content) return;
    if (type === 'chunk') fullText += content;
    onChunk({ type, content });
  };

  const emitContent = (text) => {
    let remaining = text;

    while (remaining) {
      if (inThinkBlock) {
        const end = remaining.indexOf('</think>');
        if (end === -1) {
          emit('reasoning', remaining);
          return;
        }

        emit('reasoning', remaining.slice(0, end));
        remaining = remaining.slice(end + '</think>'.length);
        inThinkBlock = false;
        continue;
      }

      const start = remaining.indexOf('<think>');
      if (start === -1) {
        emit('chunk', remaining);
        return;
      }

      emit('chunk', remaining.slice(0, start));
      remaining = remaining.slice(start + '<think>'.length);
      inThinkBlock = true;
    }
  };

  const handleEvent = (eventText) => {
    const data = eventText
      .split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.replace(/^data:\s?/, ''))
      .join('\n')
      .trim();

    if (!data || data === '[DONE]') return;

    let payload;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }

    const choice = payload.choices?.[0] || {};
    const delta = choice.delta || {};
    const message = choice.message || {};
    const reasoning = [
      delta.reasoning_content,
      delta.reasoning,
    ].find(value => typeof value === 'string' && value.length) || '';
    const content = [
      delta.content,
      message.content,
      choice.text,
    ].find(value => typeof value === 'string' && value.length) || '';

    emit('reasoning', reasoning);
    emitContent(content);
  };

  try {
    for await (const chunk of response.body) {
      resetTimeout();
      buffer += decoder.decode(chunk, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop();
      events.forEach(handleEvent);
    }

    buffer += decoder.decode();
    if (buffer.trim()) handleEvent(buffer);
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  return fullText;
}

function getLMSClient() {
  const cfg = getConfig();
  const baseUrl = cfg.baseUrl || 'http://localhost:1234/v1';
  const wsUrl = baseUrl.replace(/^http/, 'ws').replace(/\/v1\/?$/, '');
  return new LMStudioClient({ baseUrl: wsUrl });
}

async function loadModel(modelId) {
  const client = getLMSClient();
  await client.llm.load(modelId);
}

async function unloadModel(modelId) {
  const client = getLMSClient();
  await client.llm.unload(modelId);
}

module.exports = { listModels, checkHealth, streamTurn, loadModel, unloadModel };
