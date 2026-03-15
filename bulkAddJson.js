// =============================================
// Bulk Add Questions via JSON - Complete Solution
// =============================================

let validatedQuestions = []; // Store validated questions

// Main function to open Bulk Add JSON modal
function showBulkAddJSON() {
    if (!currentFolder) {
        showToast("Please select a folder first!", 'warning');
        return;
    }

    // Remove existing modal if any
    const existingModal = document.querySelector('.bulk-json-modal');
    if (existingModal) existingModal.remove();

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'bulk-json-modal';
    modal.innerHTML = `
        <div class="bulk-json-container glass-card">
            <div class="bulk-json-header">
                <h3>
                    <i class="fas fa-code"></i>
                    Bulk Add Questions via JSON
                </h3>
                <button class="close-modal-btn" onclick="closeBulkAddModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <div class="bulk-json-content">
                <!-- JSON Format Info -->
                <div class="json-format-box">
                    <h4><i class="fas fa-info-circle"></i> JSON Format Example:</h4>
                    <pre>
[
  {
    "question": "What is the capital of France?",
    "options": ["London", "Paris", "Berlin", "Madrid"],
    "correctIndex": 1,
    "explanation": "Paris is the capital of France."
  },
  {
    "question": "Which planet is known as the Red Planet?",
    "options": ["Venus", "Mars", "Jupiter", "Saturn"],
    "correctIndex": 1,
    "explanation": "Mars appears red due to iron oxide."
  }
]</pre>
                    <button class="example-button" onclick="loadExampleJSON()">
                        <i class="fas fa-copy"></i> Load Example
                    </button>
                </div>

                <!-- JSON Input Area -->
                <div class="json-input-area">
                    <label><i class="fas fa-pencil-alt"></i> Paste your JSON here:</label>
                    <textarea id="jsonBulkInput" class="json-textarea" placeholder='[{"question": "...", "options": ["...", "..."], "correctIndex": 0}]'></textarea>
                </div>

                <!-- Validation Status -->
                <div id="validationStatus" class="validation-status" style="display: none;"></div>

                <!-- Preview Section -->
                <div class="preview-section">
                    <h4><i class="fas fa-eye"></i> Preview (Valid Questions)</h4>
                    <div id="previewList" class="preview-list">
                        <div class="empty-preview">No questions to preview. Paste JSON and click Validate.</div>
                    </div>
                </div>

                <!-- Position Controls -->
                <div class="position-controls">
                    <h4><i class="fas fa-sort-amount-down"></i> Where to add these questions?</h4>
                    <div class="position-options">
                        <div class="position-radio-group">
                            <label>
                                <input type="radio" name="bulkPosition" value="end" checked>
                                <i class="fas fa-arrow-down"></i> Add at the end
                            </label>
                            <label>
                                <input type="radio" name="bulkPosition" value="start">
                                <i class="fas fa-arrow-up"></i> Add at the beginning
                            </label>
                            <label>
                                <input type="radio" name="bulkPosition" value="position">
                                <i class="fas fa-sort-numeric-down"></i> Insert at position
                            </label>
                        </div>
                        <div class="position-number-input" id="positionNumberInput" style="display: none;">
                            <label>
                                Position number:
                                <input type="number" id="insertPosition" min="1" value="1">
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Current Folder Info -->
                <div class="current-folder-info">
                    <i class="fas fa-folder"></i>
                    Adding to folder: <strong>${currentFolder}</strong> (Current questions: ${quizzes[currentFolder]?.length || 0})
                </div>
            </div>

            <div class="bulk-json-footer">
                <button class="secondary-btn" onclick="validateJSON()">
                    <i class="fas fa-check-circle"></i> Validate JSON
                </button>
                <button class="primary-btn" onclick="addBulkQuestions()" id="addBulkBtn" disabled>
                    <i class="fas fa-plus-circle"></i> Add Questions
                </button>
                <button class="secondary-btn" onclick="closeBulkAddModal()">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add event listener for position radio
    document.querySelectorAll('input[name="bulkPosition"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const positionInput = document.getElementById('positionNumberInput');
            positionInput.style.display = this.value === 'position' ? 'block' : 'none';
        });
    });
}

// Load example JSON
function loadExampleJSON() {
    const example = [
        {
            question: "What is the capital of France?",
            options: ["London", "Paris", "Berlin", "Madrid"],
            correctIndex: 1,
            explanation: "Paris is the capital of France."
        },
        {
            question: "Which planet is known as the Red Planet?",
            options: ["Venus", "Mars", "Jupiter", "Saturn"],
            correctIndex: 1,
            explanation: "Mars appears red due to iron oxide."
        },
        {
            question: "What is 2 + 2?",
            options: ["3", "4", "5", "6"],
            correctIndex: 1,
            explanation: "Basic mathematics: 2 + 2 = 4"
        }
    ];
    
    document.getElementById('jsonBulkInput').value = JSON.stringify(example, null, 2);
    validateJSON(); // Auto validate
}

// Validate JSON
function validateJSON() {
    const jsonInput = document.getElementById('jsonBulkInput').value.trim();
    const statusDiv = document.getElementById('validationStatus');
    const previewList = document.getElementById('previewList');
    const addBtn = document.getElementById('addBulkBtn');
    
    if (!jsonInput) {
        showValidationStatus('Please enter JSON data', 'warning');
        return;
    }
    
    try {
        const parsed = JSON.parse(jsonInput);
        
        if (!Array.isArray(parsed)) {
            showValidationStatus('JSON must be an array of questions', 'error');
            return;
        }
        
        // Validate each question
        validatedQuestions = [];
        const errors = [];
        const warnings = [];
        
        parsed.forEach((item, index) => {
            const questionNum = index + 1;
            
            // Check required fields
            if (!item.question) {
                errors.push(`Question ${questionNum}: Missing "question" field`);
                return;
            }
            
            if (!Array.isArray(item.options)) {
                errors.push(`Question ${questionNum}: "options" must be an array`);
                return;
            }
            
            if (item.options.length < 2) {
                errors.push(`Question ${questionNum}: At least 2 options required`);
                return;
            }
            
            if (item.correctIndex === undefined || item.correctIndex === null) {
                errors.push(`Question ${questionNum}: Missing "correctIndex" field`);
                return;
            }
            
            if (item.correctIndex < 0 || item.correctIndex >= item.options.length) {
                errors.push(`Question ${questionNum}: "correctIndex" must be between 0 and ${item.options.length - 1}`);
                return;
            }
            
            // Valid question
            validatedQuestions.push({
                question: item.question,
                options: item.options,
                correctIndex: item.correctIndex,
                explanation: item.explanation || ''
            });
        });
        
        // Show validation result
        if (errors.length > 0) {
            showValidationStatus(`${errors.length} error(s) found. ${validatedQuestions.length} valid question(s).`, 'error');
            // Log errors to console for debugging
            console.error('Validation errors:', errors);
        } else if (validatedQuestions.length === 0) {
            showValidationStatus('No valid questions found', 'warning');
        } else {
            showValidationStatus(`${validatedQuestions.length} valid question(s) ready to add!`, 'success');
        }
        
        // Update preview
        updatePreview(validatedQuestions);
        
        // Enable/disable add button
        addBtn.disabled = validatedQuestions.length === 0;
        
    } catch (e) {
        showValidationStatus('Invalid JSON: ' + e.message, 'error');
        validatedQuestions = [];
        updatePreview([]);
        addBtn.disabled = true;
    }
}

// Show validation status
function showValidationStatus(message, type) {
    const statusDiv = document.getElementById('validationStatus');
    statusDiv.style.display = 'flex';
    statusDiv.className = `validation-status ${type}`;
    
    const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : '⚠️');
    statusDiv.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle')}"></i> ${message}`;
}

// Update preview
function updatePreview(questions) {
    const previewList = document.getElementById('previewList');
    
    if (questions.length === 0) {
        previewList.innerHTML = '<div class="empty-preview">No valid questions to preview</div>';
        return;
    }
    
    previewList.innerHTML = questions.map((q, index) => {
        const correctOption = q.options[q.correctIndex];
        
        return `
            <div class="preview-item">
                <div class="preview-question">
                    <i class="fas fa-question-circle" style="color: var(--primary-color);"></i>
                    ${index + 1}. ${q.question}
                </div>
                <div class="preview-details">
                    <span><i class="fas fa-list"></i> ${q.options.length} options</span>
                    <span><i class="fas fa-check-circle" style="color: #10b981;"></i> Correct: ${correctOption}</span>
                </div>
                <div class="preview-options">
                    ${q.options.map((opt, i) => `
                        <span class="preview-option ${i === q.correctIndex ? 'correct' : ''}">
                            ${String.fromCharCode(65 + i)}: ${opt.substring(0, 20)}${opt.length > 20 ? '...' : ''}
                        </span>
                    `).join('')}
                </div>
                ${q.explanation ? `<small style="color: #64748b; margin-top: 8px; display: block;"><i class="fas fa-info-circle"></i> ${q.explanation.substring(0, 50)}${q.explanation.length > 50 ? '...' : ''}</small>` : ''}
            </div>
        `;
    }).join('');
}

// Add bulk questions to folder
function addBulkQuestions() {
    if (validatedQuestions.length === 0) {
        showToast('No valid questions to add', 'warning');
        return;
    }
    
    if (!currentFolder || !quizzes[currentFolder]) {
        showToast('Please select a valid folder', 'error');
        return;
    }
    
    // Get position preference
    const positionType = document.querySelector('input[name="bulkPosition"]:checked').value;
    let insertIndex = -1;
    
    if (positionType === 'start') {
        insertIndex = 0;
    } else if (positionType === 'position') {
        const position = parseInt(document.getElementById('insertPosition').value);
        if (!isNaN(position) && position > 0) {
            insertIndex = position - 1; // Convert to 0-based index
        }
    }
    
    // Validate insert index
    if (insertIndex < 0 || insertIndex > quizzes[currentFolder].length) {
        insertIndex = quizzes[currentFolder].length; // Default to end
    }
    
    // Add questions
    if (insertIndex >= 0 && insertIndex <= quizzes[currentFolder].length) {
        // Insert at specific position
        quizzes[currentFolder].splice(insertIndex, 0, ...validatedQuestions);
        showToast(`${validatedQuestions.length} questions inserted at position ${insertIndex + 1}`, 'success');
    } else {
        // Append at end
        quizzes[currentFolder].push(...validatedQuestions);
        showToast(`${validatedQuestions.length} questions added at the end`, 'success');
    }
    
    // Save to IndexedDB
    saveQuizzes().then(() => {
        // Update folder list if needed
        updateFolderList();
        
        // Close modal
        closeBulkAddModal();
        
        // Show success message with details
        showSuccessDetails(validatedQuestions.length, insertIndex);
    }).catch(error => {
        console.error('Error saving questions:', error);
        showToast('Error saving questions to database', 'error');
    });
}

// Show success details
function showSuccessDetails(count, position) {
    const details = document.createElement('div');
    details.className = 'toast-notification success';
    details.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        border-radius: 10px;
        z-index: 2100;
        animation: slideIn 0.3s ease;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    `;
    details.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px;">
            <i class="fas fa-check-circle" style="font-size: 2rem;"></i>
            <div>
                <h4 style="margin: 0 0 5px 0;">Successfully Added!</h4>
                <p style="margin: 0; opacity: 0.9;">
                    ${count} question(s) added to "${currentFolder}"<br>
                    Total questions now: ${quizzes[currentFolder].length}
                </p>
            </div>
        </div>
    `;
    
    document.body.appendChild(details);
    
    setTimeout(() => {
        details.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => details.remove(), 300);
    }, 4000);
}

// Close modal
function closeBulkAddModal() {
    const modal = document.querySelector('.bulk-json-modal');
    if (modal) {
        modal.remove();
    }
    validatedQuestions = []; // Clear validated questions
}

// Make functions global
window.showBulkAddJSON = showBulkAddJSON;
window.loadExampleJSON = loadExampleJSON;
window.validateJSON = validateJSON;
window.addBulkQuestions = addBulkQuestions;
window.closeBulkAddModal = closeBulkAddModal;