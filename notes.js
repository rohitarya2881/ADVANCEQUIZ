// notes.js - Complete Notes/Journal System for Quiz Manager

// Global variables for notes
let notesData = {
    entries: {},
    categories: ['Daily Goals', 'Completed Tasks', 'Learning Notes', 'Achievements', 'Reflections']
};

let currentCalendarDate = new Date();
let searchTimeout = null;

// Initialize notes system
function initNotes() {
    loadNotesData();
    updateStreakCounter();
    
    // Set up auto-save
    const noteContent = document.getElementById('noteContent');
    if (noteContent) {
        noteContent.removeEventListener('input', handleAutoSave);
        noteContent.addEventListener('input', handleAutoSave);
    }
    
    // Set up category change handler
    const categorySelect = document.getElementById('noteCategory');
    if (categorySelect) {
        categorySelect.removeEventListener('change', handleCategoryChange);
        categorySelect.addEventListener('change', handleCategoryChange);
    }
}

// Handle auto save
function handleAutoSave() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        autoSaveNote();
    }, 1000);
}

// Handle category change
function handleCategoryChange() {
    autoSaveNote();
}

// Load notes from localStorage
function loadNotesData() {
    const saved = localStorage.getItem('quizNotes');
    if (saved) {
        try {
            notesData = JSON.parse(saved);
            // Ensure categories exist
            if (!notesData.categories) {
                notesData.categories = ['Daily Goals', 'Completed Tasks', 'Learning Notes', 'Achievements', 'Reflections'];
            }
            // Ensure all entries have required fields
            Object.keys(notesData.entries).forEach(date => {
                if (!notesData.entries[date].category) {
                    notesData.entries[date].category = 'Daily Goals';
                }
                if (!notesData.entries[date].completed) {
                    notesData.entries[date].completed = [];
                }
                if (!notesData.entries[date].mood) {
                    notesData.entries[date].mood = 'neutral';
                }
                if (!notesData.entries[date].content) {
                    notesData.entries[date].content = '';
                }
            });
        } catch (e) {
            console.error('Error loading notes:', e);
            resetNotesData();
        }
    } else {
        resetNotesData();
    }
    saveNotesData();
}

// Reset notes data
function resetNotesData() {
    notesData = {
        entries: {},
        categories: ['Daily Goals', 'Completed Tasks', 'Learning Notes', 'Achievements', 'Reflections']
    };
}

// Save notes to localStorage
function saveNotesData() {
    localStorage.setItem('quizNotes', JSON.stringify(notesData));
}

// Main function to show notes interface - FIXED
function showNotes() {
    console.log("showNotes function called"); // Debug log
    
    // Hide other containers
    const quizContainer = document.getElementById("quizContainer");
    const flashcardContainer = document.getElementById("flashcardContainer");
    const analysisContainer = document.getElementById("analysisContainer");
    const quizSelection = document.getElementById("quizSelection");
    
    if (quizContainer) quizContainer.classList.add("hidden");
    if (flashcardContainer) flashcardContainer.classList.add("hidden");
    if (analysisContainer) analysisContainer.classList.add("hidden");
    if (quizSelection) quizSelection.classList.remove("active");
    
    // Remove any existing notes container
    const existingNotes = document.getElementById('notesContainer');
    if (existingNotes) {
        existingNotes.remove();
    }
    
    // Create notes container
    const notesContainer = document.createElement('div');
    notesContainer.id = 'notesContainer';
    notesContainer.className = 'container notes-container';
    
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's note or create default
    let todayNote = notesData.entries[today];
    if (!todayNote) {
        todayNote = {
            content: '',
            category: 'Daily Goals',
            completed: [],
            mood: 'neutral',
            lastModified: new Date().toISOString()
        };
        notesData.entries[today] = todayNote;
        saveNotesData();
    }
    
    // Get streak data
    const streak = calculateStreak();
    
    // Build HTML
    notesContainer.innerHTML = `
        <div class="notes-header">
            <h2>📝 Learning Journal & Goals</h2>
            <div class="notes-controls">
                <button class="notes-btn" onclick="exportNotes()">
                    <span>📥</span> Export
                </button>
                <button class="notes-btn" onclick="importNotes()">
                    <span>📤</span> Import
                </button>
                <button class="notes-btn" onclick="closeNotes()">
                    <span>✖</span> Close
                </button>
            </div>
        </div>
        
        <div class="notes-grid">
            <!-- Left Column - Calendar & Stats -->
            <div class="notes-left-col">
                <div class="notes-stats-card">
                    <h3>🔥 Streak Stats</h3>
                    <div class="streak-display" id="streakDisplay">
                        ${renderStreakDisplay(streak)}
                    </div>
                </div>
                
                <div class="notes-calendar-card">
                    <h3>📅 Journal Calendar</h3>
                    <div class="calendar-header">
                        <button class="calendar-nav" onclick="changeMonth(-1)">←</button>
                        <span id="currentMonthYear"></span>
                        <button class="calendar-nav" onclick="changeMonth(1)">→</button>
                    </div>
                    <div id="notesCalendar" class="notes-calendar"></div>
                    <div class="calendar-legend">
                        <span><span class="legend-dot has-note"></span> Has Notes</span>
                        <span><span class="legend-dot today"></span> Today</span>
                        <span><span class="legend-dot selected"></span> Selected</span>
                    </div>
                </div>
                
                <div class="notes-quick-stats">
                    <h4>📊 Category Stats</h4>
                    <div class="quick-stats-grid" id="quickStatsGrid">
                        ${renderQuickStats()}
                    </div>
                </div>
                
                <div class="notes-tips-card">
                    <h4>💡 Quick Tips</h4>
                    <ul class="tips-list">
                        <li>Write daily goals to stay focused</li>
                        <li>Track completed tasks for motivation</li>
                        <li>Reflect on what you learned</li>
                        <li>Celebrate your achievements</li>
                        <li>Use Ctrl+S to save quickly</li>
                    </ul>
                </div>
            </div>
            
            <!-- Right Column - Note Editor -->
            <div class="notes-right-col">
                <div class="notes-editor-card">
                    <div class="editor-header">
                        <h3 id="editorDateTitle">${formatDate(today)}</h3>
                        <div class="editor-controls">
                            <select id="noteCategory" class="category-select">
                                ${notesData.categories.map(cat => 
                                    `<option value="${cat}" ${cat === todayNote.category ? 'selected' : ''}>${cat}</option>`
                                ).join('')}
                            </select>
                            <div class="mood-selector">
                                <span class="mood-emoji ${todayNote.mood === 'happy' ? 'selected' : ''}" onclick="setMood('happy')" title="Happy">😊</span>
                                <span class="mood-emoji ${todayNote.mood === 'neutral' ? 'selected' : ''}" onclick="setMood('neutral')" title="Neutral">😐</span>
                                <span class="mood-emoji ${todayNote.mood === 'productive' ? 'selected' : ''}" onclick="setMood('productive')" title="Productive">💪</span>
                                <span class="mood-emoji ${todayNote.mood === 'tired' ? 'selected' : ''}" onclick="setMood('tired')" title="Tired">😴</span>
                                <span class="mood-emoji ${todayNote.mood === 'excited' ? 'selected' : ''}" onclick="setMood('excited')" title="Excited">🎉</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="todo-list-section">
                        <h4>✅ Completed Tasks Today</h4>
                        <div class="todo-input-group">
                            <input type="text" id="newTodoInput" placeholder="Add a task you completed..." class="todo-input">
                            <button class="todo-add-btn" onclick="addTodo()">Add</button>
                        </div>
                        <div id="todoList" class="todo-list">
                            ${renderTodoList(todayNote.completed || [])}
                        </div>
                    </div>
                    
                    <div class="notes-textarea-section">
                        <h4 id="textareaCategoryTitle">${todayNote.category} - Notes</h4>
                        <textarea 
                            id="noteContent" 
                            class="notes-textarea" 
                            placeholder="Write your thoughts, goals, achievements, or anything you want to remember..."
                            rows="8">${todayNote.content || ''}</textarea>
                    </div>
                    
                    <div class="editor-footer">
                        <div class="word-count" id="wordCount">
                            Words: ${countWords(todayNote.content || '')}
                        </div>
                        <div class="editor-buttons">
                            <button class="notes-save-btn" onclick="saveCurrentNote()">
                                <span>💾</span> Save Now
                            </button>
                            <button class="notes-clear-btn" onclick="clearTodayNote()">
                                <span>🗑️</span> Clear
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Recent Notes Section -->
                <div class="recent-notes-card">
                    <h4>📚 Recent Entries</h4>
                    <div id="recentNotesList" class="recent-notes-list">
                        ${renderRecentNotes()}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(notesContainer);
    
    // Initialize components
    initNotes();
    renderNotesCalendar();
    
    // Add keyboard shortcut for saving (Ctrl+S)
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveCurrentNote();
        }
    });
    
    console.log("Notes container created and appended"); // Debug log
}

// Render streak display
function renderStreakDisplay(streak) {
    return `
        <div class="streak-item">
            <span class="streak-value">${streak.current}</span>
            <span class="streak-label">Current Streak</span>
        </div>
        <div class="streak-item">
            <span class="streak-value">${streak.longest}</span>
            <span class="streak-label">Longest Streak</span>
        </div>
        <div class="streak-item">
            <span class="streak-value">${streak.total}</span>
            <span class="streak-label">Total Entries</span>
        </div>
    `;
}

// Render quick stats
function renderQuickStats() {
    const categoryCounts = {};
    notesData.categories.forEach(cat => {
        categoryCounts[cat] = 0;
    });
    
    Object.values(notesData.entries).forEach(entry => {
        if (entry.category && categoryCounts.hasOwnProperty(entry.category)) {
            categoryCounts[entry.category]++;
        }
    });
    
    return notesData.categories.map(cat => `
        <div class="quick-stat" onclick="filterByCategory('${cat}')">
            <span class="stat-number">${categoryCounts[cat] || 0}</span>
            <span class="stat-label">${cat}</span>
        </div>
    `).join('');
}

// Render Todo List
function renderTodoList(todos) {
    if (!todos || todos.length === 0) {
        return '<div class="empty-todo">No tasks completed yet today. Add your achievements!</div>';
    }
    
    return todos.map((todo, index) => `
        <div class="todo-item" data-index="${index}">
            <span class="todo-text">✓ ${todo}</span>
            <button class="todo-delete" onclick="deleteTodo(${index})" title="Delete task">✕</button>
        </div>
    `).join('');
}

// Add new todo
function addTodo() {
    const input = document.getElementById('newTodoInput');
    const todo = input.value.trim();
    
    if (!todo) {
        showNotification('Please enter a task description', 'warning');
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    if (!notesData.entries[today]) {
        notesData.entries[today] = {
            content: '',
            category: 'Daily Goals',
            completed: [],
            mood: 'neutral',
            lastModified: new Date().toISOString()
        };
    }
    
    notesData.entries[today].completed.push(todo);
    notesData.entries[today].lastModified = new Date().toISOString();
    saveNotesData();
    
    input.value = '';
    updateTodoList();
    updateRecentNotes();
    
    showNotification('Task added successfully!', 'success');
}

// Delete todo
function deleteTodo(index) {
    const today = new Date().toISOString().split('T')[0];
    if (notesData.entries[today] && notesData.entries[today].completed) {
        notesData.entries[today].completed.splice(index, 1);
        notesData.entries[today].lastModified = new Date().toISOString();
        saveNotesData();
        updateTodoList();
        updateRecentNotes();
        
        showNotification('Task removed', 'info');
    }
}

// Update todo list display
function updateTodoList() {
    const todoList = document.getElementById('todoList');
    if (todoList) {
        const today = new Date().toISOString().split('T')[0];
        const todos = notesData.entries[today]?.completed || [];
        todoList.innerHTML = renderTodoList(todos);
    }
}

// Set mood - FIXED
function setMood(mood) {
    const today = new Date().toISOString().split('T')[0];
    
    if (!notesData.entries[today]) {
        notesData.entries[today] = {
            content: '',
            category: 'Daily Goals',
            completed: [],
            mood: mood,
            lastModified: new Date().toISOString()
        };
    } else {
        notesData.entries[today].mood = mood;
    }
    
    // Update UI
    document.querySelectorAll('.mood-emoji').forEach(emoji => {
        emoji.classList.remove('selected');
    });
    
    // Find and select the clicked emoji
    const clickedEmoji = event.target;
    clickedEmoji.classList.add('selected');
    
    saveNotesData();
    showNotification('Mood updated', 'success');
}

// Auto-save note
function autoSaveNote() {
    const content = document.getElementById('noteContent')?.value;
    const category = document.getElementById('noteCategory')?.value;
    
    if (content !== undefined && category !== undefined) {
        const today = new Date().toISOString().split('T')[0];
        
        if (!notesData.entries[today]) {
            notesData.entries[today] = {
                content: '',
                category: category,
                completed: [],
                mood: 'neutral',
                lastModified: new Date().toISOString()
            };
        }
        
        notesData.entries[today].content = content;
        notesData.entries[today].category = category;
        notesData.entries[today].lastModified = new Date().toISOString();
        
        // Update category title
        const categoryTitle = document.getElementById('textareaCategoryTitle');
        if (categoryTitle) {
            categoryTitle.textContent = `${category} - Notes`;
        }
        
        // Update word count
        const wordCount = document.getElementById('wordCount');
        if (wordCount) {
            wordCount.textContent = `Words: ${countWords(content)}`;
        }
        
        saveNotesData();
        showSaveIndicator();
    }
}

// Show save indicator
function showSaveIndicator() {
    let indicator = document.querySelector('.save-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'save-indicator';
        const footer = document.querySelector('.editor-footer');
        if (footer) {
            footer.appendChild(indicator);
        }
    }
    
    if (indicator) {
        indicator.textContent = '✓ Saved';
        indicator.style.opacity = '1';
        
        setTimeout(() => {
            indicator.style.opacity = '0';
        }, 2000);
    }
}

// Show notification - FIXED
function showNotification(message, type = 'info') {
    // Check if function already exists in global scope to avoid conflicts
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
        return;
    }
    
    const notification = document.createElement('div');
    notification.className = `notes-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 10px 20px;
        background: ${type === 'success' ? '#2ecc71' : type === 'warning' ? '#f39c12' : '#3498db'};
        color: white;
        border-radius: 5px;
        z-index: 1001;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Save current note manually
function saveCurrentNote() {
    autoSaveNote();
    
    const saveBtn = document.querySelector('.notes-save-btn');
    if (saveBtn) {
        const originalHTML = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span>✓</span> Saved!';
        saveBtn.style.backgroundColor = '#27ae60';
        
        setTimeout(() => {
            saveBtn.innerHTML = originalHTML;
            saveBtn.style.backgroundColor = '';
        }, 2000);
    }
    
    updateRecentNotes();
    renderNotesCalendar();
    updateQuickStats();
}

// Clear today's note
function clearTodayNote() {
    if (confirm('Clear today\'s entire entry? This cannot be undone.')) {
        const today = new Date().toISOString().split('T')[0];
        
        notesData.entries[today] = {
            content: '',
            category: 'Daily Goals',
            completed: [],
            mood: 'neutral',
            lastModified: new Date().toISOString()
        };
        
        saveNotesData();
        
        // Reload the editor
        const noteContent = document.getElementById('noteContent');
        const noteCategory = document.getElementById('noteCategory');
        const todoList = document.getElementById('todoList');
        const wordCount = document.getElementById('wordCount');
        const categoryTitle = document.getElementById('textareaCategoryTitle');
        
        if (noteContent) noteContent.value = '';
        if (noteCategory) noteCategory.value = 'Daily Goals';
        if (todoList) todoList.innerHTML = renderTodoList([]);
        if (wordCount) wordCount.textContent = 'Words: 0';
        if (categoryTitle) categoryTitle.textContent = 'Daily Goals - Notes';
        
        // Update mood
        document.querySelectorAll('.mood-emoji').forEach(e => e.classList.remove('selected'));
        const neutralEmoji = document.querySelector('.mood-emoji[onclick="setMood(\'neutral\')"]');
        if (neutralEmoji) neutralEmoji.classList.add('selected');
        
        updateRecentNotes();
        renderNotesCalendar();
        updateQuickStats();
        
        showNotification('Entry cleared', 'info');
    }
}

// Update quick stats
function updateQuickStats() {
    const quickStatsGrid = document.getElementById('quickStatsGrid');
    if (quickStatsGrid) {
        quickStatsGrid.innerHTML = renderQuickStats();
    }
}

// Render recent notes
function renderRecentNotes() {
    const entries = Object.entries(notesData.entries)
        .sort((a, b) => new Date(b[0]) - new Date(a[0]))
        .slice(0, 7);
    
    if (entries.length === 0) {
        return '<div class="no-recent-notes">No previous entries yet. Start writing!</div>';
    }
    
    return entries.map(([date, entry]) => {
        const previewText = entry.content ? 
            (entry.content.substring(0, 50) + (entry.content.length > 50 ? '...' : '')) : 
            'No content';
        const todoCount = entry.completed?.length || 0;
        
        return `
            <div class="recent-note-item" onclick="loadNoteDate('${date}')">
                <div class="recent-note-header">
                    <span class="recent-note-date">${formatDate(date)}</span>
                    <span class="recent-note-category" style="background-color: ${getCategoryColor(entry.category)}">${entry.category || 'Note'}</span>
                </div>
                <div class="recent-note-preview">
                    ${previewText}
                    ${todoCount ? ` <span class="todo-badge">✓${todoCount}</span>` : ''}
                    <span class="mood-indicator">${getMoodEmoji(entry.mood)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Get category color
function getCategoryColor(category) {
    const colors = {
        'Daily Goals': '#4a6fa5',
        'Completed Tasks': '#2ecc71',
        'Learning Notes': '#f39c12',
        'Achievements': '#9b59b6',
        'Reflections': '#e74c3c'
    };
    return colors[category] || '#4a6fa5';
}

// Get mood emoji
function getMoodEmoji(mood) {
    const moods = {
        'happy': '😊',
        'neutral': '😐',
        'productive': '💪',
        'tired': '😴',
        'excited': '🎉'
    };
    return moods[mood] || '😐';
}

// Update recent notes
function updateRecentNotes() {
    const recentList = document.getElementById('recentNotesList');
    if (recentList) {
        recentList.innerHTML = renderRecentNotes();
    }
}

// Load a specific date's note
function loadNoteDate(date) {
    const entry = notesData.entries[date] || {
        content: '',
        category: 'Daily Goals',
        completed: [],
        mood: 'neutral',
        lastModified: new Date().toISOString()
    };
    
    // Update UI
    const editorDateTitle = document.getElementById('editorDateTitle');
    const noteContent = document.getElementById('noteContent');
    const noteCategory = document.getElementById('noteCategory');
    const todoList = document.getElementById('todoList');
    const wordCount = document.getElementById('wordCount');
    const categoryTitle = document.getElementById('textareaCategoryTitle');
    
    if (editorDateTitle) editorDateTitle.textContent = formatDate(date);
    if (noteContent) noteContent.value = entry.content || '';
    if (noteCategory) noteCategory.value = entry.category || 'Daily Goals';
    if (todoList) todoList.innerHTML = renderTodoList(entry.completed || []);
    if (wordCount) wordCount.textContent = `Words: ${countWords(entry.content || '')}`;
    if (categoryTitle) categoryTitle.textContent = `${entry.category || 'Daily Goals'} - Notes`;
    
    // Update mood
    document.querySelectorAll('.mood-emoji').forEach(emoji => {
        emoji.classList.remove('selected');
        if (emoji.getAttribute('onclick')?.includes(entry.mood || 'neutral')) {
            emoji.classList.add('selected');
        }
    });
    
    // Highlight selected date in calendar
    document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('selected');
        if (day.dataset.date === date) {
            day.classList.add('selected');
        }
    });
}

// Calculate streak
function calculateStreak() {
    const dates = Object.keys(notesData.entries).sort().reverse();
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    // Calculate current streak (consecutive days from today)
    const today = new Date().toISOString().split('T')[0];
    let checkDate = new Date(today);
    
    while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (notesData.entries[dateStr]) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }
    
    // Calculate longest streak
    if (dates.length > 0) {
        let consecutive = 1;
        for (let i = 0; i < dates.length - 1; i++) {
            const current = new Date(dates[i]);
            const next = new Date(dates[i + 1]);
            const diffDays = Math.floor((current - next) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                consecutive++;
                longestStreak = Math.max(longestStreak, consecutive);
            } else {
                consecutive = 1;
            }
        }
        longestStreak = Math.max(longestStreak, consecutive, 1);
    }
    
    // Update streak display if it exists
    const streakDisplay = document.getElementById('streakDisplay');
    if (streakDisplay) {
        streakDisplay.innerHTML = renderStreakDisplay({
            current: currentStreak,
            longest: longestStreak,
            total: dates.length
        });
    }
    
    return {
        current: currentStreak,
        longest: longestStreak,
        total: dates.length
    };
}

// Update streak counter
function updateStreakCounter() {
    calculateStreak();
}

// Render calendar
function renderNotesCalendar() {
    const calendarElement = document.getElementById('notesCalendar');
    if (!calendarElement) return;
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startingDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    // Update month/year display
    const monthDisplay = document.getElementById('currentMonthYear');
    if (monthDisplay) {
        monthDisplay.textContent = firstDay.toLocaleString('default', { month: 'long', year: 'numeric' });
    }
    
    let calendarHTML = '<div class="calendar-weekdays">';
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    weekdays.forEach(day => {
        calendarHTML += `<div class="weekday">${day}</div>`;
    });
    calendarHTML += '</div><div class="calendar-days">';
    
    // Empty cells for days before month starts
    for (let i = 0; i < startingDay; i++) {
        calendarHTML += '<div class="calendar-day empty"></div>';
    }
    
    const today = new Date().toISOString().split('T')[0];
    const editorDateTitle = document.getElementById('editorDateTitle');
    const selectedDate = editorDateTitle?.textContent 
        ? new Date(editorDateTitle.textContent).toISOString().split('T')[0]
        : today;
    
    // Fill in the days
    for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasNote = notesData.entries[dateStr] !== undefined;
        const isToday = dateStr === today;
        const isSelected = dateStr === selectedDate;
        
        let dayClass = 'calendar-day';
        if (hasNote) dayClass += ' has-note';
        if (isToday) dayClass += ' today';
        if (isSelected) dayClass += ' selected';
        
        calendarHTML += `
            <div class="${dayClass}" 
                 data-date="${dateStr}"
                 onclick="loadNoteDate('${dateStr}')">
                ${day}
            </div>
        `;
    }
    
    calendarHTML += '</div>';
    calendarElement.innerHTML = calendarHTML;
}

// Change month
function changeMonth(delta) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
    renderNotesCalendar();
}

// Filter by category
function filterByCategory(category) {
    const categorySelect = document.getElementById('noteCategory');
    const categoryTitle = document.getElementById('textareaCategoryTitle');
    
    if (categorySelect) categorySelect.value = category;
    if (categoryTitle) categoryTitle.textContent = `${category} - Notes`;
    
    autoSaveNote();
    
    // Highlight matching recent notes
    document.querySelectorAll('.recent-note-item').forEach(item => {
        const itemCategory = item.querySelector('.recent-note-category')?.textContent;
        if (itemCategory === category) {
            item.style.backgroundColor = 'rgba(74, 111, 165, 0.1)';
            setTimeout(() => {
                item.style.backgroundColor = '';
            }, 1000);
        }
    });
    
    showNotification(`Filtered to ${category}`, 'info');
}

// Count words
function countWords(text) {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// Format date
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
    });
}

// Export notes
function exportNotes() {
    const dataStr = JSON.stringify(notesData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-notes-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showNotification('Notes exported successfully!', 'success');
}

// Import notes
function importNotes() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const imported = JSON.parse(e.target.result);
                if (imported.entries && imported.categories) {
                    notesData = imported;
                    saveNotesData();
                    showNotes();
                    showNotification('Notes imported successfully!', 'success');
                } else {
                    alert('Invalid notes file format');
                }
            } catch (err) {
                alert('Error importing notes: ' + err.message);
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// Close notes
function closeNotes() {
    const notesContainer = document.getElementById('notesContainer');
    if (notesContainer) {
        notesContainer.remove();
    }
    
    // Show main container and quiz selection
    const mainContainer = document.querySelector('.container');
    const quizSelection = document.getElementById('quizSelection');
    
    if (mainContainer) mainContainer.classList.remove('hidden');
    if (quizSelection) quizSelection.classList.add('active');
}

// Make functions globally available
window.showNotes = showNotes;
window.exportNotes = exportNotes;
window.importNotes = importNotes;
window.closeNotes = closeNotes;
window.addTodo = addTodo;
window.deleteTodo = deleteTodo;
window.setMood = setMood;
window.saveCurrentNote = saveCurrentNote;
window.clearTodayNote = clearTodayNote;
window.loadNoteDate = loadNoteDate;
window.changeMonth = changeMonth;
window.filterByCategory = filterByCategory;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing notes...");
    loadNotesData();
});