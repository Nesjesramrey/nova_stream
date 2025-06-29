import { AudioType, AudioMediaType, TextMediaType } from "./types";

export const DefaultInferenceConfiguration = {
  maxTokens: 250,
  topP: 0.9,
  temperature: 0.7,
};

export const DefaultAudioInputConfiguration = {
  audioType: "SPEECH" as AudioType,
  encoding: "base64",
  mediaType: "audio/lpcm" as AudioMediaType,
  sampleRateHertz: 16000,
  sampleSizeBits: 16,
  channelCount: 1,
};

export const DefaultToolSchema = JSON.stringify({
  "type": "object",
  "properties": {},
  "required": []
});

export const WeatherToolSchema = JSON.stringify({
  "type": "object",
  "properties": {
    "latitude": {
      "type": "string",
      "description": "Geographical WGS84 latitude of the location."
    },
    "longitude": {
      "type": "string",
      "description": "Geographical WGS84 longitude of the location."
    }
  },
  "required": ["latitude", "longitude"]
});

export const KnowledgeBaseToolSchema = JSON.stringify({
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "The user question about employment benefit policies"
    }
  },
  "required": ["query"]
});

export const SharePointToolSchema = JSON.stringify({
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "The user question to search in SharePoint documents"
    }
  },
  "required": ["query"]
});

export const DefaultTextConfiguration = { mediaType: "text/plain" as TextMediaType };

export const DefaultSystemPrompt = `
Eres un asistente general. Responde SIEMPRE con máximo 2-3 oraciones. Sé directo y conciso.

## Reglas importantes:
- NUNCA excedas 3 oraciones por respuesta
- Respuestas cortas y directas
- Conversación profesional pero amigable
- Si no sabes algo, di "No tengo esa información"

## Después de responder:
- Haz UNA pregunta corta para continuar la conversación
- Promueve más preguntas sobre temas relevantes

## Al terminar:
Cuando el usuario termine, agradece brevemente.

`;






export const DefaultAudioOutputConfiguration = {
  ...DefaultAudioInputConfiguration,
  sampleRateHertz: 24000,
  voiceId: "lupe",
};