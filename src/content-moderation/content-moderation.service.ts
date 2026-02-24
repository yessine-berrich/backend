// src/content-moderation/content-moderation.service.ts
import { Injectable } from '@nestjs/common';
import { Ollama } from 'ollama'; // ou ton client existant

@Injectable()
export class ContentModerationService {
  private ollama = new Ollama({ host: 'http://localhost:11434' });
  private model = 'llama3.2:3b'; // llama3.2:3b (plus rapide) / llama-guard3:8b

  private readonly MODERATION_SCHEMA = {
    type: 'object',
    properties: {
      isFlagged: { type: 'boolean' },
      score: { type: 'number', minimum: 0, maximum: 1 },
      categories: {
        type: 'array',
        items: { type: 'string' },
        enum: [
          'toxicity',
          'severe_toxicity',
          'obscene',
          'threat',
          'insult',
          'identity_hate',
          'sexual_content',
          'violence',
          'spam',
          'hate_speech',
          'harassment',
        ],
      },
      reason: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['isFlagged', 'score', 'categories', 'confidence'],
    additionalProperties: false,
  };

  async moderate(title: string, content: string): Promise<any> {
    const text = `Titre: ${title}\n\nContenu:\n${content}`;

    const response = await this.ollama.chat({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `Tu es un modérateur de contenu strict mais juste.
Analyse le texte et réponds UNIQUEMENT avec un JSON respectant le schéma fourni.
Règles :
- score : probabilité globale de contenu problématique (0.0 = parfait, 1.0 = très grave)
- isFlagged : true si score > 0.3 ou présence de catégories graves
- categories : liste des problèmes détectés
- reason : explication courte en français (max 2 phrases)
- confidence : à quel point tu es sûr de ton analyse`,
        },
        { role: 'user', content: text },
      ],
      format: this.MODERATION_SCHEMA,   // ← Structured Output (Ollama ≥ 0.3.12)
      stream: false,
    });

    const result = JSON.parse(response.message.content);
    result.model = this.model;
    result.moderatedAt = new Date();

    return result;
  }
}