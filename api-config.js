/**
 * LP2 Text & Icon Editor - Final Version
 */

class LP2TextEditor {
    constructor() {
        this.config = {
            debounceDelay: 300
        };

        this.currentEditing = null;
        this.postId = window.postID || null;
        this.hasChanges = false;
        this.saveButton = null;
        this.debouncedSave = this.debounce(this.saveField.bind(this), this.config.debounceDelay);

        this.init();
    }

    async loadFontAwesomeIcons() {
        if (this.iconCache) return this.iconCache;
        
        try {
            const response = await fetch('https://cdn.jsdelivr.net/gh/FortAwesome/Font-Awesome@6.x/metadata/icons.json');
            const data = await response.json();
            
            this.iconCache = Object.entries(data)
                .filter(([_, icon]) => {
                    return icon.styles && icon.styles.includes('solid');
                })
                .map(([name, _]) => name)
                .sort();
            
            console.log(`✅ Loaded ${this.iconCache.length} FontAwesome icons`);
            return this.iconCache;
            
        } catch (error) {
            console.error('FA icons load failed:', error);
            return [
                'heart', 'star', 'user', 'home', 'search', 'envelope', 'phone', 'calendar',
                'camera', 'video', 'music', 'image', 'file', 'folder', 'download', 'upload',
                'cloud', 'lock', 'unlock', 'key', 'shield', 'check', 'times'
            ];
        }
    }

    getFallbackIcons() {
        return [
            'heart', 'star', 'user', 'home', 'search', 'envelope', 'phone', 'calendar',
            'camera', 'video', 'music', 'image', 'file', 'folder', 'download', 'upload',
            'cloud', 'lock', 'unlock', 'key', 'shield'
        ];
    }

    init() {
        if (!this.isUserLoggedIn() || !this.postId) return;

        this.injectCSS();
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup(), { once: true });
        } else {
            requestAnimationFrame(() => this.setup());
        }
    }

    setup() {
        this.setupEventDelegation();
        this.addKeyboardShortcuts();
    }

    injectCSS() {
        if (document.getElementById('lp2-text-editor-styles')) return;

        const style = document.createElement('style');
        style.id = 'lp2-text-editor-styles';
        style.textContent = `
            [data-meta]:not([data-type="icon"]):hover:not(.lp2-editing) {
                outline: 2px dashed #E91E63;
                outline-offset: 2px;
                border-radius: 3px;
            }


            .lp2-editing {
                outline: 2px solid #ffc107 !important;
                outline-offset: 2px;
                background: rgba(255, 193, 7, 0.1) !important;
                border-radius: 4px;
                position: relative;
                transition: all 0.2s ease;
            }

            [data-type="icon"]:hover {
                cursor: pointer;
                outline: 2px dashed #E91E63;
                outline-offset: 2px;
                border-radius: 3px;
            }

            .lp2-editing, .lp2-editing:hover {
                outline: 2px solid #ffc107 !important;
                background: rgba(255, 193, 7, 0.1) !important;
            }

            [contenteditable="true"]:focus {
                outline: none;
                caret-color: #000000 !important;
            }

            .lp2-edit-actions {
                position: absolute;
                top: -40px;
                right: 0;
                display: flex;
                gap: 6px;
                z-index: 1000001;
                animation: lp2-slide-down 0.2s ease-out;
            }

            @keyframes lp2-slide-down {
                0% {
                    opacity: 0;
                    transform: translateY(-5px);
                }
                100% {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .lp2-edit-btn {
                width: 32px;
                height: 32px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                font-weight: bold;
                transition: all 0.2s ease;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            }

            .lp2-edit-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            }

            .lp2-edit-btn:active {
                transform: translateY(0);
            }

            .lp2-btn-save {
                background: #28a745;
                color: white;
            }

            .lp2-btn-save:hover {
                background: #218838;
            }

            .lp2-btn-cancel {
                background: #dc3545;
                color: white;
            }

            .lp2-btn-cancel:hover {
                background: #c82333;
            }

            .lp2-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                z-index: 999999;
                animation: lp2-fade-in 0.2s ease-out;
            }

            @keyframes lp2-fade-in {
                0% { opacity: 0; }
                100% { opacity: 1; }
            }

            .lp2-icon-editor {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border-radius: 16px;
                padding: 32px;
                box-shadow: 0 24px 48px rgba(0, 0, 0, 0.3);
                z-index: 1000000;
                min-width: 450px;
                animation: lp2-scale-in 0.3s ease-out;
            }

            @keyframes lp2-scale-in {
                0% {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.9);
                }
                100% {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                }
            }

            .lp2-icon-editor h3 {
                margin: 0 0 20px 0;
                color: #1f2937;
                font-size: 20px;
                font-weight: 700;
            }

            .lp2-icon-input {
                width: 100%;
                padding: 14px 18px;
                border: 2px solid #e5e7eb;
                border-radius: 10px;
                font-size: 16px;
                font-family: 'Courier New', monospace;
                transition: all 0.2s;
            }

            .lp2-icon-input:focus {
                outline: none;
                border-color: #007bff;
                box-shadow: 0 0 0 4px rgba(0, 123, 255, 0.1);
            }

            .lp2-icon-preview {
                margin: 20px 0;
                padding: 32px;
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                border-radius: 12px;
                text-align: center;
                font-size: 56px;
                color: #007bff;
            }

            .lp2-icon-preview i {
                color: #000 !important;
            }

            .lp2-icon-buttons {
                display: flex;
                gap: 12px;
                margin-top: 24px;
            }

            .lp2-icon-btn {
                flex: 1;
                padding: 14px 20px;
                border: none;
                border-radius: 10px;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }

            .lp2-icon-btn-primary {
                background: #007bff;
                color: white;
            }

            .lp2-icon-btn-primary:hover {
                background: #0056b3;
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0, 123, 255, 0.3);
            }

            .lp2-icon-btn-secondary {
                background: #6c757d;
                color: white;
            }

            .lp2-icon-btn-secondary:hover {
                background: #5a6268;
            }

            #lp2-save-changes {
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 10px;
                cursor: default;
                font-weight: 600;
                font-size: 14px;
                z-index: 100000;
                box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
                animation: lp2-slide-in 0.3s ease-out;
            }

            @keyframes lp2-slide-in {
                0% {
                    opacity: 0;
                    transform: translateX(100px);
                }
                100% {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            [data-meta] * {
                pointer-events: auto !important;
            }

            .lp2-icon-editor {
                min-width: 650px;
                max-width: 800px;
            }

            .lp2-icon-grid::-webkit-scrollbar {
                width: 8px;
            }

            .lp2-icon-grid::-webkit-scrollbar-track {
                background: #e9ecef;
                border-radius: 4px;
            }

            .lp2-icon-grid::-webkit-scrollbar-thumb {
                background: #adb5bd;
                border-radius: 4px;
            }

            .lp2-icon-grid::-webkit-scrollbar-thumb:hover {
                background: #6c757d;
            }
        `;
        document.head.appendChild(style);
    }

    setupEventDelegation() {
        document.addEventListener('dblclick', (e) => {
            const target = e.target.closest('[data-meta]');
            
            if (!target) return;

            e.preventDefault();
            e.stopPropagation();

            const isIcon = target.hasAttribute('data-type') && target.getAttribute('data-type') === 'icon';

            if (isIcon) {
                this.editIcon(target);
            } else {
                this.editTextWithEvent(target, e);
            }
        }, true);

        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (link && link.closest('[data-meta]') && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
            }

            if (e.target.closest('.lp2-edit-actions') || 
                e.target.closest('[contenteditable="true"]')) {
                return;
            }

            if (e.target.closest('.lp2-icon-editor')) {
                return;
            }

            if (this.currentEditing && !this.currentEditing.contains(e.target)) {
                this.cancelCurrentEdit();
            }
        }, true);
    }

    cancelCurrentEdit() {
        if (!this.currentEditing) return;
        
        const node = this.currentEditingNode;
        const actions = this.currentEditing.querySelector('.lp2-edit-actions');
        
        if (node) {
            const originalHTML = node.getAttribute('data-original-html');
            if (originalHTML) {
                if (node.innerHTML !== undefined) {
                    node.innerHTML = originalHTML;
                } else {
                    node.textContent = originalHTML;
                }
            }
            
            this.finishEditing(node, this.currentEditing, actions, originalHTML);
        } else {
            this.closeEditor();
        }
        
        this.currentEditingNode = null;
    }

    editTextWithEvent(element, event) {
        if (this.currentEditing === element) return;

        this.closeEditor();
        this.currentEditing = element;

        const originalHTML = element.innerHTML;
        const clickedNode = this.findEditableNode(event.target, element);
        
        if (!clickedNode) return;

        this.editSingleNode(clickedNode, element, originalHTML);
    }

    findEditableNode(target, container) {
        if (target.nodeType === Node.TEXT_NODE) {
            return target.parentElement;
        }
        
        if (target !== container && target.textContent.trim()) {
            return target;
        }
        
        const walker = document.createTreeWalker(
            target,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
                }
            }
        );
        
        const firstText = walker.nextNode();
        return firstText ? firstText.parentElement : null;
    }

    editSingleNode(node, container, originalContainerHTML) {
        const originalNodeHTML = node.innerHTML || node.textContent;
    
        node.setAttribute('data-original-html', originalNodeHTML);
        
        container.classList.add('lp2-editing');
        node.contentEditable = 'true';
        node.focus();

        const actions = document.createElement('div');
        actions.className = 'lp2-edit-actions';
        actions.innerHTML = `
            <button class="lp2-edit-btn lp2-btn-save" title="Save (Enter)">✓</button>
            <button class="lp2-edit-btn lp2-btn-cancel" title="Cancel (Esc)">✕</button>
        `;
        container.style.position = 'relative';
        container.appendChild(actions);

        const saveBtn = actions.querySelector('.lp2-btn-save');
        const cancelBtn = actions.querySelector('.lp2-btn-cancel');

        this.currentEditingNode = node;

        const save = () => {
            const newText = node.textContent.trim();
            const originalText = (originalNodeHTML.replace ? originalNodeHTML.replace(/<[^>]*>/g, '') : originalNodeHTML).trim();
            
            if (newText !== originalText && newText !== '') {
                const newContainerHTML = container.innerHTML.replace(actions.outerHTML, '');
                this.debouncedSave(container, newContainerHTML);
            }
            
            node.removeAttribute('data-original-html');
            this.finishEditing(node, container, actions, originalNodeHTML);
        };

        const cancel = () => {
            if (node.innerHTML !== undefined) {
                node.innerHTML = originalNodeHTML;
            } else {
                node.textContent = originalNodeHTML;
            }
            node.removeAttribute('data-original-html');
            this.finishEditing(node, container, actions, originalNodeHTML);
        };

        saveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            save();
        });

        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            cancel();
        });

        node.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                save();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
            }
        });

        node.addEventListener('paste', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const clipboardData = e.clipboardData || window.clipboardData;
            
            const plainText = clipboardData.getData('text/plain') || '';
            const htmlText = clipboardData.getData('text/html') || '';
            
            let text = '';
            
            const sourceText = plainText || htmlText;
            
            if (sourceText.includes('<') && sourceText.includes('>')) {
                const temp = document.createElement('div');
                temp.innerHTML = sourceText;
                text = temp.textContent || temp.innerText || '';
            } else {
                text = sourceText;
            }
            
            text = text.trim();
            
            if (!text) return;
            
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            
            const range = selection.getRangeAt(0);
            range.deleteContents();
            
            const textNode = document.createTextNode(text);
            range.insertNode(textNode);
            
            range.setStartAfter(textNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        });
    }

    finishEditing(node, container, actions, originalHTML) {
        node.contentEditable = 'false';
        node.blur();
        node.removeAttribute('data-original-html');
        container.classList.remove('lp2-editing');
        if (actions && actions.parentNode) {
            actions.remove();
        }
        this.currentEditing = null;
        this.currentEditingNode = null;
    }

    async editIcon(element) {
    this.closeEditor();
    this.currentEditing = element;

    const classes = Array.from(element.classList);
    const faClass = classes.find(c => c.startsWith('fa-') && !['fa', 'fas', 'far', 'fal', 'fab'].includes(c));
    const currentIcon = faClass ? faClass.replace('fa-', '') : '';

    const overlay = document.createElement('div');
    overlay.className = 'lp2-overlay';

    const editor = document.createElement('div');
    editor.className = 'lp2-icon-editor';
    editor.innerHTML = `
        <h3>Edit Icon</h3>
        
        <div style="position: relative;">
            <input type="text" 
                   class="lp2-icon-input" 
                   value="${currentIcon}" 
                   placeholder="Search icons... (e.g. shield, star, heart)"
                   autocomplete="off">
            <div class="lp2-icon-search-results" style="display: none;"></div>
        </div>
        
        <div class="lp2-icon-preview">
            <i class="${element.className.replace(faClass, '')} fa-${currentIcon}"></i>
        </div>
        
        <div class="lp2-icon-grid" style="max-height: 300px; overflow-y: auto; display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; margin: 20px 0; padding: 16px; background: #f8f9fa; border-radius: 8px;">
            <div style="grid-column: 1 / -1; text-align: center; color: #6c757d; padding: 20px;">
                <div class="lp2-loading">Loading icons...</div>
            </div>
        </div>
        
        <div class="lp2-icon-buttons">
            <button class="lp2-icon-btn lp2-icon-btn-secondary" data-action="cancel">Cancel</button>
            <button class="lp2-icon-btn lp2-icon-btn-primary" data-action="save">Save Icon</button>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(editor);

    const input = editor.querySelector('.lp2-icon-input');
    const preview = editor.querySelector('.lp2-icon-preview i');
    const grid = editor.querySelector('.lp2-icon-grid');
    const searchResults = editor.querySelector('.lp2-icon-search-results');

    const popularIcons = await this.loadFontAwesomeIcons();

    const renderIcons = (icons) => {
        grid.innerHTML = icons.map(iconName => `
            <div class="lp2-icon-item" 
                 data-icon="${iconName}"
                 style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border: 2px solid #dee2e6; border-radius: 6px; cursor: pointer; transition: all 0.2s; background: white;"
                 title="${iconName}">
                <i class="fas fa-${iconName}" style="font-size: 20px; color: #495057;"></i>
            </div>
        `).join('');

        grid.querySelectorAll('.lp2-icon-item').forEach(item => {
            item.addEventListener('mouseenter', function() {
                this.style.borderColor = '#007bff';
                this.style.background = '#e7f3ff';
                this.style.transform = 'scale(1.1)';
            });

            item.addEventListener('mouseleave', function() {
                this.style.borderColor = '#dee2e6';
                this.style.background = 'white';
                this.style.transform = 'scale(1)';
            });

            item.addEventListener('click', function() {
                const iconName = this.getAttribute('data-icon');
                input.value = iconName;
                preview.className = element.className.replace(faClass, '') + ` fa-${iconName}`;
                
                grid.querySelectorAll('.lp2-icon-item').forEach(i => {
                    i.style.borderColor = '#dee2e6';
                    i.style.background = 'white';
                });
                this.style.borderColor = '#28a745';
                this.style.background = '#d4edda';
            });
        });

        const currentItem = grid.querySelector(`[data-icon="${currentIcon}"]`);
        if (currentItem) {
            currentItem.style.borderColor = '#28a745';
            currentItem.style.background = '#d4edda';
            currentItem.scrollIntoView({ block: 'center' });
        }
    };

    renderIcons(popularIcons);

    let searchTimeout;
    input.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const query = input.value.trim().toLowerCase();
        
        preview.className = element.className.replace(faClass, '') + ` fa-${query}`;

        searchTimeout = setTimeout(() => {
            if (query) {
                const filtered = popularIcons.filter(icon => icon.includes(query));
                renderIcons(filtered.length > 0 ? filtered : popularIcons);
            } else {
                renderIcons(popularIcons);
            }
        }, 300);
    });

    editor.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        if (btn.dataset.action === 'save') {
            const newIcon = input.value.trim();
            if (newIcon && newIcon !== currentIcon) {
                this.saveIcon(element, faClass, newIcon);
            }
        }

        overlay.remove();
        editor.remove();
        this.currentEditing = null;
    });

    overlay.addEventListener('click', () => {
        overlay.remove();
        editor.remove();
        this.currentEditing = null;
    });

    input.focus();
    input.select();

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const newIcon = input.value.trim();
            if (newIcon && newIcon !== currentIcon) {
                this.saveIcon(element, faClass, newIcon);
            }
            overlay.remove();
            editor.remove();
            this.currentEditing = null;
        } else if (e.key === 'Escape') {
            overlay.remove();
            editor.remove();
            this.currentEditing = null;
        }
    });
}

    saveIcon(element, oldClass, newIcon) {
        const newClass = `fa-${newIcon}`;
        element.classList.remove(oldClass);
        element.classList.add(newClass);
        this.debouncedSave(element, newIcon);
    }

    async saveField(element, value) {
        const fieldName = element.getAttribute('data-meta');
        if (!fieldName) return;

        this.trackChange();

        try {
            const response = await fetch(window.abtFrontend?.ajaxUrl || '/wp-admin/admin-ajax.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                credentials: 'same-origin',
                body: new URLSearchParams({
                    action: 'lp2_save_field',
                    post_id: this.postId,
                    field_name: fieldName,
                    value: value,
                    nonce: window.abtFrontend?.nonce || ''
                })
            });

            const result = await response.json();

            if (!result.success) {
                console.error('LP2: Save failed', result);
            }

        } catch (error) {
            console.error('LP2: Save error', error);
        }
    }

    closeEditor() {
        if (this.currentEditing) {
            const actions = document.querySelector('.lp2-edit-actions');
            if (actions) actions.remove();
            
            this.currentEditing.classList.remove('lp2-editing');
            
            const editableNode = this.currentEditing.querySelector('[contenteditable="true"]');
            if (editableNode) {
                editableNode.contentEditable = 'false';
                editableNode.removeAttribute('data-original-html');
            }
            
            this.currentEditing = null;
        }

        document.querySelectorAll('.lp2-overlay, .lp2-icon-editor').forEach(el => el.remove());
    }

    trackChange() {
        if (!this.hasChanges) {
            this.hasChanges = true;
            this.showSaveButton();
        }
    }

    showSaveButton() {
        if (this.saveButton) return;

        this.saveButton = document.createElement('button');
        this.saveButton.id = 'lp2-save-changes';
        this.saveButton.textContent = '✓ Saved';

        document.body.appendChild(this.saveButton);

        setTimeout(() => {
            if (this.saveButton) {
                this.saveButton.style.opacity = '0';
                setTimeout(() => {
                    if (this.saveButton) {
                        this.saveButton.remove();
                        this.saveButton = null;
                        this.hasChanges = false;
                    }
                }, 300);
            }
        }, 2000);
    }

    addKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentEditing) {
                this.cancelCurrentEdit();
            }
        });
    }

    isUserLoggedIn() {
        return document.body.classList.contains('logged-in') ||
               document.getElementById('wpadminbar') !== null;
    }

    debounce(func, delay) {
        let timeoutId;
        const debounced = function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
        debounced.cancel = () => clearTimeout(timeoutId);
        return debounced;
    }
}

(function() {
    if (window.LP2TextEditor?.initialized) return;

    function init() {
        try {
            window.LP2TextEditor = new LP2TextEditor();
            window.LP2TextEditor.initialized = true;
        } catch (error) {
            console.error('LP2 Text Editor: Init failed', error);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        requestAnimationFrame(init);
    }
})();