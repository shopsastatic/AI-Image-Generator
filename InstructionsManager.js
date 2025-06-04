// InstructionsManager.js - Complete Dynamic Instructions Management System
import fs from 'fs';
import path from 'path';

class InstructionsManager {
    constructor() {
        this.registryPath = path.join(process.cwd(), 'static', 'instructions', 'instructions-registry.json');
        this.instructionsDir = path.join(process.cwd(), 'static', 'instructions');
        this.registry = this.loadRegistry();

        console.log('🔧 InstructionsManager initialized');
    }

    // ✅ Load registry từ file JSON
    loadRegistry() {
        try {
            // Ensure instructions directory exists
            if (!fs.existsSync(this.instructionsDir)) {
                fs.mkdirSync(this.instructionsDir, { recursive: true });
                console.log('📁 Created instructions directory');
            }

            if (!fs.existsSync(this.registryPath)) {
                console.log('📄 Creating new instructions registry...');
                const defaultRegistry = {};
                this.saveRegistry(defaultRegistry);
                return defaultRegistry;
            }

            const registryContent = fs.readFileSync(this.registryPath, 'utf8');
            const registry = JSON.parse(registryContent);
            console.log(`📚 Loaded instructions registry: ${Object.keys(registry).length} files`);
            return registry;
        } catch (error) {
            console.error('❌ Error loading instructions registry:', error);
            return {};
        }
    }

    // ✅ Save registry to file
    saveRegistry(registry = null) {
        try {
            const dataToSave = registry || this.registry;
            fs.writeFileSync(this.registryPath, JSON.stringify(dataToSave, null, 2), 'utf8');
            console.log('✅ Instructions registry saved successfully');
            return true;
        } catch (error) {
            console.error('❌ Error saving instructions registry:', error);
            return false;
        }
    }

    // ✅ Generate filename từ parameters (FIXED with subcategory support)
    generateFileName(category, subcategory, instructionType, targetModel) {
        // Convert category từ dạng selector về dạng filename
        const categoryMap = {
            'google_prompt': 'google_ads',
            'facebook_prompt': 'facebook_ads',
            'website_prompt': 'website_content',
            'google-ads': 'google_ads',
            'facebook-ads': 'facebook_ads',
            'website-content': 'website_content'
        };

        const normalizedCategory = categoryMap[category] || category.replace(/-/g, '_');

        // ✅ FIX: Normalize subcategory để match với filename pattern
        const subcategoryPart = subcategory && subcategory.trim()
            ? `_${subcategory.replace(/[-\s]/g, '_').toLowerCase()}`
            : '';

        const filename = `${instructionType}_prompt_${targetModel}_${normalizedCategory}${subcategoryPart}.txt`;

        console.log(`🔧 Generated filename:`, {
            category,
            subcategory,
            instructionType,
            targetModel,
            result: filename
        });

        return filename;
    }

    // ✅ Tìm file instructions phù hợp (ENHANCED with better logic)
    findInstructionFile(category, subcategory, targetModel = 'universal') {
        const categoryMap = {
            'google_prompt': 'google-ads',
            'facebook_prompt': 'facebook-ads', 
            'website_prompt': 'website-content'
        };

        const normalizedCategory = categoryMap[category] || category;

        // ✅ FIX: Normalize subcategory cho matching
        const normalizedSubcategory = subcategory
            ? subcategory.replace(/[-\s]/g, '_').toLowerCase()
            : '';

        console.log(`🔍 Finding instruction file:`, {
            originalCategory: category,
            normalizedCategory: normalizedCategory,
            originalSubcategory: subcategory,
            normalizedSubcategory: normalizedSubcategory,
            targetModel: targetModel
        });

        // Priority 1: Exact match với normalized subcategory
        if (normalizedSubcategory) {
            const exactMatch = Object.entries(this.registry).find(([filename, config]) => {
                // ✅ FIX: So sánh với normalized subcategory
                const configSubcategory = config.subcategory
                    ? config.subcategory.replace(/[-\s]/g, '_').toLowerCase()
                    : '';

                return config.category === normalizedCategory &&
                    configSubcategory === normalizedSubcategory &&
                    config.targetModel === targetModel &&
                    config.status === 'active';
            });

            if (exactMatch) {
                console.log(`✅ Found exact match with subcategory: ${exactMatch[0]}`);
                return exactMatch[0];
            }
        }

        // Priority 2: Category + model match (files without subcategory)
        const categoryOnlyMatch = Object.entries(this.registry).find(([filename, config]) => {
            return config.category === normalizedCategory &&
                config.targetModel === targetModel &&
                config.status === 'active' &&
                (!config.subcategory || config.subcategory.trim() === '');
        });

        if (categoryOnlyMatch) {
            console.log(`⚠️ Found category-only match: ${categoryOnlyMatch[0]}`);
            return categoryOnlyMatch[0];
        }

        // Priority 3: Any file in category with same model
        const anyInCategory = Object.entries(this.registry).find(([filename, config]) => {
            return config.category === normalizedCategory &&
                config.targetModel === targetModel &&
                config.status === 'active';
        });

        if (anyInCategory) {
            console.log(`🔄 Found any file in category: ${anyInCategory[0]}`);
            return anyInCategory[0];
        }

        // Priority 4: Universal fallback (if not already universal)
        if (targetModel !== 'universal') {
            const universalMatch = Object.entries(this.registry).find(([filename, config]) => {
                return config.category === normalizedCategory &&
                    config.targetModel === 'universal' &&
                    config.status === 'active';
            });

            if (universalMatch) {
                console.log(`🔄 Found universal fallback: ${universalMatch[0]}`);
                return universalMatch[0];
            }
        }

        // Priority 5: Generate filename based on input
        const generatedFile = this.generateFileName(normalizedCategory, subcategory, 'user', targetModel);
        console.log(`❌ No match found, using generated filename: ${generatedFile}`);
        return generatedFile;
    }

    // ✅ Load instruction content
    async loadInstructionContent(filename) {
        try {
            const filePath = path.join(this.instructionsDir, filename);

            if (!fs.existsSync(filePath)) {
                console.warn(`⚠️ Instruction file not found: ${filename}`);
                console.warn(`⚠️ Expected path: ${filePath}`);
                return "You are an AI assistant that helps generate image prompts.";
            }

            const content = fs.readFileSync(filePath, 'utf8');
            console.log(`📖 Loaded instruction content: ${filename} (${content.length} chars)`);
            return content;
        } catch (error) {
            console.error(`❌ Error loading instruction content: ${filename}`, error);
            return "You are an AI assistant that helps generate image prompts.";
        }
    }

    // ✅ Get instructions cho job (MAIN FUNCTION)
    async getInstructionsForJob(category, subcategory = '', targetModel = 'universal') {
        console.log(`🎯 Getting instructions for job:`, {
            category,
            subcategory,
            targetModel
        });

        const filename = this.findInstructionFile(category, subcategory, targetModel);
        const content = await this.loadInstructionContent(filename);

        console.log(`✅ Instructions retrieved: ${content.length} characters from ${filename}`);
        return content;
    }

    // ✅ Create or update project
    createOrUpdateProject(projectData, allowOverwrite = false) {
        try {
            const {
                name,
                instructions,
                category,
                subcategory = '',
                targetModel = 'universal',
                instructionType = 'user',
                status = 'active',
                originalFilename = null // ← NEW: For edit mode
            } = projectData;

            console.log(`🔧 Creating/updating project:`, {
                name,
                category,
                subcategory,
                targetModel,
                instructionType,
                status,
                originalFilename,
                allowOverwrite
            });

            // Generate filename
            const filename = this.generateFileName(category, subcategory, instructionType, targetModel);
            const filePath = path.join(this.instructionsDir, filename);

            // ✅ NEW: Check for conflicts
            const projectExists = this.registry[filename] !== undefined;

            if (projectExists) {
                // ✅ Case 1: Edit mode - same filename is OK
                if (originalFilename && originalFilename === filename) {
                    console.log(`📝 Editing existing project: ${filename}`);
                    // Continue with update...
                }
                // ✅ Case 2: Edit mode - filename changed, check new filename
                else if (originalFilename && originalFilename !== filename) {
                    console.log(`⚠️ Filename change detected: ${originalFilename} → ${filename}`);
                    return {
                        success: false,
                        error: `A project with this configuration already exists: "${this.registry[filename].project}". Please change the category, subcategory, instruction type, or target model to create a unique project.`,
                        conflictingProject: {
                            filename: filename,
                            project: this.registry[filename].project,
                            category: this.registry[filename].category,
                            subcategory: this.registry[filename].subcategory,
                            instructionType: this.registry[filename].instructionType,
                            targetModel: this.registry[filename].targetModel
                        }
                    };
                }
                // ✅ Case 3: Create mode - conflict not allowed
                else if (!originalFilename && !allowOverwrite) {
                    console.log(`❌ Project conflict detected: ${filename}`);
                    return {
                        success: false,
                        error: `A project with this configuration already exists: "${this.registry[filename].project}". Please change the category, subcategory, instruction type, or target model to create a unique project.`,
                        conflictingProject: {
                            filename: filename,
                            project: this.registry[filename].project,
                            category: this.registry[filename].category,
                            subcategory: this.registry[filename].subcategory,
                            instructionType: this.registry[filename].instructionType,
                            targetModel: this.registry[filename].targetModel
                        }
                    };
                }
            }

            // ✅ Write instruction file
            fs.writeFileSync(filePath, instructions, 'utf8');
            console.log(`📝 Written instruction file: ${filename}`);

            // ✅ Update registry
            const now = new Date().toISOString();
            const isUpdate = projectExists && originalFilename === filename;

            // ✅ Handle filename changes in edit mode
            if (originalFilename && originalFilename !== filename) {
                // Remove old registry entry
                if (this.registry[originalFilename]) {
                    delete this.registry[originalFilename];

                    // Remove old file
                    const oldFilePath = path.join(this.instructionsDir, originalFilename);
                    if (fs.existsSync(oldFilePath)) {
                        fs.unlinkSync(oldFilePath);
                        console.log(`🗑️ Removed old file: ${originalFilename}`);
                    }
                }
            }

            this.registry[filename] = {
                project: name,
                category: category,
                subcategory: subcategory,
                instructionType: instructionType,
                targetModel: targetModel,
                status: status,
                createdAt: isUpdate ? this.registry[filename].createdAt : now,
                lastModified: now
            };

            // Save registry
            this.saveRegistry();

            console.log(`✅ ${isUpdate ? 'Updated' : 'Created'} project: ${filename}`);
            return {
                success: true,
                filename,
                isUpdate: isUpdate,
                message: isUpdate ? 'Project updated successfully' : 'Project created successfully'
            };

        } catch (error) {
            console.error('❌ Error creating/updating project:', error);
            return { success: false, error: error.message };
        }
    }

    // ✅ Delete project
    deleteProject(filename) {
        try {
            const filePath = path.join(this.instructionsDir, filename);

            // Delete file if exists
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Deleted instruction file: ${filename}`);
            }

            // Remove from registry
            if (this.registry[filename]) {
                delete this.registry[filename];
                this.saveRegistry();
                console.log(`🗑️ Removed from registry: ${filename}`);
            }

            console.log(`✅ Project deleted successfully: ${filename}`);
            return { success: true };
        } catch (error) {
            console.error('❌ Error deleting project:', error);
            return { success: false, error: error.message };
        }
    }

    // ✅ Get all projects
    getAllProjects() {
        const projects = Object.entries(this.registry).map(([filename, config]) => ({
            filename,
            ...config
        }));

        console.log(`📊 Retrieved ${projects.length} projects`);
        return projects;
    }

    // ✅ Get projects by category
    getProjectsByCategory(category) {
        const projects = this.getAllProjects().filter(project => project.category === category);
        console.log(`📊 Retrieved ${projects.length} projects for category: ${category}`);
        return projects;
    }

    // ✅ Update project status
    updateProjectStatus(filename, status) {
        if (this.registry[filename]) {
            const oldStatus = this.registry[filename].status;
            this.registry[filename].status = status;
            this.registry[filename].lastModified = new Date().toISOString();
            this.saveRegistry();

            console.log(`🔄 Updated project status: ${filename} (${oldStatus} → ${status})`);
            return { success: true };
        }

        console.error(`❌ Project not found for status update: ${filename}`);
        return { success: false, error: 'Project not found' };
    }

    // ✅ Get registry stats
    getStats() {
        const projects = this.getAllProjects();

        const stats = {
            total: projects.length,
            active: projects.filter(p => p.status === 'active').length,
            inactive: projects.filter(p => p.status !== 'active').length,
            byCategory: projects.reduce((acc, project) => {
                acc[project.category] = (acc[project.category] || 0) + 1;
                return acc;
            }, {}),
            byModel: projects.reduce((acc, project) => {
                acc[project.targetModel] = (acc[project.targetModel] || 0) + 1;
                return acc;
            }, {}),
            byInstructionType: projects.reduce((acc, project) => {
                acc[project.instructionType] = (acc[project.instructionType] || 0) + 1;
                return acc;
            }, {})
        };

        console.log(`📊 Registry stats:`, stats);
        return stats;
    }

    // ✅ Validate filename
    isValidFilename(filename) {
        const validPattern = /^(user|system)_prompt_(universal|deepseek)_[a-z_]+\.txt$/;
        return validPattern.test(filename);
    }

    // ✅ Get project by filename
    getProject(filename) {
        if (this.registry[filename]) {
            return {
                filename,
                ...this.registry[filename]
            };
        }
        return null;
    }

    // ✅ Check if project exists
    projectExists(filename) {
        return this.registry[filename] !== undefined;
    }

    // ✅ Backup registry
    backupRegistry() {
        try {
            const backupPath = path.join(this.instructionsDir, `instructions-registry-backup-${Date.now()}.json`);
            fs.writeFileSync(backupPath, JSON.stringify(this.registry, null, 2), 'utf8');
            console.log(`📦 Registry backed up to: ${backupPath}`);
            return { success: true, backupPath };
        } catch (error) {
            console.error('❌ Error backing up registry:', error);
            return { success: false, error: error.message };
        }
    }

    // ✅ Reload registry (for hot reload)
    reloadRegistry() {
        console.log('🔄 Reloading instructions registry...');
        this.registry = this.loadRegistry();
        return this.registry;
    }
}

// ✅ Singleton instance
let instructionsManagerInstance = null;

export const createInstructionsManager = () => {
    if (!instructionsManagerInstance) {
        console.log('🔧 Creating InstructionsManager instance...');
        instructionsManagerInstance = new InstructionsManager();
    }
    return instructionsManagerInstance;
};

export const getInstructionsManager = () => {
    if (!instructionsManagerInstance) {
        return createInstructionsManager();
    }
    return instructionsManagerInstance;
};

// ✅ Export for direct use
export default InstructionsManager;