// Enhanced JobManager.js - Fixed Version with Queue Management
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// 🔄 Request Queue Manager - Complete Implementation
class RequestQueueManager {
  constructor(maxConcurrency = 2, delayBetweenRequests = 1000) {
    this.maxConcurrency = maxConcurrency;
    this.delayBetweenRequests = delayBetweenRequests;
    this.activeRequests = 0;
    this.queue = [];
    this.lastRequestTime = 0;
    
    console.log(`🔧 RequestQueueManager initialized: ${maxConcurrency} concurrent, ${delayBetweenRequests}ms delay`);
  }

  async addToQueue(requestFunction) {
    return new Promise((resolve, reject) => {
      const task = {
        execute: requestFunction,
        resolve,
        reject,
        retryCount: 0,
        maxRetries: 5,
        addedAt: Date.now(),
        id: Math.random().toString(36).substr(2, 9)
      };
      
      this.queue.push(task);
      console.log(`📝 Added task ${task.id} to queue. Queue length: ${this.queue.length}`);
      
      this.processQueue();
    });
  }

  async processQueue() {
    // Process MULTIPLE tasks up to maxConcurrency
    while (this.activeRequests < this.maxConcurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      
      // ✅ KHÔNG AWAIT - spawn concurrent tasks
      this.processTask(task); // Runs in parallel
    }
  }

  async processTask(task) {
    this.activeRequests++;
    
    try {
      const result = await this.executeWithRetry(task);
      task.resolve(result);
    } finally {
      this.activeRequests--;
      setImmediate(() => this.processQueue()); // Continue processing immediately
    }
  }

  async executeWithRetry(task) {
    let lastError;
    
    for (let attempt = 0; attempt <= task.maxRetries; attempt++) {
      try {
        const result = await task.execute();
        
        if (attempt > 0) {
          console.log(`✅ Task ${task.id} succeeded on attempt ${attempt + 1}/${task.maxRetries + 1}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        task.retryCount = attempt + 1;
        
        console.warn(`⚠️ Task ${task.id} attempt ${attempt + 1}/${task.maxRetries + 1} failed:`, error.message);

        if (attempt < task.maxRetries) {
          const baseDelay = Math.pow(2, attempt) * 1000;
          const jitter = Math.random() * 1000;
          const totalDelay = baseDelay + jitter;
          
          console.log(`⏳ Task ${task.id} retrying in ${Math.round(totalDelay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, totalDelay));
        }
      }
    }
    
    throw lastError;
  }

  getStats() {
    return {
      activeRequests: this.activeRequests,
      queueLength: this.queue.length,
      maxConcurrency: this.maxConcurrency,
      delayBetweenRequests: this.delayBetweenRequests
    };
  }
}

// APIConfigManager - Unchanged
class APIConfigManager {
  constructor() {
    this.config = null;
    console.log(`🔍 APIConfigManager initialized for dynamic configuration`);
  }

  getConfigForRequest(isHDMode = false, selectedModel = 'claude-sonnet') {
    console.log(`🔍 Getting config for HD:${isHDMode}, Model:${selectedModel}`);

    if (selectedModel === 'claude-sonnet') {
      return {
        promptMode: 'claude',
        model: 'claude-sonnet-4-20250514',
        apiKey: process.env.CLAUDE_API_KEY,
        imageMode: isHDMode ? 'unofficial' : 'official',
        imageConfig: this.getImageConfig(isHDMode)
      };
    } else if (selectedModel === 'deepsearch') {
      return {
        promptMode: 'deepseek',
        model: 'deepseek-chat',
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com/v1',
        imageMode: isHDMode ? 'unofficial' : 'official',
        imageConfig: this.getImageConfig(isHDMode)
      };
    }

    throw new Error(`Unsupported model: ${selectedModel}`);
  }

  getImageConfig(isHDMode) {
    if (isHDMode) {
      const subKey = process.env.OPENAI_API_SUB_KEY;
      if (!subKey) {
        throw new Error('HD Mode requires OPENAI_API_SUB_KEY');
      }

      return {
        mode: 'unofficial',
        baseURL: 'https://api.piapi.ai/v1/',
        endpoint: 'chat/completions',
        model: 'gpt-4o-image',
        keys: [subKey]
      };
    } else {
      const officialKeys = [
        process.env.OPENAI_API_KEY_1,
        process.env.OPENAI_API_KEY_2,
        process.env.OPENAI_API_KEY_3,
        process.env.OPENAI_API_KEY_4,
        process.env.OPENAI_API_KEY_5,
      ].filter(Boolean);

      if (officialKeys.length === 0) {
        throw new Error('Official OpenAI mode requires at least one OPENAI_API_KEY');
      }

      return {
        mode: 'official',
        baseURL: 'https://api.openai.com/v1/',
        endpoint: 'images/generations',
        model: 'gpt-image-1',
        keys: officialKeys
      };
    }
  }
}

// 🔄 FIXED: APIKeyRotationManager
class APIKeyRotationManager {
  constructor(config) {
    this.config = config;
    this.apiKeys = [];
    this.currentIndex = 0;
    
    // ✅ FIX: Initialize requestQueue properly
    const queueConfig = this.getQueueConfigForMode(config.mode);
    this.requestQueue = new RequestQueueManager(
      queueConfig.maxConcurrency, 
      queueConfig.delayBetweenRequests
    );
    
    this.initializeKeys();
    
    console.log(`🔧 APIKeyRotationManager initialized:`, {
      mode: config.mode,
      totalKeys: config.keys?.length || 0,
      hasRequestQueue: !!this.requestQueue,
      queueMaxConcurrency: queueConfig.maxConcurrency,
      queueDelay: queueConfig.delayBetweenRequests
    });
  }

  getQueueConfigForMode(mode) {
    if (mode === 'unofficial') {
      return {
        maxConcurrency: 1,
        delayBetweenRequests: 2000
      };
    } else {
      return {
        maxConcurrency: 2,
        delayBetweenRequests: 1500
      };
    }
  }

  initializeKeys() {
    if (this.config.mode === 'unofficial') {
      this.apiKeys = [{
        id: 0,
        key: this.config.keys[0],
        status: 'available',
        lastUsed: null,
        requestCount: 0,
        errorCount: 0,
        successCount: 0,
        rateLimitResetTime: null,
        consecutiveErrors: 0,
        client: new OpenAI({
          apiKey: this.config.keys[0],
          baseURL: this.config.baseURL
        })
      }];
    } else {
      this.apiKeys = this.config.keys.map((key, index) => ({
        id: index,
        key: key,
        status: 'available',
        lastUsed: null,
        requestCount: 0,
        errorCount: 0,
        successCount: 0,
        rateLimitResetTime: null,
        consecutiveErrors: 0,
        client: new OpenAI({
          apiKey: key,
          baseURL: this.config.baseURL
        })
      }));
    }
  }

  async getAvailableKey() {
    if (this.config.mode === 'unofficial') {
      const key = this.apiKeys[0];
      
      if (key.consecutiveErrors >= 5) {
        const timeSinceLastError = Date.now() - (key.lastUsed || 0);
        if (timeSinceLastError < 6000000) {
          throw new Error('API key temporarily blocked due to consecutive errors');
        }
        key.consecutiveErrors = 0;
      }
      
      key.status = 'in_use';
      key.lastUsed = Date.now();
      key.requestCount++;
      return key;
    }

    let attempts = 0;
    const maxAttempts = this.apiKeys.length * 2;

    while (attempts < maxAttempts) {
      const keyInfo = this.apiKeys[this.currentIndex];

      if (this.isKeyAvailable(keyInfo)) {
        keyInfo.status = 'in_use';
        keyInfo.lastUsed = Date.now();
        keyInfo.requestCount++;

        this.currentIndex = (this.currentIndex + 1) % this.apiKeys.length;
        return keyInfo;
      }

      this.currentIndex = (this.currentIndex + 1) % this.apiKeys.length;
      attempts++;

      if (attempts === this.apiKeys.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const lruKey = this.getLeastRecentlyUsedKey();
    lruKey.status = 'in_use';
    lruKey.lastUsed = Date.now();
    lruKey.requestCount++;
    return lruKey;
  }

  isKeyAvailable(keyInfo) {
    const now = Date.now();

    if (keyInfo.consecutiveErrors >= 3) {
      const timeSinceLastError = now - (keyInfo.lastUsed || 0);
      if (timeSinceLastError < 180000) {
        return false;
      }
      keyInfo.consecutiveErrors = 0;
    }

    if (keyInfo.errorCount >= 5) {
      if (now - (keyInfo.lastUsed || 0) < 300000) {
        return false;
      }
      keyInfo.errorCount = Math.max(0, keyInfo.errorCount - 1);
    }

    if (keyInfo.rateLimitResetTime && now < keyInfo.rateLimitResetTime) {
      return false;
    }

    return keyInfo.status === 'available' ||
      (keyInfo.status === 'in_use' && now - (keyInfo.lastUsed || 0) > 90000);
  }

  getLeastRecentlyUsedKey() {
    return this.apiKeys.reduce((lru, current) => {
      if (current.consecutiveErrors < lru.consecutiveErrors) return current;
      if (current.consecutiveErrors > lru.consecutiveErrors) return lru;
      
      if (!lru.lastUsed) return current;
      if (!current.lastUsed) return lru;
      return current.lastUsed < lru.lastUsed ? current : lru;
    });
  }

  releaseKey(keyInfo, success = true, error = null) {
    keyInfo.status = 'available';

    if (success) {
      keyInfo.successCount++;
      keyInfo.consecutiveErrors = 0;
      keyInfo.errorCount = Math.max(0, keyInfo.errorCount - 1);
    } else {
      keyInfo.errorCount++;
      keyInfo.consecutiveErrors++;

      if (error && error.response?.status === 429) {
        keyInfo.status = 'rate_limited';
        keyInfo.rateLimitResetTime = Date.now() + 600000;
      } else if (error && error.response?.status >= 500) {
        keyInfo.status = 'error';
      } else if (error && error.response?.status === 401) {
        keyInfo.status = 'invalid';
        keyInfo.rateLimitResetTime = Date.now() + 3600000;
      }
    }
  }

  getStats() {
    return {
      mode: this.config.mode,
      totalKeys: this.apiKeys.length,
      availableKeys: this.apiKeys.filter(k => this.isKeyAvailable(k)).length,
      queue: this.requestQueue ? this.requestQueue.getStats() : null,
      keys: this.apiKeys.map(k => ({
        id: k.id,
        status: k.status,
        requestCount: k.requestCount,
        successCount: k.successCount,
        errorCount: k.errorCount,
        consecutiveErrors: k.consecutiveErrors,
        successRate: k.requestCount > 0 ? Math.round((k.successCount / k.requestCount) * 100) : 0,
        lastUsed: k.lastUsed ? new Date(k.lastUsed).toLocaleTimeString() : 'Never'
      }))
    };
  }
}

// 🔄 ENHANCED: JobManager
export class JobManager {
  constructor() {
    const configManager = new APIConfigManager();
    this.configManager = configManager;
    this.apiManager = null;
    this.jobs = new Map();
    this.maxRetries = 3;
    this.startCleanupInterval();
  }

  async createJob(sessionId, userPrompt, numberOfImages, imageSizesString, selectedQuality, selectedCategory, selectedModel = 'claude-sonnet', isHDMode = false) {
    const jobId = uuidv4();

    console.log(`🔍 Creating job with model:${selectedModel}, HD:${isHDMode}`);

    const job = {
      id: jobId,
      status: 'pending',
      sessionId,
      userPrompt,
      numberOfImages,
      imageSizesString,
      selectedQuality,
      selectedCategory,
      selectedModel,
      isHDMode,
      results: [],
      claudeResponse: '',
      progress: {
        total: numberOfImages,
        completed: 0,
        failed: 0,
        currentStep: 'Starting...'
      },
      retryCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.jobs.set(jobId, job);

    this.processJob(jobId).catch(error => {
      console.error(`Job ${jobId} processing failed:`, error);
      this.updateJobStatus(jobId, 'failed', error.message);
    });

    return jobId;
  }

  async processJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    console.log(`🎯 Processing job: ${jobId} with model: ${job.selectedModel}, HD: ${job.isHDMode}`);

    this.updateJobStatus(jobId, 'processing');
    job.progress.currentStep = 'Generating prompts...';

    try {
      if (job.status === 'cancelled') return;

      let promptResponse = '';
      let parsedResponse = null;

      const config = this.configManager.getConfigForRequest(job.isHDMode, job.selectedModel);

      // Generate prompts
      if (config.promptMode === 'claude') {
        promptResponse = await this.callClaudeAPI(job);
      } else if (config.promptMode === 'deepseek') {
        promptResponse = await this.callDeepSeekAPI(job);
      } else {
        throw new Error(`Unsupported prompt mode: ${config.promptMode}`);
      }

      job.claudeResponse = promptResponse;
      parsedResponse = this.parsePromptResponse(promptResponse, job.selectedCategory.category);

      if (job.status === 'cancelled') return;

      job.progress.total = parsedResponse.prompts.length;
      job.progress.currentStep = 'Generating images...';

      // ✅ FIX: Initialize apiManager with proper error checking
      try {
        this.apiManager = new APIKeyRotationManager(config.imageConfig);
        console.log(`🔧 API Manager initialized:`, {
          hasRequestQueue: !!this.apiManager.requestQueue,
          mode: config.imageConfig.mode
        });
      } catch (error) {
        console.error(`❌ Failed to initialize API Manager:`, error);
        throw new Error(`API Manager initialization failed: ${error.message}`);
      }

      // Process images with queue
      const imagePromises = [];
      
      for (let i = 0; i < parsedResponse.prompts.length; i++) {
        if (job.status === 'cancelled') return;

        const promptData = parsedResponse.prompts[i];

        // Size mapping logic
        if (!promptData.size || promptData.size === "Square") {
          const sizes = job.imageSizesString.split(',').map(s => s.trim());
          if (sizes[i] && sizes[i] !== 'auto') {
            promptData.size = sizes[i];
          } else {
            const sizesArray = [];
            for (let j = 0; j < job.numberOfImages; j++) {
              if (job.imageSizesString.includes('Square')) sizesArray.push('Square');
              if (job.imageSizesString.includes('Portrait')) sizesArray.push('Portrait');
              if (job.imageSizesString.includes('Landscape')) sizesArray.push('Landscape');
            }
            promptData.size = sizesArray[i] || 'Square';
          }
        }

        // ✅ FIX: Add validation and better error handling
        const imagePromise = this.generateImageWithQueue(promptData, job, config.imageConfig, i);
        imagePromises.push(imagePromise);
      }

      // Wait for all images
      const settledResults = await Promise.allSettled(imagePromises);
      const results = [];

      for (let i = 0; i < settledResults.length; i++) {
        const result = settledResults[i];
        
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
          job.progress.completed++;
        } else {
          job.progress.failed++;
          console.warn(`❌ Image ${i + 1} failed:`, result.reason?.message || 'Unknown error');
        }
        
        job.updatedAt = Date.now();
      }

      // ✅ Only save successful images
      job.results = results;

      if (results.length > 0) {
        this.updateJobStatus(jobId, 'completed');
        console.log(`✅ Job ${jobId} completed with ${results.length}/${parsedResponse.prompts.length} successful images`);
      } else {
        this.updateJobStatus(jobId, 'failed', 'No images were successfully generated');
        console.log(`❌ Job ${jobId} failed - no successful images`);
      }

    } catch (error) {
      console.error(`💥 Job ${jobId} processing failed:`, error);
      this.updateJobStatus(jobId, 'failed', error.message);
    }
  }

  // ✅ FIX: Better error handling for queue
  async generateImageWithQueue(promptData, job, imageConfig, index) {
    try {
      // Validate apiManager and requestQueue
      if (!this.apiManager) {
        throw new Error('API Manager not initialized');
      }
      
      if (!this.apiManager.requestQueue) {
        throw new Error('Request queue not initialized');
      }

      const requestFunction = async () => {
        return await this.generateSingleImage(promptData, job, imageConfig, index);
      };

      return await this.apiManager.requestQueue.addToQueue(requestFunction);
    } catch (error) {
      console.error(`❌ generateImageWithQueue failed for image ${index + 1}:`, error);
      throw error;
    }
  }

  // ✅ RENAMED: generateSingleImageWithRetry -> generateSingleImage (no retry here, queue handles it)
  async generateSingleImage(promptData, job, imageConfig, index) {
    if (job.status === 'cancelled') throw new Error('Job cancelled');

    const keyInfo = await this.apiManager.getAvailableKey();

    try {
      console.log(`🎨 Generating image ${index + 1}:`, {
        apiMode: imageConfig.mode,
        model: imageConfig.model,
        promptLength: promptData.prompt.length,
        size: this.getSizeMapping(promptData.size),
        keyId: keyInfo.id
      });

      let response;

      if (imageConfig.mode === 'unofficial') {
        response = await this.generateImageWithPiapiChatCompletions(keyInfo, promptData, imageConfig);
      } else {
        const requestBody = {
          model: imageConfig.model,
          prompt: promptData.prompt,
          n: 1,
          size: this.getSizeMapping(promptData.size),
          quality: 'low',
          output_format: "png"
        };

        response = await keyInfo.client.images.generate(requestBody);
      }

      let imageData = this.extractImageDataFromResponse(response, imageConfig.mode);

      if (!imageData) {
        throw new Error('No image data found in response');
      }

      let imageBase64 = await this.convertImageDataToBase64(imageData);

      if (!imageBase64) {
        throw new Error('Failed to convert image data to base64');
      }

      this.apiManager.releaseKey(keyInfo, true);

      const result = {
        imageBase64,
        prompt: promptData.prompt,
        timestamp: new Date().toISOString(),
        size: promptData.size,
        quality: job.selectedQuality,
        imageName: promptData.imageName
      };

      if (promptData.adCreativeA) result.AdCreativeA = promptData.adCreativeA;
      if (promptData.adCreativeB) result.AdCreativeB = promptData.adCreativeB;
      if (promptData.targeting) result.targeting = promptData.targeting;

      console.log(`✅ Generated image ${index + 1} successfully`);
      return result;

    } catch (error) {
      console.error(`❌ Image ${index + 1} generation failed:`, error.message);
      this.apiManager.releaseKey(keyInfo, false, error);
      throw error;
    }
  }

  // Keep all other methods unchanged...
  async loadDeepseekInstruction(category = 'google_prompt') {
    try {
      const fs = await import('fs');
      const path = await import('path');

      const fileMapping = {
        'google_prompt': 'user_prompt_deepseek_google.txt',
        'facebook_prompt': 'user_prompt_deepseek_facebook.txt'
      };

      const filename = fileMapping[category];

      if (!filename) {
        console.warn(`⚠️ No Deepseek instruction file for category: ${category}`);
        return '';
      }

      const instructionsPath = path.join(process.cwd(), 'static', 'instructions', filename);

      console.log(`📄 Loading Deepseek instruction: ${filename}`);
      const content = fs.readFileSync(instructionsPath, 'utf8');

      console.log(`✅ Deepseek instruction loaded: ${content.length} characters`);
      return content;

    } catch (error) {
      console.error(`❌ Failed to load Deepseek instruction for ${category}:`, error);
      return '';
    }
  }

  async callDeepSeekAPI(job) {
    const maxRetries = this.maxRetries;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (job.status === 'cancelled') throw new Error('Job cancelled');

      try {
        job.progress.currentStep = `Deepseek generating... (attempt ${attempt}/${maxRetries})`;

        const systemInstruction = await this.loadInstructions(job.selectedCategory.category);
        const deepseekInstruction = await this.loadDeepseekInstruction(job.selectedCategory.category);

        let deepseekPrompt;
        if (deepseekInstruction && deepseekInstruction.trim()) {
          deepseekPrompt = `${deepseekInstruction}\n\n---\n\nUSER REQUEST:\n${job.userPrompt}\n\nOutput: ${job.numberOfImages}\nImage sizes: ${job.imageSizesString}`;
          console.log(`📝 Deepseek prompt with instruction: ${deepseekPrompt.length} characters`);
        } else {
          deepseekPrompt = `${job.userPrompt}\n\nOutput: ${job.numberOfImages}\n\nImage sizes: ${job.imageSizesString}`;
          console.log(`📝 Deepseek prompt without instruction: ${deepseekPrompt.length} characters`);
        }

        const messages = [];

        if (systemInstruction && systemInstruction.trim()) {
          messages.push({
            role: "system",
            content: systemInstruction
          });
          console.log(`📋 System instruction added: ${systemInstruction.length} characters`);
        }

        messages.push({
          role: "user",
          content: deepseekPrompt
        });

        const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
          model: "deepseek-chat",
          messages: messages,
          max_tokens: 8000,
          temperature: 0.7
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
          }
        });

        const responseContent = response.data.choices?.[0]?.message?.content || "No response from Deepseek";

        console.log(`✅ Deepseek API success (attempt ${attempt}):`, {
          responseLength: responseContent.length,
          hasSystemInstruction: !!systemInstruction,
          hasDeepseekInstruction: !!deepseekInstruction,
          messagesCount: messages.length,
          category: job.selectedCategory.category
        });

        return responseContent;

      } catch (error) {
        lastError = error;
        console.error(`❌ Deepseek API attempt ${attempt} failed:`, {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        });

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`⏳ Retrying Deepseek in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Deepseek API failed after retries');
  }

  async callClaudeAPI(job) {
    const maxRetries = this.maxRetries;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (job.status === 'cancelled') throw new Error('Job cancelled');

      try {
        job.progress.currentStep = `Claude Sonnet generating... (attempt ${attempt}/${maxRetries})`;

        const claudePrompt = `${job.userPrompt}\n\nOutput: ${job.numberOfImages}\n\nImage sizes: ${job.imageSizesString}`;

        const response = await axios.post('https://api.anthropic.com/v1/messages', {
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          messages: [{ role: "user", content: claudePrompt }],
          system: await this.loadInstructions(job.selectedCategory.category)
        }, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.CLAUDE_API_KEY,
            'anthropic-version': '2023-06-01'
          }
        });

        return response.data.content?.[0]?.text || "No response from Claude";

      } catch (error) {
        lastError = error;
        console.error(`Claude API attempt ${attempt} failed:`, error.message);

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Claude API failed after retries');
  }

  async generateImageWithPiapiChatCompletions(keyInfo, promptData, imageConfig) {
    const requestBody = {
      model: imageConfig.model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: promptData.prompt
            }
          ],
        }
      ],
      modalities: ["image"],
      stream: false
    };

    console.log(`🔍 PIAPI CHAT COMPLETIONS REQUEST:`, {
      endpoint: `${imageConfig.baseURL}${imageConfig.endpoint}`,
      model: imageConfig.model,
      promptPreview: promptData.prompt.substring(0, 100)
    });

    const response = await axios.post(`${imageConfig.baseURL}${imageConfig.endpoint}`, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyInfo.key ? keyInfo.key : "94cf59f40c4815f3509e794efcd3aa7266646024e00a0656a58b1e43346eb9fe"}`
      }
    });

    console.log(`✅ PIAPI response received:`, {
      status: response.status,
      hasData: !!response.data,
    });

    return response.data;
  }

  extractImageDataFromResponse(response, mode) {
    if (!response) return null;

    if (mode === 'unofficial') {
      if (typeof response === 'string') {
        const theapiUrlMatch = response.match(/https:\/\/storage\.theapi\.app\/image\/gen-[a-f0-9-]+\.png/);
        if (theapiUrlMatch) {
          return { url: theapiUrlMatch[0] };
        }
      }

      if (typeof response === 'string' && response.includes('storage.theapi.app')) {
        try {
          const theapiUrlMatch = response.match(/https:\/\/storage\.theapi\.app\/image\/gen-[a-f0-9-]+\.png/);
          if (theapiUrlMatch) {
            return { url: theapiUrlMatch[0] };
          }
        } catch (error) {
          console.error('Error parsing response string:', error);
        }
      }

      if (response.choices && response.choices.length > 0) {
        const message = response.choices[0].message;

        if (message && message.content && typeof message.content === 'string') {
          const markdownMatch = message.content.match(/!\[.*?\]\((https:\/\/storage\.theapi\.app\/image\/gen-[a-f0-9-]+\.png)\)/);
          if (markdownMatch && markdownMatch[1]) {
            return { url: markdownMatch[1] };
          }
        }

        if (message && message.content && Array.isArray(message.content)) {
          for (const part of message.content) {
            if (part.type === 'text' && part.text) {
              const markdownMatch = part.text.match(/!\[.*?\]\((https:\/\/storage\.theapi\.app\/image\/gen-[a-f0-9-]+\.png)\)/);
              if (markdownMatch && markdownMatch[1]) {
                return { url: markdownMatch[1] };
              }

              const directUrlMatch = part.text.match(/https:\/\/storage\.theapi\.app\/image\/gen-[a-f0-9-]+\.png/);
              if (directUrlMatch) {
                return { url: directUrlMatch[0] };
              }
            }

            if (part.image_url) return { url: part.image_url.url };
            if (part.image) return { data_url: part.image };
            if (part.url) return { url: part.url };
          }
        }

        if (response.choices[0].delta && response.choices[0].delta.content) {
          const content = response.choices[0].delta.content;
          const markdownMatch = content.match(/!\[.*?\]\((https:\/\/storage\.theapi\.app\/image\/gen-[a-f0-9-]+\.png)\)/);
          if (markdownMatch && markdownMatch[1]) {
            return { url: markdownMatch[1] };
          }
        }
      }

      if (response.data && response.data.url) return { url: response.data.url };
      if (response.data && response.data.b64_json) return { b64_json: response.data.b64_json };
      if (response.url) return { url: response.url };
      if (response.b64_json) return { b64_json: response.b64_json };
      if (response.image_url) return { url: response.image_url };
      if (response.image) return { data_url: response.image };

    } else {
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        return response.data[0];
      } else if (response.data && !Array.isArray(response.data)) {
        return response.data;
      } else if (response.image) {
        return response.image;
      } else if (response.images && Array.isArray(response.images)) {
        return response.images[0];
      }
    }

    return null;
  }

  async convertImageDataToBase64(imageData) {
    if (!imageData) return null;

    if (imageData.specialImageUrl) {
      try {
        return await this.convertUrlToBase64(imageData.specialImageUrl);
      } catch (error) {
        console.error('Failed to convert special URL to base64:', error);
        return null;
      }
    }

    if (imageData.data_url && typeof imageData.data_url === 'string' &&
      imageData.data_url.startsWith('data:image')) {
      return imageData.data_url;
    }

    if (imageData.b64_json) {
      return `data:image/png;base64,${imageData.b64_json}`;
    }

    if (imageData.url) {
      try {
        return await this.convertUrlToBase64(imageData.url);
      } catch (error) {
        console.error('Failed to convert URL to base64:', error);
        return null;
      }
    }

    if (imageData.directUrl) {
      try {
        return await this.convertUrlToBase64(imageData.directUrl);
      } catch (error) {
        console.error('Failed to convert direct URL to base64:', error);
        return null;
      }
    }

    if (typeof imageData === 'string') {
      if (imageData.startsWith('data:image')) {
        return imageData;
      } else if (imageData.startsWith('http')) {
        try {
          return await this.convertUrlToBase64(imageData);
        } catch (error) {
          console.error('Failed to convert string URL to base64:', error);
          return null;
        }
      }
    }

    return null;
  }

  async loadInstructions(category = 'google_prompt') {
    try {
      const fs = await import('fs');
      const path = await import('path');

      const fileMapping = {
        'google_prompt': 'instructions_google_prompt.txt',
        'facebook_prompt': 'instructions_facebook_prompt.txt',
        'default': 'instructions.txt'
      };

      const filename = fileMapping[category] || fileMapping['google_prompt'];
      const instructionsPath = path.join(process.cwd(), 'static', 'instructions', filename);

      return fs.readFileSync(instructionsPath, 'utf8');
    } catch (error) {
      return "You are an AI assistant that helps generate image prompts.";
    }
  }

  parsePromptResponse(response, category = 'google_prompt') {
    try {
      const jsonArrayMatch = response.match(/\[\s*\{[\s\S]*?\}\s*\]/);

      if (jsonArrayMatch) {
        const jsonData = JSON.parse(jsonArrayMatch[0]);

        if (Array.isArray(jsonData) && jsonData.length > 0) {
          const firstObject = jsonData[0];
          const sharedTargeting = firstObject.targeting || "";
          const sharedAdCreativeA = firstObject.adCreativeA || "";
          const sharedAdCreativeB = firstObject.adCreativeB || "";

          console.log(`📋 Shared data for ${category}:`, {
            hasSharedTargeting: !!sharedTargeting,
            hasSharedAdCreativeA: !!sharedAdCreativeA,
            hasSharedAdCreativeB: !!sharedAdCreativeB
          });

          const prompts = jsonData.map((item, index) => {
            const basePrompt = {
              prompt: item.prompt || `Generated prompt ${index + 1}`,
              imageName: item.imageName || `ai-image-${index + 1}-${Date.now()}`,
              size: item.size || "Square",
              adCreativeA: "",
              adCreativeB: "",
              targeting: ""
            };

            if (category === 'facebook_prompt') {
              if (index === 0) {
                basePrompt.adCreativeA = item.adCreativeA || "";
                basePrompt.adCreativeB = item.adCreativeB || "";
                basePrompt.targeting = item.targeting || "";
              } else {
                basePrompt.adCreativeA = item.adCreativeA || "";
                basePrompt.adCreativeB = item.adCreativeB || "";
                basePrompt.targeting = sharedTargeting;
              }
            } else if (category === 'google_prompt') {
              if (index === 0) {
                basePrompt.adCreativeA = item.adCreativeA || "";
                basePrompt.adCreativeB = item.adCreativeB || "";
                basePrompt.targeting = item.targeting || "";
              } else {
                basePrompt.adCreativeA = sharedAdCreativeA;
                basePrompt.adCreativeB = sharedAdCreativeB;
                basePrompt.targeting = sharedTargeting;
              }
            }

            console.log(`📝 Parsed item ${index + 1} for ${category}:`, {
              hasPrompt: !!basePrompt.prompt,
              hasImageName: !!basePrompt.imageName,
              hasAdCreativeA: !!basePrompt.adCreativeA,
              hasAdCreativeB: !!basePrompt.adCreativeB,
              hasTargeting: !!basePrompt.targeting,
              isSharedData: index > 0
            });

            return basePrompt;
          });

          console.log(`✅ Total parsed prompts for ${category}:`, prompts.length);
          return { prompts };
        }
      }

      console.warn('⚠️ No JSON array found in response, using fallback');
      return {
        prompts: [{
          prompt: response,
          adCreativeA: "",
          adCreativeB: "",
          imageName: `ai-image-fallback-${Date.now()}`,
          targeting: "",
          size: "Square"
        }]
      };

    } catch (error) {
      console.error('❌ Error parsing response:', error);
      return {
        prompts: [{
          prompt: response,
          adCreativeA: "",
          adCreativeB: "",
          imageName: `ai-image-fallback-${Date.now()}`,
          targeting: "",
          size: "Square"
        }]
      };
    }
  }

  getSizeMapping(size) {
    const mapping = {
      'Square': '1024x1024',
      'Portrait': '1024x1536',
      'Landscape': '1536x1024'
    };
    return mapping[size] || '1024x1024';
  }

  async convertUrlToBase64(imageUrl) {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer = await response.buffer();
      const base64 = buffer.toString('base64');
      return `data:image/png;base64,${base64}`;
    } catch (error) {
      console.error('Failed to convert URL to base64:', error);
      return null;
    }
  }

  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  getJobStatus(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    return {
      status: job.status,
      progress: job.progress,
      results: job.status === 'completed' ? job.results : undefined,
      error: job.error
    };
  }

  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed') {
      return false;
    }

    this.updateJobStatus(jobId, 'cancelled');
    return true;
  }

  updateJobStatus(jobId, status, error = null) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = status;
    job.updatedAt = Date.now();

    if (error) {
      job.error = error;
    }
  }

  startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = 30 * 60 * 1000;

      for (const [jobId, job] of this.jobs.entries()) {
        if (now - job.updatedAt > maxAge) {
          this.jobs.delete(jobId);
        }
      }
    }, 5 * 60 * 1000);
  }

  getStats() {
    const jobs = Array.from(this.jobs.values());

    let apiStats = {
      mode: 'dynamic',
      totalKeys: 0,
      availableKeys: 0,
      keys: []
    };

    if (this.apiManager) {
      apiStats = this.apiManager.getStats();
    }

    return {
      api: apiStats,
      jobs: {
        total: jobs.length,
        pending: jobs.filter(j => j.status === 'pending').length,
        processing: jobs.filter(j => j.status === 'processing').length,
        completed: jobs.filter(j => j.status === 'completed').length,
        failed: jobs.filter(j => j.status === 'failed').length,
        cancelled: jobs.filter(j => j.status === 'cancelled').length,
      },
      models: {
        deepsearch: jobs.filter(j => j.selectedModel === 'deepsearch').length,
        claude: jobs.filter(j => j.selectedModel === 'claude-sonnet').length,
        hdMode: jobs.filter(j => j.isHDMode === true).length,
      }
    };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.jobs.clear();
  }
}

let jobManagerInstance = null;

export const createJobManager = () => {
  if (!jobManagerInstance) {
    console.log('🔧 Creating JobManager instance...');
    jobManagerInstance = new JobManager();
  }
  return jobManagerInstance;
};

export const getJobManager = () => {
  if (!jobManagerInstance) {
    throw new Error('JobManager not initialized. Call createJobManager() first.');
  }
  return jobManagerInstance;
};