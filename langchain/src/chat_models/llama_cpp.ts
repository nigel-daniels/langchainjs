import { LlamaModel, LlamaContext, LlamaChatSession } from "node-llama-cpp";
import { SimpleChatModel, BaseChatModelParams } from "./base.js";
import { BaseLanguageModelCallOptions } from "../base_language/index.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import { BaseMessage } from "../schema/index.js";

/**
 * Note that the modelPath is the only required parameter. For testing you
 * can set this in the environment variable `LLAMA_PATH`.
 */
export interface LlamaCppInputs extends BaseChatModelParams {
  /** Prompt processing batch size. */
  batchSize?: number;
  /** Text context size. */
  contextSize?: number;
  /** Embedding mode only. */
  embedding?: boolean;
  /** Use fp16 for KV cache. */
  f16Kv?: boolean;
  /** Number of layers to store in VRAM. */
  gpuLayers?: number;
  /** The llama_eval() call computes all logits, not just the last one. */
  logitsAll?: boolean;
  /** If true, reduce VRAM usage at the cost of performance. */
  lowVram?: boolean;
  /** Path to the model on the filesystem. */
  modelPath: string;
  /** If null, a random seed will be used. */
  seed?: null | number;
  /** The randomness of the responses, e.g. 0.1 deterministic, 1.5 creative, 0.8 balanced, 0 disables. */
  temperature?: number;
  /** Consider the n most likely tokens, where n is 1 to vocabulary size, 0 disables (uses full vocabulary). Note: only applies when `temperature` > 0. */
  topK?: number;
  /** Selects the smallest token set whose probability exceeds P, where P is between 0 - 1, 1 disables. Note: only applies when `temperature` > 0. */
  topP?: number;
  /** Force system to keep model in RAM. */
  useMlock?: boolean;
  /** Use mmap if possible. */
  useMmap?: boolean;
  /** Only load the vocabulary, no weights. */
  vocabOnly?: boolean;
}

export interface LlamaCppCallOptions extends BaseLanguageModelCallOptions {
  /** The maximum number of tokens the response should contain. */
  maxTokens?: number;
  /** A function called when matching the provided token array */
  onToken?: (tokens: number[]) => void;
}

/**
 *  To use this model you need to have the `node-llama-cpp` module installed.
 *  This can be installed using `npm install -S node-llama-cpp` and the minimum
 *  version supported in version 2.0.0.
 *  This also requires that have a locally built version of Llama2 installed.
 */
export class ChatLlamaCpp extends SimpleChatModel<LlamaCppCallOptions> {
  declare CallOptions: LlamaCppCallOptions;

  static inputs: LlamaCppInputs;

  batchSize?: number;

  contextSize?: number;

  embedding?: boolean;

  f16Kv?: boolean;

  gpuLayers?: number;

  logitsAll?: boolean;

  lowVram?: boolean;

  seed?: null | number;

  useMlock?: boolean;

  useMmap?: boolean;

  vocabOnly?: boolean;

  modelPath: string;

  _model: LlamaModel;

  _context: LlamaContext;

  _session: LlamaChatSession;

  static lc_name() {
    return "LlamaCpp";
  }

  constructor(inputs: LlamaCppInputs) {
    super(inputs);
    this.batchSize = inputs.batchSize;
    this.contextSize = inputs.contextSize;
    this.embedding = inputs.embedding;
    this.f16Kv = inputs.f16Kv;
    this.gpuLayers = inputs.gpuLayers;
    this.logitsAll = inputs.logitsAll;
    this.lowVram = inputs.lowVram;
    this.modelPath = inputs.modelPath;
    this.seed = inputs.seed;
    this.useMlock = inputs.useMlock;
    this.useMmap = inputs.useMmap;
    this.vocabOnly = inputs.vocabOnly;
    this._model = new LlamaModel(inputs);
    this._context = new LlamaContext({ model: this._model });
  }

  _llmType() {
    return "llama2_cpp";
  }

  invocationParams() {
    return {
      batchSize: this.batchSize,
      contextSize: this.contextSize,
      embedding: this.embedding,
      f16Kv: this.f16Kv,
      gpuLayers: this.gpuLayers,
      logitsAll: this.logitsAll,
      lowVram: this.lowVram,
      modelPath: this.modelPath,
      seed: this.seed,
      useMlock: this.useMlock,
      useMmap: this.useMmap,
      vocabOnly: this.vocabOnly,
    };
  }

  /** @ignore */
  _combineLLMOutput() {
    return {};
  }

  /** @ignore */
  async _call(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    // Let's see if we need to instanciate the session
    if (!this._session) {
      // If we do need to instanciate we'd better check for a system message
      const sysMessages = messages.filter(
        (message) => message._getType() === "system"
      );

      if (sysMessages.length > 0) {
        this._session = new LlamaChatSession({
          context: this._context,
          systemPrompt: sysMessages[0].content,
        });
      } else {
        this._session = new LlamaChatSession({ context: this._context });
      }
    }

    // Build a prompt string
    const prompt = this._convertMessagesToPrompt(messages);

    try {
      const completion = await this._session.prompt(prompt, options);
      return completion;
    } catch (e) {
      throw new Error("Error getting prompt completion.");
    }
  }

  // This builds a simple string from the prompts
  protected _convertMessagesToPrompt(messages: BaseMessage[]): string {
    const result = messages
      .map((message) => {
        let text = "";

        if (message._getType() === "human") {
          text = text.concat(message.content);
        } else if (message._getType() === "ai") {
          text = text.concat(message.content);
        }

        return text;
      })
      .join("\n");

    return result;
  }
}
