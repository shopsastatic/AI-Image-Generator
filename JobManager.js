// JobManager.js - Updated with Deepseek API Support
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

class APIConfigManager {
  constructor() {
    this.config = null;
    console.log(`🔍 APIConfigManager initialized for dynamic configuration`);
  }

  // FIX: Get config based on HD mode and model
  getConfigForRequest(isHDMode = false, selectedModel = 'deepsearch') {
    console.log(`🔍 Getting config for HD:${isHDMode}, Model:${selectedModel}`);
    
    // Model determines which AI service to use for PROMPT GENERATION
    if (selectedModel === 'claude-sonnet') {
      return {
        promptMode: 'claude',
        model: 'claude-sonnet-4-20250514',
        apiKey: process.env.CLAUDE_API_KEY,
        // Image generation still uses OpenAI based on HD mode
        imageMode: isHDMode ? 'unofficial' : 'official',
        imageConfig: this.getImageConfig(isHDMode)
      };
    } else if (selectedModel === 'deepsearch') {
      return {
        promptMode: 'deepseek',
        model: 'deepseek-chat', // or whatever model name Deepseek uses
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com/v1', // Deepseek API URL
        // Image generation still uses OpenAI based on HD mode  
        imageMode: isHDMode ? 'unofficial' : 'official',
        imageConfig: this.getImageConfig(isHDMode)
      };
    }
    
    throw new Error(`Unsupported model: ${selectedModel}`);
  }

  getImageConfig(isHDMode) {
    if (isHDMode) {
      // HD Mode ON → Use unofficial (laozhang)
      const subKey = process.env.OPENAI_API_SUB_KEY;
      if (!subKey) {
        throw new Error('HD Mode requires OPENAI_API_SUB_KEY');
      }
      
      return {
        mode: 'unofficial',
        baseURL: 'https://api.laozhang.ai/v1/',
        model: 'gpt-4o-image',
        keys: [subKey]
      };
    } else {
      // HD Mode OFF → Use official OpenAI
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
        model: 'gpt-image-1',
        keys: officialKeys
      };
    }
  }

  // Legacy methods for backward compatibility
  detectAPIMode() {
    console.warn('⚠️ detectAPIMode is deprecated, use getConfigForRequest instead');
    return this.getConfigForRequest(false, 'deepsearch');
  }

  getConfig() {
    if (!this.config) {
      console.warn('⚠️ Config not set, using default');
      return this.getConfigForRequest(false, 'deepsearch');
    }
    return this.config;
  }

  setConfig(config) {
    this.config = config;
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
    this.configManager = configManager;
    this.apiManager = null; // Will be initialized per job for image generation
    this.jobs = new Map();
    this.maxRetries = 3;
    this.startCleanupInterval();
  }

  async createJob(sessionId, userPrompt, numberOfImages, imageSizesString, selectedQuality, selectedCategory, selectedModel = 'deepsearch', isHDMode = false) {
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
      claudeResponse: '', // Will store prompt generation response
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

      // Get configuration for this job
      const config = this.configManager.getConfigForRequest(job.isHDMode, job.selectedModel);

      // Generate prompts using selected model
      if (config.promptMode === 'claude') {
        console.log('🤖 Using Claude Sonnet for prompt generation');
        promptResponse = await this.callClaudeAPI(job);
      } else if (config.promptMode === 'deepseek') {
        console.log('🤖 Using Deepseek for prompt generation');
        promptResponse = await this.callDeepseekAPI(job);
      } else {
        throw new Error(`Unsupported prompt mode: ${config.promptMode}`);
      }

      console.log('📝 Prompt generation response:', promptResponse.substring(0, 100)); 
      
      // Store response in job
      job.claudeResponse = promptResponse; // Keep the name for compatibility
      
      // Parse the response
      parsedResponse = this.parsePromptResponse(promptResponse, job.selectedCategory.category);
      
      if (job.status === 'cancelled') return;

      job.progress.total = parsedResponse.prompts.length;
      job.progress.currentStep = 'Generating images...';
      
      // Setup API manager for image generation (always uses OpenAI-based services)
      this.apiManager = new APIKeyRotationManager(config.imageConfig);

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
          const imageResult = await this.generateSingleImageWithRetry(promptData, job, config.imageConfig);
          
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

  // NEW: Deepseek API call
  async callDeepseekAPI(job) {
    const maxRetries = this.maxRetries;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (job.status === 'cancelled') throw new Error('Job cancelled');

      try {
        job.progress.currentStep = `Deepseek generating... (attempt ${attempt}/${maxRetries})`;
        
        const deepseekPrompt = `${job.userPrompt}\n\nOutput: ${job.numberOfImages}\n\nImage sizes: ${job.imageSizesString}`;

        const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
          model: "deepseek-chat",
          messages: [
            {
              role: "system", 
              content: await this.loadInstructions(job.selectedCategory.category)
            },
            {
              role: "user", 
              content: deepseekPrompt
            }
          ],
          max_tokens: 8000,
          temperature: 0.7
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
          }
        });

        return response.data.choices?.[0]?.message?.content || "No response from Deepseek";

      } catch (error) {
        lastError = error;
        console.error(`Deepseek API attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Deepseek API failed after retries');
  }

  // UPDATED: Claude API call (renamed for clarity)
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

  async generateSingleImageWithRetry(promptData, job, imageConfig) {
    const maxRetries = this.maxRetries;
    let lastError;

    console.log(`🎨 Image generation config:`, {
      mode: imageConfig.mode,
      baseURL: imageConfig.baseURL,
      model: imageConfig.model,
      keysCount: imageConfig.keys?.length
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (job.status === 'cancelled') throw new Error('Job cancelled');

      const keyInfo = await this.apiManager.getAvailableKey();
      
      try {
        const requestBody = {
          model: imageConfig.model,
          prompt: promptData.prompt,
          n: 1,
          size: this.getSizeMapping(promptData.size),
          quality: 'low',
          output_format: "png"
        };

        console.log(`🎨 Generating image attempt ${attempt}/${maxRetries}:`, {
          apiMode: imageConfig.mode,
          model: imageConfig.model,
          baseURL: imageConfig.baseURL,
          promptLength: promptData.prompt.length,
          size: requestBody.size,
          keyId: keyInfo.id
        });

        console.log(`🔍 LAOZHANG REQUEST DEBUG:`, {
          endpoint: `${imageConfig.baseURL}/images/generations`,
          headers: {
            'Authorization': `Bearer ${keyInfo.key.substring(0, 10)}...`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody, null, 2)
        });

        const response = await keyInfo.client.images.generate(requestBody);

        // 🔍 DEBUG: Log complete response structure
        console.log(`🔍 LAOZHANG RESPONSE DEBUG:`, {
          hasResponse: !!response,
          responseKeys: response ? Object.keys(response) : 'no response',
          hasData: !!response?.data,
          dataType: typeof response?.data,
          dataKeys: response?.data ? Object.keys(response.data) : 'no data',
          dataLength: Array.isArray(response?.data) ? response.data.length : 'not array',
          fullResponse: JSON.stringify(response, null, 2)
        });

        // 🔧 FIX: Safe access to response data
        let imageData = null;
        
        // Try different response formats
        if (response?.data && Array.isArray(response.data) && response.data.length > 0) {
          // Standard OpenAI format: response.data[0]
          imageData = response.data[0];
          console.log(`✅ Using standard format: response.data[0]`);
        } else if (response?.data && !Array.isArray(response.data)) {
          // Direct object format: response.data
          imageData = response.data;
          console.log(`✅ Using direct format: response.data`);
        } else if (response?.image) {
          // Alternative format: response.image
          imageData = response.image;
          console.log(`✅ Using alternative format: response.image`);
        } else if (response?.images && Array.isArray(response.images)) {
          // Alternative array format: response.images[0]
          imageData = response.images[0];
          console.log(`✅ Using images array format: response.images[0]`);
        } else if (response && typeof response === 'object') {
          // Try to find image data in response object
          const possibleKeys = ['url', 'b64_json', 'image_url', 'image_data', 'data_url'];
          for (const key of possibleKeys) {
            if (response[key]) {
              imageData = { [key]: response[key] };
              console.log(`✅ Found image data in response.${key}`);
              break;
            }
          }
        }

        if (!imageData) {
          console.error(`❌ No image data found in response structure:`, {
            responseType: typeof response,
            responseKeys: response ? Object.keys(response) : 'no response',
            fullResponse: response
          });
          throw new Error('No image data found in response');
        }

        console.log(`🔍 IMAGE DATA DEBUG:`, {
          hasImageData: !!imageData,
          imageDataKeys: imageData ? Object.keys(imageData) : 'no image data',
          hasUrl: !!imageData?.url,
          hasB64: !!imageData?.b64_json,
          hasImageUrl: !!imageData?.image_url,
          hasDataUrl: !!imageData?.data_url,
          urlPreview: imageData?.url?.substring(0, 50),
          b64Length: imageData?.b64_json?.length
        });
        
        let imageBase64 = '';
        
        // Try different image data formats
        if (imageData.b64_json) {
          imageBase64 = `data:image/png;base64,${imageData.b64_json}`;
          console.log(`✅ Using b64_json, length: ${imageData.b64_json.length}`);
        } else if (imageData.url) {
          console.log(`🔗 Converting URL to base64: ${imageData.url.substring(0, 50)}...`);
          imageBase64 = await this.convertUrlToBase64(imageData.url);
          console.log(`✅ URL converted to base64, length: ${imageBase64.length}`);
        } else if (imageData.image_url) {
          console.log(`🔗 Converting image_url to base64: ${imageData.image_url.substring(0, 50)}...`);
          imageBase64 = await this.convertUrlToBase64(imageData.image_url);
          console.log(`✅ image_url converted to base64, length: ${imageBase64.length}`);
        } else if (imageData.data_url) {
          imageBase64 = imageData.data_url;
          console.log(`✅ Using data_url directly, length: ${imageBase64.length}`);
        } else if (typeof imageData === 'string' && imageData.startsWith('data:')) {
          imageBase64 = imageData;
          console.log(`✅ Using direct data URL string, length: ${imageBase64.length}`);
        } else if (typeof imageData === 'string' && imageData.startsWith('http')) {
          console.log(`🔗 Converting string URL to base64: ${imageData.substring(0, 50)}...`);
          imageBase64 = await this.convertUrlToBase64(imageData);
          console.log(`✅ String URL converted to base64, length: ${imageBase64.length}`);
        } else {
          console.error(`❌ No valid image format found:`, {
            imageDataType: typeof imageData,
            imageDataContent: imageData
          });
          throw new Error('No valid image format in response data');
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

        // Add optional fields only if they exist
        if (promptData.adCreativeA) {
          result.AdCreativeA = promptData.adCreativeA;
        }
        if (promptData.adCreativeB) {
          result.AdCreativeB = promptData.adCreativeB;
        }
        if (promptData.targeting) {
          result.targeting = promptData.targeting;
        }

        console.log(`🖼️ Generated image successfully:`, {
          hasImageName: !!result.imageName,
          hasAdCreativeA: !!result.AdCreativeA,
          hasAdCreativeB: !!result.AdCreativeB, 
          hasTargeting: !!result.targeting,
          size: result.size,
          imageApiMode: imageConfig.mode,
          attempt: attempt,
          imageBase64Length: result.imageBase64.length
        });
        
        return result;
        
      } catch (error) {
        console.error(`❌ Image generation attempt ${attempt} failed:`, {
          apiMode: imageConfig.mode,
          model: imageConfig.model,
          baseURL: imageConfig.baseURL,
          keyId: keyInfo.id,
          errorType: error.constructor.name,
          errorMessage: error.message
        });

        // Enhanced error logging
        if (error.response) {
          console.error(`🚨 HTTP Error Response:`, {
            status: error.response.status,
            statusText: error.response.statusText,
            headers: error.response.headers,
            data: error.response.data
          });

          if (imageConfig.mode === 'unofficial') {
            console.error(`🚨 LAOZHANG SPECIFIC ERROR:`, {
              url: error.config?.url,
              method: error.config?.method,
              requestData: error.config?.data,
              responseData: error.response.data,
              responseStatus: error.response.status,
              responseHeaders: error.response.headers
            });
          }
        } else if (error.request) {
          console.error(`🌐 Network Error:`, {
            message: error.message,
            code: error.code,
            errno: error.errno,
            syscall: error.syscall,
            hostname: error.hostname
          });
        } else {
          console.error(`🔧 Other Error:`, {
            message: error.message,
            stack: error.stack,
            name: error.name
          });
        }

        if (error.status) {
          console.error(`🤖 OpenAI SDK Error:`, {
            status: error.status,
            type: error.type,
            code: error.code,
            param: error.param,
            message: error.message
          });
        }

        this.apiManager.releaseKey(keyInfo, false, error);
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`💥 ALL ATTEMPTS FAILED for image generation:`, {
      totalAttempts: maxRetries,
      apiMode: imageConfig.mode,
      model: imageConfig.model,
      baseURL: imageConfig.baseURL,
      promptPreview: promptData.prompt.substring(0, 100),
      finalError: {
        message: lastError?.message,
        status: lastError?.status || lastError?.response?.status,
        type: lastError?.type,
        code: lastError?.code
      }
    });

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

  // RENAMED: parseClaudeResponse -> parsePromptResponse (works for both Claude and Deepseek)
  parsePromptResponse(response, category = 'google_prompt') {
    try {
      const jsonArrayMatch = response.match(/\[\s*\{[\s\S]*?\}\s*\]/);
      
      if (jsonArrayMatch) {
        const jsonData = JSON.parse(jsonArrayMatch[0]);
        
        if (Array.isArray(jsonData) && jsonData.length > 0) {
          // Get shared data from first object
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
            // Base object with required fields
            const basePrompt = {
              prompt: item.prompt || `Generated prompt ${index + 1}`,
              imageName: item.imageName || `ai-image-${index + 1}-${Date.now()}`,
              size: item.size || "Square",
              adCreativeA: "",
              adCreativeB: "",
              targeting: ""
            };

            if (category === 'facebook_prompt') {
              // Facebook: First object gets its own data, others get shared targeting
              if (index === 0) {
                basePrompt.adCreativeA = item.adCreativeA || "";
                basePrompt.adCreativeB = item.adCreativeB || "";
                basePrompt.targeting = item.targeting || "";
              } else {
                // Subsequent objects: own AdCreatives, shared targeting
                basePrompt.adCreativeA = item.adCreativeA || "";
                basePrompt.adCreativeB = item.adCreativeB || "";
                basePrompt.targeting = sharedTargeting; // Copy from first object
              }
            } else if (category === 'google_prompt') {
              // Google: First object gets its own data, others share everything except prompt
              if (index === 0) {
                basePrompt.adCreativeA = item.adCreativeA || "";
                basePrompt.adCreativeB = item.adCreativeB || "";
                basePrompt.targeting = item.targeting || "";
              } else {
                // Subsequent objects: share AdCreatives and targeting from first object
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