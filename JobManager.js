// JobManager.js - Node.js Compatible Version
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

class APIConfigManager {
  constructor() {
    this.config = this.detectAPIMode();
    console.log(`🔍 Detected API Mode: ${this.config.mode}`);
  }

  detectAPIMode() {
    const subKey = process.env.OPENAI_API_SUB_KEY;
    const officialKeys = [
      process.env.OPENAI_API_KEY_1,
      process.env.OPENAI_API_KEY_2,
      process.env.OPENAI_API_KEY_3,
      process.env.OPENAI_API_KEY_4,
      process.env.OPENAI_API_KEY_5,
    ].filter(Boolean);

    if (subKey) {
      return {
        mode: 'unofficial',
        baseURL: 'https://api.laozhang.ai/v1/',
        model: 'gpt-4o-image',
        keys: [subKey]
      };
    }

    if (officialKeys.length > 0) {
      return {
        mode: 'official',
        baseURL: 'https://api.openai.com/v1/',
        model: 'gpt-image-1',
        keys: officialKeys
      };
    }

    throw new Error('No OpenAI API keys found');
  }

  getConfig() {
    return this.config;
  }
}

class APIKeyRotationManager {
  constructor(config) {
    this.config = config;
    this.apiKeys = [];
    this.currentIndex = 0;
    this.initializeKeys();
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
        rateLimitResetTime: null,
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
        rateLimitResetTime: null,
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
        await new Promise(resolve => setTimeout(resolve, 100));
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
    
    if (keyInfo.errorCount >= 3) {
      if (now - (keyInfo.lastUsed || 0) < 180000) {
        return false;
      }
      keyInfo.errorCount = 0;
      keyInfo.status = 'available';
    }
    
    if (keyInfo.rateLimitResetTime && now < keyInfo.rateLimitResetTime) {
      return false;
    }
    
    return keyInfo.status === 'available' || 
           (keyInfo.status === 'in_use' && now - (keyInfo.lastUsed || 0) > 60000);
  }

  getLeastRecentlyUsedKey() {
    return this.apiKeys.reduce((lru, current) => {
      if (!lru.lastUsed) return current;
      if (!current.lastUsed) return lru;
      return current.lastUsed < lru.lastUsed ? current : lru;
    });
  }

  releaseKey(keyInfo, success = true, error = null) {
    keyInfo.status = 'available';
    
    if (success) {
      keyInfo.errorCount = Math.max(0, keyInfo.errorCount - 1);
    } else {
      keyInfo.errorCount++;
      
      if (error && error.status === 429) {
        keyInfo.status = 'rate_limited';
        keyInfo.rateLimitResetTime = Date.now() + 300000;
      } else if (error && error.status >= 500) {
        keyInfo.status = 'error';
      }
    }
  }

  getStats() {
    return {
      mode: this.config.mode,
      totalKeys: this.apiKeys.length,
      availableKeys: this.apiKeys.filter(k => this.isKeyAvailable(k)).length,
      keys: this.apiKeys.map(k => ({
        id: k.id,
        status: k.status,
        requestCount: k.requestCount,
        errorCount: k.errorCount,
        lastUsed: k.lastUsed ? new Date(k.lastUsed).toLocaleTimeString() : 'Never'
      }))
    };
  }
}

export class JobManager {
  constructor() {
    const configManager = new APIConfigManager();
    this.config = configManager.getConfig();
    this.apiManager = new APIKeyRotationManager(this.config);
    this.jobs = new Map();
    this.maxRetries = 3;
    this.startCleanupInterval();
  }

  async createJob(sessionId, userPrompt, numberOfImages, imageSizesString, selectedQuality, selectedCategory) {
    const jobId = uuidv4();
    
    const job = {
      id: jobId,
      status: 'pending',
      sessionId,
      userPrompt,
      numberOfImages,
      imageSizesString,
      selectedQuality,
      selectedCategory,
      results: [],
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

    console.log('🎯 Processing job:', jobId);

    this.updateJobStatus(jobId, 'processing');
    job.progress.currentStep = 'Generating prompts...';

    try {
      if (job.status === 'cancelled') return;

      const claudeResponse = await this.callClaudeWithRetry(job);
      console.log('📝 Claude response:', claudeResponse.substring(0, 100)); 
      if (job.status === 'cancelled') return;

      const parsedResponse = this.parseClaudeResponse(claudeResponse, job.selectedCategory.category);
      
      job.progress.total = parsedResponse.prompts.length;
      job.progress.currentStep = 'Generating images...';

      for (let i = 0; i < parsedResponse.prompts.length; i++) {
        if (job.status === 'cancelled') return;

        const promptData = parsedResponse.prompts[i];
        
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
        
        try {
          const imageResult = await this.generateSingleImageWithRetry(promptData, job);
          
          job.results.push(imageResult);
          job.progress.completed++;
          job.updatedAt = Date.now();
          
        } catch (error) {
          job.progress.failed++;
          job.updatedAt = Date.now();
          
          job.results.push({
            imageBase64: this.getErrorPlaceholder(),
            prompt: promptData.prompt,
            timestamp: new Date().toISOString(),
            size: promptData.size,
            quality: job.selectedQuality,
            AdCreativeA: promptData.adCreativeA,
            AdCreativeB: promptData.adCreativeB,
            targeting: promptData.targeting,
            imageName: promptData.imageName
          });
        }
      }

      if (job.progress.completed > 0) {
        this.updateJobStatus(jobId, 'completed');
      } else {
        this.updateJobStatus(jobId, 'failed', 'All images failed to generate');
      }

    } catch (error) {
      this.updateJobStatus(jobId, 'failed', error.message);
    }
  }

  async callClaudeWithRetry(job) {
    const maxRetries = this.maxRetries;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (job.status === 'cancelled') throw new Error('Job cancelled');

      try {
        job.progress.currentStep = `Generating prompts... (attempt ${attempt}/${maxRetries})`;
        
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
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Claude API failed after retries');
  }

  async generateSingleImageWithRetry(promptData, job) {
    const maxRetries = this.maxRetries;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (job.status === 'cancelled') throw new Error('Job cancelled');

      const keyInfo = await this.apiManager.getAvailableKey();
      
      try {
        const requestBody = {
          model: this.config.model,
          prompt: promptData.prompt,
          n: 1,
          size: this.getSizeMapping(promptData.size),
          quality: 'low',
          output_format: "png"
        };

        const response = await keyInfo.client.images.generate(requestBody);
        const imageData = response.data[0];
        
        let imageBase64 = '';
        
        if (imageData && imageData.b64_json) {
          imageBase64 = `data:image/png;base64,${imageData.b64_json}`;
        } else if (imageData && imageData.url) {
          imageBase64 = await this.convertUrlToBase64(imageData.url);
        } else {
          throw new Error('No image data in response');
        }

        this.apiManager.releaseKey(keyInfo, true);
        
        return {
          imageBase64,
          prompt: promptData.prompt,
          timestamp: new Date().toISOString(),
          size: promptData.size,
          quality: job.selectedQuality,
          AdCreativeA: promptData.adCreativeA,
          AdCreativeB: promptData.adCreativeB,
          targeting: promptData.targeting,
          imageName: promptData.imageName
        };
        
      } catch (error) {
        this.apiManager.releaseKey(keyInfo, false, error);
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Image generation failed after retries');
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
      const instructionsPath = path.join(process.cwd(), 'static', filename);
      
      return fs.readFileSync(instructionsPath, 'utf8');
    } catch (error) {
      return "You are an AI assistant that helps generate image prompts.";
    }
  }

  parseClaudeResponse(response, category = 'google_prompt') {
    try {
      const jsonArrayMatch = response.match(/\[\s*\{[\s\S]*?\}\s*\]/);
      
      if (jsonArrayMatch) {
        const jsonData = JSON.parse(jsonArrayMatch[0]);
        
        if (Array.isArray(jsonData) && jsonData.length > 0) {
          const prompts = jsonData.map((item, index) => ({
            prompt: item.prompt || `Generated prompt ${index + 1}`,
            adCreativeA: item.adCreativeA || "",
            adCreativeB: item.adCreativeB || "",
            imageName: item.imageName || `ai-image-${index + 1}-${Date.now()}`,
            targeting: item.targeting || "",
            size: item.size || "Square" // Fix: Lấy size từ Claude response
          }));

          return { prompts };
        }
      }

      return {
        prompts: [{
          prompt: response,
          adCreativeA: "",
          adCreativeB: "",
          imageName: `ai-image-fallback-${Date.now()}`,
          targeting: "",
          size: "Square" // Fallback default
        }]
      };

    } catch (error) {
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
      return this.getErrorPlaceholder();
    }
  }

  getErrorPlaceholder() {
    return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZTZlNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNDAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNkNjZkMDAiPkFQSSBFcnJvcjwvdGV4dD48dGV4dCB4PSI1MCUiIHk9IjYwJSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZDY2ZDAwIj5DbGljayB0byByZXRyeTwvdGV4dD48L3N2Zz4=";
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
    
    return {
      api: this.apiManager.getStats(),
      jobs: {
        total: jobs.length,
        pending: jobs.filter(j => j.status === 'pending').length,
        processing: jobs.filter(j => j.status === 'processing').length,
        completed: jobs.filter(j => j.status === 'completed').length,
        failed: jobs.filter(j => j.status === 'failed').length,
        cancelled: jobs.filter(j => j.status === 'cancelled').length,
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

// Export functions for manual instance creation
// Note: Instance should be created after environment variables are loaded