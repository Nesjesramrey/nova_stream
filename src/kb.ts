import {
    BedrockAgentRuntimeClient,
    RetrieveAndGenerateCommand
  } from "@aws-sdk/client-bedrock-agent-runtime";
import { config } from './config';
  
  const client = new BedrockAgentRuntimeClient({ region: "us-east-1" });
  
  export async function queryKnowledgeBase(question: string): Promise<string> {
    const command = new RetrieveAndGenerateCommand({
      input: { text: question },
      retrieveAndGenerateConfiguration: {
        type: "KNOWLEDGE_BASE",
        knowledgeBaseConfiguration: {
          knowledgeBaseId: config.knowledgeBase.id,
          modelArn: "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0",
          retrievalConfiguration: {
            vectorSearchConfiguration: {
              numberOfResults: 5
            }
          },
          generationConfiguration: {
            inferenceConfig: {
              textInferenceConfig: {
                temperature: 0.0,
                topP: 0.9,
                maxTokens: 512,
                stopSequences: []
              }
            }
          }
        }
      }
    });
  
    const response = await client.send(command);
    return response.output?.text ?? "No se encontró una respuesta en la base de conocimiento.";
  }
  