// =============================================
// Add Question System - Two Ways
// =============================================

let tempQuestions = []; // Temporary storage for UI mode questions
let currentEditIndex = -1; // For editing

// Main function to show add question dialog
function showAddQuestionDialog() {
    if (!currentFolder) {
        showToast("Please select a folder first!", 'warning');
        return;
    }

    // Remove existing modal if any
    const existingModal = document.querySelector('.add-question-modal');
    if (existingModal) existingModal.remove();

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'add-question-modal';
    modal.innerHTML = `
        <div class="add-question-container glass-card">
            <div class="add-question-tabs">
                <button class="tab-btn active" onclick="switchTab('bulk')">
                    <i class="fas fa-code"></i>
                    <span>Bulk Add (JSON)</span>
                </button>
                <button class="tab-btn" onclick="switchTab('ui')">
                    <i class="fas fa-pencil-alt"></i>
                    <span>UI Add (Form)</span>
                </button>
                <button class="tab-btn" onclick="switchTab('preview')">
                    <i class="fas fa-eye"></i>
                    <span>Preview</span>
                </button>
            </div>

            <!-- Bulk Add Tab -->
            <div id="bulkTab" class="tab-content active">
                <div class="bulk-add-section">
                    <div class="json-format-info">
                        <h4><i class="fas fa-info-circle"></i> JSON Format</h4>
                        <pre>
[
  {
    "question": "Your question here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Explanation here (optional)"
  }
]</pre>
                        <p><small>⚠️ correctIndex starts from 0 (A=0, B=1, C=2, D=3)</small></p>
                    </div>

                    <textarea id="jsonInput" class="json-editor" placeholder="Paste your JSON array here..."></textarea>

                    <div class="position-controls">
                        <label>
                            <i class="fas fa-sort-numeric-down"></i>
                            Position:
                            <input type="number" id="insertPosition" min="1" placeholder="End">
                        </label>
                        <div class="radio-group">
                            <label>
                                <input type="radio" name="positionType" value="before" checked> Insert at position
                            </label>
                            <label>
                                <input type="radio" name="positionType" value="after"> Append at end
                            </label>
                        </div>
                    </div>

                    <div class="json-preview">
                        <h4><i class="fas fa-eye"></i> Preview</h4>
                        <div id="jsonPreviewList" class="preview-list"></div>
                    </div>

                    <div class="question-actions">
                        <button class="secondary-btn" onclick="validateAndPreviewJSON()">
                            <i class="fas fa-eye"></i> Preview
                        </button>
                        <button class="primary-btn" onclick="addBulkQuestions()">
                            <i class="fas fa-plus-circle"></i> Add All Questions
                        </button>
                    </div>
                </div>
            </div>

            <!-- UI Add Tab -->
            <div id="uiTab" class="tab-content">
                <div class="ui-add-section">
                    <div class="question-form" id="questionForm">
                        <div class="form-row">
                            <label><i class="fas fa-question-circle"></i> Question:</label>
                            <textarea id="questionInput" rows="3" placeholder="Enter your question..."></textarea>
                        </div>

                        <div class="form-row">
                            <label><i class="fas fa-list"></i> Options (select correct one):</label>
                            <div id="optionsContainer" class="options-list">
                                ${generateOptionFields(4)}
                            </div>
                            <button type="button" class="add-option-btn" onclick="addOptionField()">
                                <i class="fas fa-plus"></i> Add Option
                            </button>
                        </div>

                        <div class="form-row">
                            <label><i class="fas fa-info-circle"></i> Explanation (optional):</label>
                            <textarea id="explanationInput" rows="3" placeholder="Explain the correct answer..."></textarea>
                        </div>

                        <div class="question-actions">
                            <button class="secondary-btn" onclick="clearForm()">
                                <i class="fas fa-eraser"></i> Clear
                            </button>
                            <button class="primary-btn" onclick="saveQuestion()">
                                <i class="fas fa-save"></i> Save Question
                            </button>
                        </div>
                    </div>

                    <div class="saved-questions">
                        <h4><i class="fas fa-list"></i> Saved Questions (${tempQuestions.length})</h4>
                        <div id="savedQuestionsList" class="saved-questions-list">
                            ${renderSavedQuestions()}
                        </div>
                        
                        <div class="position-controls" style="margin: 16px 0;">
                            <label>
                                <i class="fas fa-sort-numeric-down"></i>
                                Insert at position:
                                <input type="number" id="uiInsertPosition" min="1" placeholder="End">
                            </label>
                        </div>

                        <div class="bulk-actions">
                            <button class="secondary-btn" onclick="clearAllSaved()">
                                <i class="fas fa-trash"></i> Clear All
                            </button>
                            <button class="primary-btn" onclick="addAllUIOQuestions()">
                                <i class="fas fa-plus-circle"></i> Add All to Folder
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Preview Tab -->
            <div id="previewTab" class="tab-content">
                <div class="json-preview" style="max-height: 500px; overflow-y: auto;">
                    <h4><i class="fas fa-eye"></i> Questions to be Added</h4>
                    <div id="finalPreviewList" class="preview-list"></div>
                </div>
            </div>

            <div class="modal-footer">
                <button class="secondary-btn" onclick="closeAddQuestionModal()">
                    <i class="fas fa-times"></i> Cancel
                </button>
                <button class="primary-btn" onclick="addAllQuestions()">
                    <i class="fas fa-check"></i> Add All to Folder
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    updateAllPreviews();
}

// Generate option fields HTML
function generateOptionFields(count, values = [], correctIndex = -1) {
    let html = '';
    for (let i = 0; i < count; i++) {
        const letter = String.fromCharCode(65 + i);
        const value = values[i] || '';
        const checked = i === correctIndex ? 'checked' : '';
        html += `
            <div class="option-item" id="option-${i}">
                <span class="option-number">${letter}</span>
                <input type="text" id="opt${i}" value="${value.replace(/"/g, '&quot;')}" placeholder="Option ${letter}">
                <input type="radio" name="correctOption" value="${i}" ${checked}>
                <span style="margin-right: auto;">Correct</span>
                ${i >= 4 ? `<button class="remove-option" onclick="removeOptionField(${i})"><i class="fas fa-times"></i></button>` : ''}
            </div>
        `;
    }
    return html;
}

// Switch between tabs
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.closest('.tab-btn').classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Update previews
    updateAllPreviews();
}

// Add new option field
function addOptionField() {
    const container = document.getElementById('optionsContainer');
    const currentCount = container.children.length;
    const letter = String.fromCharCode(65 + currentCount);
    
    const newOption = document.createElement('div');
    newOption.className = 'option-item';
    newOption.id = `option-${currentCount}`;
    newOption.innerHTML = `
        <span class="option-number">${letter}</span>
        <input type="text" id="opt${currentCount}" placeholder="Option ${letter}">
        <input type="radio" name="correctOption" value="${currentCount}">
        <span style="margin-right: auto;">Correct</span>
        <button class="remove-option" onclick="removeOptionField(${currentCount})">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(newOption);
}

// Remove option field
function removeOptionField(index) {
    const option = document.getElementById(`option-${index}`);
    if (option) {
        option.remove();
        // Renumber remaining options
        renumberOptions();
    }
}

// Renumber options after removal
function renumberOptions() {
    const container = document.getElementById('optionsContainer');
    const options = container.children;
    
    for (let i = 0; i < options.length; i++) {
        const option = options[i];
        option.id = `option-${i}`;
        const letter = String.fromCharCode(65 + i);
        
        // Update option number
        option.querySelector('.option-number').textContent = letter;
        
        // Update input ID and placeholder
        const input = option.querySelector('input[type="text"]');
        input.id = `opt${i}`;
        input.placeholder = `Option ${letter}`;
        
        // Update radio value
        const radio = option.querySelector('input[type="radio"]');
        radio.value = i;
        
        // Update remove button onclick
        const removeBtn = option.querySelector('.remove-option');
        if (removeBtn) {
            removeBtn.setAttribute('onclick', `removeOptionField(${i})`);
        }
    }
}

// Save question from UI form
function saveQuestion() {
    // Get question
    const question = document.getElementById('questionInput').value.trim();
    if (!question) {
        showToast('Please enter a question', 'warning');
        return;
    }
    
    // Get options
    const options = [];
    const optionInputs = document.querySelectorAll('#optionsContainer input[type="text"]');
    optionInputs.forEach(input => {
        if (input.value.trim()) {
            options.push(input.value.trim());
        }
    });
    
    if (options.length < 2) {
        showToast('Please add at least 2 options', 'warning');
        return;
    }
    
    // Get correct index
    const correctRadio = document.querySelector('input[name="correctOption"]:checked');
    if (!correctRadio) {
        showToast('Please select the correct answer', 'warning');
        return;
    }
    const correctIndex = parseInt(correctRadio.value);
    
    // Get explanation
    const explanation = document.getElementById('explanationInput').value.trim();
    
    // Create question object
    const newQuestion = {
        question: question,
        options: options,
        correctIndex: correctIndex,
        explanation: explanation || ''
    };
    
    if (currentEditIndex >= 0) {
        // Edit existing
        tempQuestions[currentEditIndex] = newQuestion;
        currentEditIndex = -1;
        showToast('Question updated successfully!', 'success');
    } else {
        // Add new
        tempQuestions.push(newQuestion);
        showToast('Question saved to list!', 'success');
    }
    
    // Clear form
    clearForm();
    
    // Update saved questions list
    updateSavedQuestionsList();
    updateAllPreviews();
}

// Clear form
function clearForm() {
    document.getElementById('questionInput').value = '';
    document.getElementById('explanationInput').value = '';
    
    // Reset options to 4 default
    const container = document.getElementById('optionsContainer');
    container.innerHTML = generateOptionFields(4);
    
    currentEditIndex = -1;
}

// Edit saved question
function editSavedQuestion(index) {
    const question = tempQuestions[index];
    if (!question) return;
    
    // Fill form
    document.getElementById('questionInput').value = question.question;
    document.getElementById('explanationInput').value = question.explanation || '';
    
    // Generate options
    const container = document.getElementById('optionsContainer');
    container.innerHTML = generateOptionFields(
        Math.max(4, question.options.length),
        question.options,
        question.correctIndex
    );
    
    currentEditIndex = index;
    
    // Switch to UI tab
    document.querySelectorAll('.tab-btn')[1].click();
}

// Delete saved question
function deleteSavedQuestion(index) {
    if (confirm('Remove this question from list?')) {
        tempQuestions.splice(index, 1);
        updateSavedQuestionsList();
        updateAllPreviews();
        showToast('Question removed', 'info');
    }
}

// Clear all saved questions
function clearAllSaved() {
    if (confirm('Clear all saved questions?')) {
        tempQuestions = [];
        updateSavedQuestionsList();
        updateAllPreviews();
        showToast('All questions cleared', 'info');
    }
}

// Render saved questions list
function renderSavedQuestions() {
    if (tempQuestions.length === 0) {
        return '<div class="empty-state">No questions saved yet</div>';
    }
    
    return tempQuestions.map((q, index) => `
        <div class="saved-question-item">
            <div class="saved-question-info">
                <div class="saved-question-text">${q.question.substring(0, 50)}${q.question.length > 50 ? '...' : ''}</div>
                <div class="saved-question-meta">
                    <span>${q.options.length} options</span>
                    <span>✓ ${q.options[q.correctIndex]}</span>
                </div>
            </div>
            <div class="saved-question-actions">
                <button class="edit-saved-btn" onclick="editSavedQuestion(${index})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-saved-btn" onclick="deleteSavedQuestion(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// Update saved questions list
function updateSavedQuestionsList() {
    const list = document.getElementById('savedQuestionsList');
    if (list) {
        list.innerHTML = renderSavedQuestions();
    }
}

// Validate and preview JSON
function validateAndPreviewJSON() {
    const jsonInput = document.getElementById('jsonInput').value.trim();
    if (!jsonInput) {
        showToast('Please enter JSON data', 'warning');
        return;
    }
    
    try {
        const questions = JSON.parse(jsonInput);
        
        if (!Array.isArray(questions)) {
            showToast('JSON must be an array', 'error');
            return;
        }
        
        // Validate each question
        const validQuestions = [];
        const errors = [];
        
        questions.forEach((q, i) => {
            if (!q.question || !Array.isArray(q.options) || q.correctIndex === undefined) {
                errors.push(`Question ${i+1}: Missing required fields`);
            } else if (q.options.length < 2) {
                errors.push(`Question ${i+1}: At least 2 options required`);
            } else if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
                errors.push(`Question ${i+1}: Invalid correctIndex`);
            } else {
                validQuestions.push(q);
            }
        });
        
        if (errors.length > 0) {
            showToast(errors[0], 'error');
            console.error(errors);
        }
        
        // Show preview
        const previewList = document.getElementById('jsonPreviewList');
        previewList.innerHTML = validQuestions.map((q, i) => `
            <div class="preview-item">
                <strong>${i+1}.</strong> ${q.question.substring(0, 60)}${q.question.length > 60 ? '...' : ''}
                <br><small>Options: ${q.options.length} | Correct: ${q.options[q.correctIndex]}</small>
            </div>
        `).join('');
        
        if (validQuestions.length === 0) {
            previewList.innerHTML = '<div class="empty-state">No valid questions</div>';
        }
        
        // Store valid questions in dataset
        document.getElementById('jsonInput').dataset.validQuestions = JSON.stringify(validQuestions);
        
    } catch (e) {
        showToast('Invalid JSON: ' + e.message, 'error');
    }
}

// Add bulk questions from JSON
function addBulkQuestions() {
    const jsonInput = document.getElementById('jsonInput');
    const validQuestions = jsonInput.dataset.validQuestions;
    
    if (!validQuestions) {
        showToast('Please validate JSON first', 'warning');
        return;
    }
    
    const questions = JSON.parse(validQuestions);
    if (questions.length === 0) {
        showToast('No valid questions to add', 'warning');
        return;
    }
    
    // Get position
    const position = document.getElementById('insertPosition').value;
    const positionType = document.querySelector('input[name="positionType"]:checked').value;
    
    let insertIndex = -1;
    if (positionType === 'before' && position) {
        insertIndex = parseInt(position) - 1;
    }
    
    // Add questions
    if (insertIndex >= 0 && insertIndex <= quizzes[currentFolder].length) {
        quizzes[currentFolder].splice(insertIndex, 0, ...questions);
    } else {
        quizzes[currentFolder].push(...questions);
    }
    
    // Save to IndexedDB
    saveQuizzes().then(() => {
        showToast(`${questions.length} questions added successfully!`, 'success');
        closeAddQuestionModal();
    });
}

// Add all UI questions
function addAllUIOQuestions() {
    if (tempQuestions.length === 0) {
        showToast('No questions to add', 'warning');
        return;
    }
    
    const position = document.getElementById('uiInsertPosition').value;
    let insertIndex = position ? parseInt(position) - 1 : -1;
    
    if (insertIndex >= 0 && insertIndex <= quizzes[currentFolder].length) {
        quizzes[currentFolder].splice(insertIndex, 0, ...tempQuestions);
    } else {
        quizzes[currentFolder].push(...tempQuestions);
    }
    
    saveQuizzes().then(() => {
        showToast(`${tempQuestions.length} questions added successfully!`, 'success');
        tempQuestions = [];
        closeAddQuestionModal();
    });
}

// Add all questions from both methods
function addAllQuestions() {
    // Check if there are UI questions
    if (tempQuestions.length > 0) {
        addAllUIOQuestions();
        return;
    }
    
    // Check if there are JSON questions
    const jsonInput = document.getElementById('jsonInput');
    if (jsonInput && jsonInput.dataset.validQuestions) {
        addBulkQuestions();
        return;
    }
    
    showToast('No questions to add', 'warning');
}

// Update all previews
function updateAllPreviews() {
    // Update JSON preview if exists
    if (document.getElementById('jsonPreviewList')) {
        validateAndPreviewJSON();
    }
    
    // Update final preview
    const finalPreview = document.getElementById('finalPreviewList');
    if (finalPreview) {
        let allQuestions = [...tempQuestions];
        
        // Add JSON questions if any
        const jsonInput = document.getElementById('jsonInput');
        if (jsonInput && jsonInput.dataset.validQuestions) {
            try {
                allQuestions = [...allQuestions, ...JSON.parse(jsonInput.dataset.validQuestions)];
            } catch (e) {}
        }
        
        if (allQuestions.length === 0) {
            finalPreview.innerHTML = '<div class="empty-state">No questions to add</div>';
        } else {
            finalPreview.innerHTML = allQuestions.map((q, i) => `
                <div class="preview-item">
                    <strong>${i+1}.</strong> ${q.question.substring(0, 60)}${q.question.length > 60 ? '...' : ''}
                    <br><small>Options: ${q.options.length} | Correct: ${q.options[q.correctIndex]}</small>
                </div>
            `).join('');
        }
    }
}

// Close modal
function closeAddQuestionModal() {
    const modal = document.querySelector('.add-question-modal');
    if (modal) {
        modal.remove();
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    // Make functions global
    window.showAddQuestionDialog = showAddQuestionDialog;
    window.switchTab = switchTab;
    window.addOptionField = addOptionField;
    window.removeOptionField = removeOptionField;
    window.saveQuestion = saveQuestion;
    window.clearForm = clearForm;
    window.editSavedQuestion = editSavedQuestion;
    window.deleteSavedQuestion = deleteSavedQuestion;
    window.clearAllSaved = clearAllSaved;
    window.validateAndPreviewJSON = validateAndPreviewJSON;
    window.addBulkQuestions = addBulkQuestions;
    window.addAllUIOQuestions = addAllUIOQuestions;
    window.addAllQuestions = addAllQuestions;
    window.closeAddQuestionModal = closeAddQuestionModal;
});