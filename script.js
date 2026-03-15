// =============================================
// QuizMaster Pro - Complete JavaScript
// =============================================

// Global Variables
let db; // IndexedDB database instance
let quizzes = {}; // Stores all quiz data
let currentQuiz = []; // Stores current quiz being taken
let currentFolder = ""; // Currently selected folder
let currentQuestionIndex = 0; // Current question index
let incorrectQuestions = []; // Stores incorrect answers
let score = 0; // User's score
let quizMode = ""; // Current quiz mode
let questionStartTime = 0; // For timing questions
let questionTimes = []; // Array to store time per question
let totalQuizTime = 0; // Total quiz time
let activityExpanded = false; // Track expand/collapse state for recent activity

// Timer Variables
let quizTimer = null;
let timeLeft = 0;
let timerEnabled = false;

// Flashcard Variables
let flashcardInterval = null;
let flashcardStartTime = 0;
let flashcardTimeStats = JSON.parse(localStorage.getItem('flashcardTimeStats')) || {};

// Medal Counts
let medalCounts = {
    bronze: parseInt(localStorage.getItem('medalBronze')) || 0,
    silver: parseInt(localStorage.getItem('medalSilver')) || 0,
    gold: parseInt(localStorage.getItem('medalGold')) || 0
};

// Streak Tracking
let dailyStreakCount = parseInt(localStorage.getItem('dailyStreakCount')) || 0;
let weeklyStreakCount = parseInt(localStorage.getItem('weeklyStreakCount')) || 0;
let monthlyStreakCount = parseInt(localStorage.getItem('monthlyStreakCount')) || 0;
let lastQuizDate = localStorage.getItem('lastQuizDate') || null;

// Folder Usage Stats
let folderUsageStats = JSON.parse(localStorage.getItem('folderUsageStats')) || {};

// =============================================
// IndexedDB Initialization
// =============================================

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("QuizMasterDB", 2);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains("quizzes")) {
                db.createObjectStore("quizzes", { keyPath: "folderName" });
            }

            if (!db.objectStoreNames.contains("analytics")) {
                const analyticsStore = db.createObjectStore("analytics", {
                    keyPath: "id",
                    autoIncrement: true,
                });
                analyticsStore.createIndex("folderName", "folderName", { unique: false });
                analyticsStore.createIndex("date", "date", { unique: false });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log("Database initialized successfully");
            resolve(db);
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
            reject(event.target.error);
        };
    });
}

// =============================================
// Data Management Functions
// =============================================

async function loadQuizzes() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["quizzes"], "readonly");
        const store = transaction.objectStore("quizzes");
        const request = store.getAll();

        request.onsuccess = (event) => {
            const data = event.target.result;
            quizzes = {};
            data.forEach((item) => {
                quizzes[item.folderName] = item.quizData;
            });
            resolve(quizzes);
        };

        request.onerror = (event) => {
            console.error("Error loading quizzes:", event.target.error);
            reject(event.target.error);
        };
    });
}

async function saveQuizzes() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["quizzes"], "readwrite");
        const store = transaction.objectStore("quizzes");

        const clearRequest = store.clear();

        clearRequest.onsuccess = () => {
            const savePromises = Object.keys(quizzes).map((folderName) => {
                return new Promise((innerResolve, innerReject) => {
                    const putRequest = store.put({
                        folderName: folderName,
                        quizData: quizzes[folderName],
                    });

                    putRequest.onsuccess = () => innerResolve();
                    putRequest.onerror = (e) => innerReject(e.target.error);
                });
            });

            Promise.all(savePromises)
                .then(() => resolve())
                .catch((error) => reject(error));
        };

        clearRequest.onerror = (event) => {
            console.error("Error clearing quizzes:", event.target.error);
            reject(event.target.error);
        };
    });
}

async function saveQuizResult(resultData) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["analytics"], "readwrite");
        const store = transaction.objectStore("analytics");

        const record = {
            folderName: currentFolder,
            date: new Date().toISOString().split("T")[0],
            startIndex: parseInt(document.getElementById("startIndex")?.value || 1),
            endIndex: parseInt(document.getElementById("endIndex")?.value || quizzes[currentFolder]?.length || 0),
            totalQuestions: resultData.totalQuestions,
            correctAnswers: resultData.correctAnswers,
            timeTaken: resultData.timeTaken,
            questionTimes: resultData.questionTimes,
            mode: quizMode,
            correctQuestionIds: resultData.correctQuestionIds || []
        };

        const request = store.add(record);
        request.onsuccess = () => {
            updateStreakCounts();
            updateRecentActivity(record);
            resolve();
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

async function getQuizResults(folderName = null) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["analytics"], "readonly");
        const store = transaction.objectStore("analytics");
        
        if (folderName) {
            const index = store.index("folderName");
            const request = index.getAll(folderName);
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        } else {
            const request = store.getAll();
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        }
    });
}

// =============================================
// UI Functions
// =============================================

function toggleMenu() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("show");
}

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    localStorage.setItem('quizTheme', currentTheme);
    showToast(`Switched to ${currentTheme} theme`, 'info');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                         type === 'error' ? 'fa-exclamation-circle' : 
                         type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showQuickActions() {
    const menu = document.getElementById('quickActions');
    const fab = document.querySelector('.fab i');
    
    menu.classList.toggle('hidden');
    fab.classList.toggle('fa-plus');
    fab.classList.toggle('fa-times');
}

// =============================================
// Folder Management
// =============================================

async function createFolder() {
    const folderName = prompt("Enter folder name:");
    if (folderName && !quizzes[folderName]) {
        quizzes[folderName] = [];
        quizzes[`${folderName}_Incorrect`] = [];
        await saveQuizzes();
        updateFolderList();
        showToast(`Folder "${folderName}" created successfully!`, 'success');
    } else if (folderName) {
        showToast("Folder already exists!", 'warning');
    }
}

async function confirmDeleteFolder() {
    if (!currentFolder) {
        showToast("Please select a folder first!", 'warning');
        return;
    }

    if (confirm(`Are you sure you want to permanently delete "${currentFolder}"?`)) {
        await deleteFolder(currentFolder);
    }
}

async function deleteFolder(folderName) {
    try {
        delete quizzes[folderName];
        delete quizzes[`${folderName}_Incorrect`];
        
        await saveQuizzes();
        
        const transaction = db.transaction(["analytics"], "readwrite");
        const store = transaction.objectStore("analytics");
        const index = store.index("folderName");
        const request = index.openCursor(folderName);
        
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                store.delete(cursor.primaryKey);
                cursor.continue();
            }
        };
        
        if (currentFolder === folderName) {
            currentFolder = "";
        }
        
        updateFolderList();
        document.getElementById("quizOptions")?.classList.add("hidden");
        document.getElementById("quizRangeContainer")?.classList.add("hidden");
        
        showToast(`Folder "${folderName}" deleted successfully`, 'success');
        
    } catch (error) {
        console.error("Error deleting folder:", error);
        showToast("Failed to delete folder", 'error');
    }
}

function updateFolderList() {
    const folderSelect = document.getElementById("folderSelect");
    if (!folderSelect) return;
    
    folderSelect.innerHTML = '<option value="" disabled selected>📁 Select folder</option>';
    
    Object.keys(quizzes).forEach((folder) => {
        if (!folder.includes("_Incorrect")) {
            const option = document.createElement("option");
            option.value = folder;
            option.textContent = folder;
            folderSelect.appendChild(option);
        }
    });
    
    if (currentFolder) {
        folderSelect.value = currentFolder;
    }
}

function selectFolder() {
    currentFolder = document.getElementById("folderSelect").value;
    
    if (!currentFolder) return;
    
    trackFolderUsage(currentFolder);
    
    const quizOptions = document.getElementById("quizOptions");
    const quizRangeContainer = document.getElementById("quizRangeContainer");
    
    if (currentFolder && quizzes[currentFolder]) {
        quizOptions?.classList.remove("hidden");
        quizRangeContainer?.classList.remove("hidden");
        
        let totalQuestions = quizzes[currentFolder]?.length || 0;
        
        const totalQuestionsSpan = document.getElementById("totalQuestions");
        if (totalQuestionsSpan) totalQuestionsSpan.textContent = totalQuestions;
        
        const totalQuestionsStat = document.getElementById("totalQuestionsStat");
        if (totalQuestionsStat) totalQuestionsStat.textContent = totalQuestions;
        
        const startIndex = document.getElementById("startIndex");
        const endIndex = document.getElementById("endIndex");
        
        if (startIndex) {
            startIndex.max = totalQuestions;
            startIndex.value = 1;
        }
        
        if (endIndex) {
            endIndex.max = totalQuestions;
            endIndex.value = totalQuestions;
        }
        
        updateStats();
        showToast(`Selected folder: ${currentFolder}`, 'info');
    }
}

function trackFolderUsage(folderName) {
    if (!folderName) return;
    
    folderUsageStats[folderName] = (folderUsageStats[folderName] || 0) + 1;
    localStorage.setItem('folderUsageStats', JSON.stringify(folderUsageStats));
    updateFrequentFoldersList();
}

// =============================================
// Quiz Functions
// =============================================

function shuffleArray(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function prepareShuffledQuestions(questions) {
    return questions.map(q => {
        const prepared = { ...q };
        
        if (!Array.isArray(prepared.options) || prepared.options.length < 2) {
            return prepared;
        }

        const originalCorrectText = q.options[q.correctIndex];
        prepared.options = shuffleArray(prepared.options);
        prepared.correctIndex = prepared.options.indexOf(originalCorrectText);

        if (prepared.correctIndex === -1) {
            console.warn("Correct answer lost during shuffle!", q);
            prepared.correctIndex = 0;
        }

        return prepared;
    });
}



function updateQuizProgress() {
    const progress = ((currentQuestionIndex) / currentQuiz.length) * 100;
    const progressBar = document.getElementById("quizProgressBar");
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
    }
}
// =============================================
// Quiz Functions - FIXED VERSION
// =============================================

async function startQuiz(mode) {
    if (!currentFolder || !quizzes[currentFolder] || quizzes[currentFolder].length === 0) {
        showToast("Please select a valid folder with questions!", 'warning');
        return;
    }

    // CRITICAL FIX: Completely reset the quiz container HTML to fresh state
    const quizContainer = document.getElementById("quizContainer");
    quizContainer.innerHTML = `
        <div class="quiz-header">
            <div class="quiz-progress">
                <div class="progress-circle">
                    <span id="current-question">1</span>/<span id="total-questions">0</span>
                </div>
                <div class="progress-bar-container">
                    <div id="quizProgressBar" class="progress-bar" style="width: 0%"></div>
                </div>
            </div>
            <div id="quiz-timer" class="quiz-timer">
                <i class="fas fa-hourglass-half"></i>
                <span id="time-display">00:00</span>
            </div>
        </div>
        <div class="quiz-body">
            <h2 id="question-text" class="question-text">Question will appear here</h2>
            <div id="options" class="options-grid"></div>
        </div>
        <div class="quiz-footer">
            <button class="mark-difficult-btn" onclick="markCurrentAsDifficult()">
                <i class="fas fa-flag"></i> Mark as Difficult
            </button>
        </div>
    `;

    // Reset all quiz state variables
    currentQuestionIndex = 0;
    score = 0;
    incorrectQuestions = [];
    questionTimes = [];
    totalQuizTime = 0;
    quizMode = mode;

    // Clear any existing timer
    if (quizTimer) {
        clearInterval(quizTimer);
        quizTimer = null;
    }

    // Ask for timer
    const useTimer = confirm("Would you like to enable a timer for this quiz?");
    if (useTimer) {
        const minutes = parseInt(prompt("Enter time limit in minutes:", "5"));
        if (!isNaN(minutes) && minutes > 0) {
            timerEnabled = true;
            startTimer(minutes);
        } else {
            timerEnabled = false;
        }
    } else {
        timerEnabled = false;
    }

    let totalQuestions = quizzes[currentFolder].length;
    let startIndex = parseInt(document.getElementById("startIndex").value) - 1;
    let endIndex = parseInt(document.getElementById("endIndex").value);

    // Validate range
    if (isNaN(startIndex)) startIndex = 0;
    if (isNaN(endIndex)) endIndex = totalQuestions;
    if (startIndex < 0) startIndex = 0;
    if (endIndex > totalQuestions) endIndex = totalQuestions;
    if (startIndex >= endIndex) {
        startIndex = 0;
        endIndex = totalQuestions;
    }

    let selectedQuestions;

    if (mode === "difficult") {
        selectedQuestions = quizzes[`${currentFolder}_Incorrect`] || [];
        if (selectedQuestions.length === 0) {
            showToast("No difficult questions found. Try the complete quiz first.", 'info');
            return;
        }
    } else {
        selectedQuestions = quizzes[currentFolder].slice(startIndex, endIndex);
    }

    // Shuffle options
    currentQuiz = selectedQuestions.map(question => {
        const q = { ...question };
        if (!Array.isArray(q.options) || q.options.length < 2) return q;

        const correctAnswerText = q.options[q.correctIndex];
        q.options = shuffleArray(q.options);
        q.correctIndex = q.options.indexOf(correctAnswerText);

        if (q.correctIndex === -1) {
            q.correctIndex = 0;
        }
        return q;
    });

    // Update UI
    document.getElementById("quizSelection")?.classList.remove("active");
    quizContainer.classList.remove("hidden");
    document.getElementById("total-questions").textContent = currentQuiz.length;
    document.getElementById("current-question").textContent = "1";
    
    // Reset timer display
    const timeDisplay = document.getElementById("time-display");
    if (timeDisplay) {
        timeDisplay.textContent = "00:00";
    }
    
    // Reset progress bar
    updateQuizProgress();

    // Set question start time
    questionStartTime = Date.now();

    // Load first question
    loadQuestion();
}

function loadQuestion() {
    // CRITICAL FIX: Check if we've reached the end
    if (currentQuestionIndex >= currentQuiz.length) {
        if (quizTimer) clearInterval(quizTimer);
        showResults();
        return;
    }

    const questionData = currentQuiz[currentQuestionIndex];

    // Update progress
    document.getElementById("current-question").textContent = currentQuestionIndex + 1;
    document.getElementById("total-questions").textContent = currentQuiz.length;
    
    // Update progress bar
    updateQuizProgress();

    // Show question
    document.getElementById("question-text").textContent = questionData.question;

    // Clear and create options
    const optionsContainer = document.getElementById("options");
    optionsContainer.innerHTML = "";

    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    
    questionData.options.forEach((optionText, index) => {
        const button = document.createElement("button");
        button.classList.add("option-btn");
        button.innerHTML = `
            <span class="option-prefix">${letters[index]}</span>
            <span class="option-text">${optionText}</span>
        `;
        
        button.addEventListener("click", () => {
            if (button.disabled) return;
            
            // Disable all options immediately to prevent double-clicking
            optionsContainer.querySelectorAll(".option-btn").forEach(btn => {
                btn.disabled = true;
            });

            // Show correct/incorrect feedback
            if (index === questionData.correctIndex) {
                button.classList.add("correct");
            } else {
                button.classList.add("incorrect");
                // Also highlight correct answer
                const correctBtn = optionsContainer.querySelectorAll(".option-btn")[questionData.correctIndex];
                if (correctBtn) {
                    correctBtn.classList.add("correct");
                }
            }

            // CRITICAL FIX: Use setTimeout but ensure we don't lose context
            setTimeout(() => {
                selectAnswer(index);
            }, 800);
        });

        optionsContainer.appendChild(button);
    });

    questionStartTime = Date.now();
}

async function selectAnswer(selectedIndex) {
    const endTime = Date.now();
    const timeTaken = (endTime - questionStartTime) / 1000;
    questionTimes.push(timeTaken);
    totalQuizTime += timeTaken;
    
    const question = currentQuiz[currentQuestionIndex];
    const isCorrect = selectedIndex === question.correctIndex;
    
    if (isCorrect) {
        score++;
        question.correctlyAnswered = true;
    } else {
        question.timesIncorrect = (question.timesIncorrect || 0) + 1;
        question.selectedAnswer = question.options[selectedIndex];
        incorrectQuestions.push(question);
    }
    
    currentQuestionIndex++;
    
    if (currentQuestionIndex < currentQuiz.length) {
        loadQuestion();
    } else {
        if (quizTimer) {
            clearInterval(quizTimer);
            quizTimer = null;
        }
        await showResults();
    }
}

async function showResults() {
    // Calculate average time
    const avgTimeThreshold = totalQuizTime / currentQuiz.length;

    // Create results HTML
    const accuracy = Math.round((score / currentQuiz.length) * 100);
    
    const resultsHTML = `
        <div class="results-container">
            <div class="results-header">
                <h2>Quiz Completed! 🎉</h2>
                <div class="score-circle">
                    <span class="score-number">${score}</span>
                    <span class="score-total">/${currentQuiz.length}</span>
                </div>
                <p class="accuracy-text">Accuracy: ${accuracy}%</p>
            </div>
            
            <div class="results-stats">
                <div class="stat-card">
                    <i class="fas fa-clock"></i>
                    <div>
                        <span class="stat-label">Total Time</span>
                        <span class="stat-value">${totalQuizTime.toFixed(1)}s</span>
                    </div>
                </div>
                <div class="stat-card">
                    <i class="fas fa-gauge-high"></i>
                    <div>
                        <span class="stat-label">Avg Time</span>
                        <span class="stat-value">${avgTimeThreshold.toFixed(1)}s</span>
                    </div>
                </div>
                <div class="stat-card">
                    <i class="fas fa-bolt"></i>
                    <div>
                        <span class="stat-label">Fastest</span>
                        <span class="stat-value">${questionTimes.length > 0 ? Math.min(...questionTimes).toFixed(1) : 0}s</span>
                    </div>
                </div>
            </div>
            
            <div class="timing-stats">
                <h3>Question Timing</h3>
                <div class="timing-grid">
                    ${currentQuiz.map((question, index) => {
                        const time = questionTimes[index] || 0;
                        const isSlow = time > avgTimeThreshold * 1.5;
                        return `
                            <div class="timing-item ${isSlow ? 'slow' : 'fast'}">
                                <span>Q${index + 1}</span>
                                <span>${time.toFixed(1)}s</span>
                                <i class="fas ${isSlow ? 'fa-clock' : 'fa-bolt'}"></i>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <div class="incorrect-answers">
                <h3>${incorrectQuestions.length > 0 ? '📝 Review Incorrect Answers' : '✨ Perfect Score! Great Job!'}</h3>
                <div id="incorrectAnswersList">
                    ${incorrectQuestions.map(item => `
                        <div class="incorrect-item">
                            <p class="question"><strong>Q:</strong> ${item.question}</p>
                            <p class="wrong-answer"><i class="fas fa-times"></i> ${item.selectedAnswer || 'Not answered'}</p>
                            <p class="correct-answer"><i class="fas fa-check"></i> ${item.options[item.correctIndex]}</p>
                            ${item.explanation ? `<p class="explanation"><i class="fas fa-info-circle"></i> ${item.explanation}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="results-actions">
                <button class="primary-btn" onclick="restartQuiz()">
                    <i class="fas fa-redo-alt"></i> Restart Quiz
                </button>
                <button class="secondary-btn" onclick="goHome()">
                    <i class="fas fa-home"></i> Home
                </button>
            </div>
        </div>
    `;

    document.getElementById("quizContainer").innerHTML = resultsHTML;

    // Save results
    if (incorrectQuestions.length > 0 && quizMode === "complete") {
        await storeIncorrectQuestions();
    }
    
    await saveQuizResult({
        totalQuestions: currentQuiz.length,
        correctAnswers: score,
        timeTaken: totalQuizTime,
        questionTimes: questionTimes,
    });

    // Celebration for high scores
    if (accuracy >= 90) {
        triggerHighAccuracyCelebration();
    }
}

function restartQuiz() {
    // Clear timer if active
    if (quizTimer) {
        clearInterval(quizTimer);
        quizTimer = null;
    }

    // Reset all quiz state variables
    currentQuestionIndex = 0;
    score = 0;
    incorrectQuestions = [];
    questionTimes = [];
    totalQuizTime = 0;
    
    // CRITICAL FIX: Reset the quiz container to its original state
    const quizContainer = document.getElementById("quizContainer");
    quizContainer.innerHTML = `
        <div class="quiz-header">
            <div class="quiz-progress">
                <div class="progress-circle">
                    <span id="current-question">1</span>/<span id="total-questions">${currentQuiz.length}</span>
                </div>
                <div class="progress-bar-container">
                    <div id="quizProgressBar" class="progress-bar" style="width: 0%"></div>
                </div>
            </div>
            <div id="quiz-timer" class="quiz-timer">
                <i class="fas fa-hourglass-half"></i>
                <span id="time-display">00:00</span>
            </div>
        </div>
        <div class="quiz-body">
            <h2 id="question-text" class="question-text">Question will appear here</h2>
            <div id="options" class="options-grid"></div>
        </div>
        <div class="quiz-footer">
            <button class="mark-difficult-btn" onclick="markCurrentAsDifficult()">
                <i class="fas fa-flag"></i> Mark as Difficult
            </button>
        </div>
    `;

    // Reset question start time
    questionStartTime = Date.now();

    // Load first question
    loadQuestion();

    // Restart timer if it was enabled
    if (timerEnabled) {
        const minutes = parseInt(prompt("Enter time limit in minutes:", "5"));
        if (!isNaN(minutes) && minutes > 0) {
            startTimer(minutes);
        }
    }
}

// function goHome() {
//     // Clear any active timers
//     if (quizTimer) {
//         clearInterval(quizTimer);
//         quizTimer = null;
//     }
//     if (flashcardInterval) {
//         clearInterval(flashcardInterval);
//         flashcardInterval = null;
//     }
    
//     // Hide all containers
//     const quizContainer = document.getElementById("quizContainer");
//     const flashcardContainer = document.getElementById("flashcardContainer");
//     const analysisContainer = document.getElementById("analysisContainer");
//     const notesContainer = document.getElementById("notesContainer");
//     const difficultView = document.getElementById("difficultView");
    
//     if (quizContainer) quizContainer.classList.add("hidden");
//     if (flashcardContainer) flashcardContainer.classList.add("hidden");
//     if (analysisContainer) analysisContainer.classList.add("hidden");
//     if (notesContainer) notesContainer.classList.add("hidden");
//     if (difficultView) difficultView.remove();
    
//     // Show quiz selection
//     document.getElementById("quizSelection")?.classList.add("active");
    
//     // Reset quiz state completely
//     currentQuiz = [];
//     currentQuestionIndex = 0;
//     score = 0;
//     incorrectQuestions = [];
//     quizMode = "";
//     questionTimes = [];
//     totalQuizTime = 0;
    
//     // Update folder selection UI
//     if (currentFolder && quizzes[currentFolder]) {
//         const totalQuestions = quizzes[currentFolder].length;
//         document.getElementById("totalQuestions").textContent = totalQuestions;
//         document.getElementById("totalQuestionsStat").textContent = totalQuestions;
        
//         const startIndex = document.getElementById("startIndex");
//         const endIndex = document.getElementById("endIndex");
        
//         if (startIndex) {
//             startIndex.max = totalQuestions;
//             startIndex.value = 1;
//         }
        
//         if (endIndex) {
//             endIndex.max = totalQuestions;
//             endIndex.value = totalQuestions;
//         }
//     }
    
//     // Update stats
//     updateStats();
//     updateRecentActivity();
    
//     showToast("Welcome back!", 'info');
// }

function goHome() {
    // Remove notes container if it exists
    const notesContainer = document.getElementById('notesContainer');
    if (notesContainer) {
        notesContainer.remove();
    }
    
    // Clear any active timers
    if (quizTimer) {
        clearInterval(quizTimer);
        quizTimer = null;
    }
    if (flashcardInterval) {
        clearInterval(flashcardInterval);
        flashcardInterval = null;
    }
    
    // Hide all containers
    const quizContainer = document.getElementById("quizContainer");
    const flashcardContainer = document.getElementById("flashcardContainer");
    const analysisContainer = document.getElementById("analysisContainer");
    const difficultView = document.getElementById("difficultView");
    
    if (quizContainer) quizContainer.classList.add("hidden");
    if (flashcardContainer) flashcardContainer.classList.add("hidden");
    if (analysisContainer) analysisContainer.classList.add("hidden");
    if (difficultView) difficultView.remove();
    
    // Show quiz selection
    document.getElementById("quizSelection")?.classList.add("active");
    
    // Reset quiz state completely
    currentQuiz = [];
    currentQuestionIndex = 0;
    score = 0;
    incorrectQuestions = [];
    quizMode = "";
    questionTimes = [];
    totalQuizTime = 0;
    
    // Update folder selection UI
    if (currentFolder && quizzes[currentFolder]) {
        const totalQuestions = quizzes[currentFolder].length;
        document.getElementById("totalQuestions").textContent = totalQuestions;
        document.getElementById("totalQuestionsStat").textContent = totalQuestions;
        
        const startIndex = document.getElementById("startIndex");
        const endIndex = document.getElementById("endIndex");
        
        if (startIndex) {
            startIndex.max = totalQuestions;
            startIndex.value = 1;
        }
        
        if (endIndex) {
            endIndex.max = totalQuestions;
            endIndex.value = totalQuestions;
        }
    }
    
    // ✅ YEH LINE ADD KARO
    resetActivityExpand();
    
    // Update stats
    updateStats();
    updateRecentActivity();  // ✅ YEH LINE BHI HONI CHAHIYE
    
    showToast("Welcome back!", 'info');
}




function clearKnownTimers() {
    if (quizTimer) {
        clearInterval(quizTimer);
        quizTimer = null;
    }
    if (flashcardInterval) {
        clearInterval(flashcardInterval);
        flashcardInterval = null;
    }
}

// =============================================
// Timer Functions
// =============================================

function startTimer(minutes) {
    if (quizTimer) {
        clearInterval(quizTimer);
    }

    timeLeft = minutes * 60;
    updateTimerDisplay();

    quizTimer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
            clearInterval(quizTimer);
            quizTimer = null;
            timeUp();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const timeDisplay = document.getElementById("time-display");
    const timerContainer = document.getElementById("quiz-timer");

    if (timeDisplay) {
        timeDisplay.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }

    if (timerContainer) {
        if (timeLeft <= 30) {
            timerContainer.classList.add("warning");
        } else {
            timerContainer.classList.remove("warning");
        }
    }
}

function timeUp() {
    while (currentQuestionIndex < currentQuiz.length) {
        const question = currentQuiz[currentQuestionIndex];
        question.timesIncorrect = (question.timesIncorrect || 0) + 1;
        question.selectedAnswer = "⏰ Time expired";
        incorrectQuestions.push(question);
        currentQuestionIndex++;
    }

    showResults();
}

// =============================================
// Flashcard Functions
// =============================================

function showFlashcards() {
    if (!currentFolder || !quizzes[currentFolder] || quizzes[currentFolder].length === 0) {
        showToast("Please select a folder with questions first!", 'warning');
        return;
    }

    // Clear any active quiz
    if (quizTimer) {
        clearInterval(quizTimer);
        quizTimer = null;
    }

    // Hide other views
    document.getElementById("quizSelection")?.classList.remove("active");
    document.getElementById("quizContainer")?.classList.add("hidden");
    document.getElementById("analysisContainer")?.classList.add("hidden");
    document.getElementById("notesContainer")?.classList.add("hidden");

    // Show flashcard container
    const flashcardContainer = document.getElementById("flashcardContainer");
    flashcardContainer.innerHTML = "";
    flashcardContainer.classList.remove("hidden");

    // Initialize timer for tracking study time
    startFlashcardTimer();

    // Create flashcards
    const questions = quizzes[currentFolder];
    
    questions.forEach((question, index) => {
        const flashcard = document.createElement("div");
        flashcard.className = "flashcard";
        flashcard.innerHTML = `
            <div class="flashcard-inner">
                <div class="flashcard-front">
                    <div class="flashcard-content">
                        <div class="flashcard-header">
                            <span class="flashcard-number">${index + 1}</span>
                            <button class="edit-question-btn" onclick="event.stopPropagation(); showEditQuestionForm(${index}, ${JSON.stringify(question).replace(/"/g, '&quot;')})">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                        <p class="flashcard-question">${question.question}</p>
                        <div class="flashcard-options-preview">
                            ${question.options.map(opt => `<span class="option-pill">${opt}</span>`).join('')}
                        </div>
                        ${question.timesIncorrect ? `<span class="difficult-badge"><i class="fas fa-exclamation-triangle"></i> ${question.timesIncorrect}x</span>` : ''}
                    </div>
                </div>
                <div class="flashcard-back">
                    <div class="flashcard-content">
                        <h4>Correct Answer:</h4>
                        <p class="correct-answer-text">${question.options[question.correctIndex]}</p>
                        ${question.explanation ? `
                            <h4>Explanation:</h4>
                            <p class="explanation-text">${question.explanation}</p>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        flashcard.addEventListener("click", () => {
            flashcard.classList.toggle("flipped");
        });

        flashcardContainer.appendChild(flashcard);
    });

    showToast(`Showing ${questions.length} flashcards`, 'success');
}

function startFlashcardTimer() {
    flashcardStartTime = Date.now();
    flashcardInterval = setInterval(updateFlashcardTime, 1000);
}

function updateFlashcardTime() {
    if (!currentFolder || !flashcardStartTime) return;
    
    const elapsedSeconds = Math.floor((Date.now() - flashcardStartTime) / 1000);
    
    if (!flashcardTimeStats[currentFolder]) {
        flashcardTimeStats[currentFolder] = { totalTime: 0, achievements: [] };
    }
    
    flashcardTimeStats[currentFolder].totalTime += elapsedSeconds;
    flashcardStartTime = Date.now();
    
    localStorage.setItem('flashcardTimeStats', JSON.stringify(flashcardTimeStats));
    
    checkFlashcardAchievements();
}

function checkFlashcardAchievements() {
    if (!currentFolder || !flashcardTimeStats[currentFolder]) return;
    
    const timeBasedAchievements = [
        { id: "flashcard_30m", title: "Flashcard Novice", threshold: 1800, icon: "⏳" },
        { id: "flashcard_1h", title: "Flashcard Learner", threshold: 3600, icon: "📖" },
        { id: "flashcard_2h", title: "Flashcard Scholar", threshold: 7200, icon: "🎓" }
    ];
    
    const folderStats = flashcardTimeStats[currentFolder];
    
    timeBasedAchievements.forEach(achievement => {
        if (folderStats.totalTime >= achievement.threshold && 
            !folderStats.achievements.includes(achievement.id)) {
            
            folderStats.achievements.push(achievement.id);
            localStorage.setItem('flashcardTimeStats', JSON.stringify(flashcardTimeStats));
            
            showAchievementNotification(
                achievement.title,
                `You've studied for ${formatTime(achievement.threshold)}!`,
                achievement.icon
            );
        }
    });
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}

// =============================================
// Difficult Questions Management
// =============================================

async function storeIncorrectQuestions() {
    if (incorrectQuestions.length === 0) return;
    
    const incorrectFolder = `${currentFolder}_Incorrect`;

    if (!quizzes[incorrectFolder]) {
        quizzes[incorrectFolder] = [];
    }

    incorrectQuestions.forEach((question) => {
        const existingQuestion = quizzes[incorrectFolder].find(
            (q) => q.question === question.question
        );
        
        if (existingQuestion) {
            existingQuestion.timesIncorrect = (existingQuestion.timesIncorrect || 0) + (question.timesIncorrect || 1);
        } else {
            quizzes[incorrectFolder].push({
                ...question,
                timesIncorrect: question.timesIncorrect || 1
            });
        }
    });

    await saveQuizzes();
}

function showDifficultQuestions() {
    if (!currentFolder) {
        showToast("Please select a folder first!", 'warning');
        return;
    }

    const incorrectFolder = `${currentFolder}_Incorrect`;
    
    if (!quizzes[incorrectFolder] || quizzes[incorrectFolder].length === 0) {
        showToast("No difficult questions found!", 'info');
        return;
    }

    // Sort by times incorrect
    const difficultQuestions = [...quizzes[incorrectFolder]].sort((a, b) => 
        (b.timesIncorrect || 0) - (a.timesIncorrect || 0)
    );

    // Hide other views
    document.getElementById("quizSelection")?.classList.remove("active");
    document.getElementById("quizContainer")?.classList.add("hidden");
    document.getElementById("flashcardContainer")?.classList.add("hidden");
    document.getElementById("analysisContainer")?.classList.add("hidden");
    document.getElementById("notesContainer")?.classList.add("hidden");

    // Create difficult questions view
    const container = document.querySelector(".main-content");
    const difficultView = document.createElement("div");
    difficultView.className = "difficult-view active";
    difficultView.id = "difficultView";
    
    difficultView.innerHTML = `
        <div class="glass-card" style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2><i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i> Difficult Questions (${difficultQuestions.length})</h2>
                <button class="icon-btn" onclick="document.getElementById('difficultView').remove(); goHome();">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="difficult-questions-list">
                ${difficultQuestions.map((question, index) => `
                    <div class="difficult-question-card">
                        <div class="question-header">
                            <span class="question-number">${index + 1}</span>
                            <span class="difficulty-badge">
                                <i class="fas fa-exclamation-circle"></i> ${question.timesIncorrect || 0} times
                            </span>
                        </div>
                        <p class="question-text">${question.question}</p>
                        <div class="options-list">
                            ${question.options.map((opt, i) => `
                                <div class="option-display ${i === question.correctIndex ? 'correct-option' : ''}">
                                    <span class="option-letter">${String.fromCharCode(65 + i)}</span>
                                    <span>${opt}</span>
                                    ${i === question.correctIndex ? '<i class="fas fa-check correct-mark"></i>' : ''}
                                </div>
                            `).join('')}
                        </div>
                        ${question.selectedAnswer ? `
                            <div class="last-attempt">
                                <i class="fas fa-history"></i> Last selected: ${question.selectedAnswer}
                            </div>
                        ` : ''}
                        ${question.explanation ? `
                            <div class="explanation-box">
                                <i class="fas fa-info-circle"></i> ${question.explanation}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
            
            <div style="display: flex; gap: 16px; justify-content: center; margin-top: 24px;">
                <button class="primary-btn" onclick="startQuiz('difficult')">
                    <i class="fas fa-play"></i> Practice These
                </button>
                <button class="secondary-btn" onclick="document.getElementById('difficultView').remove(); goHome();">
                    <i class="fas fa-arrow-left"></i> Back
                </button>
            </div>
        </div>
    `;
    
    container.appendChild(difficultView);
}

function markCurrentAsDifficult() {
    if (!currentQuiz || currentQuestionIndex >= currentQuiz.length) return;
    
    const question = currentQuiz[currentQuestionIndex];
    const btn = document.querySelector('.mark-difficult-btn');
    
    question.isMarkedDifficult = !question.isMarkedDifficult;
    
    if (question.isMarkedDifficult) {
        btn.classList.add('marked');
        btn.innerHTML = '<i class="fas fa-check"></i> Marked as Difficult';
        showToast('Question marked for review', 'success');
    } else {
        btn.classList.remove('marked');
        btn.innerHTML = '<i class="fas fa-flag"></i> Mark as Difficult';
    }
}

// =============================================
// Analysis Functions
// =============================================

async function showAnalysis() {
    if (!currentFolder) {
        showToast("Please select a folder first!", 'warning');
        return;
    }

    // Hide other views
    document.getElementById("quizSelection")?.classList.remove("active");
    document.getElementById("quizContainer")?.classList.add("hidden");
    document.getElementById("flashcardContainer")?.classList.add("hidden");
    document.getElementById("notesContainer")?.classList.add("hidden");

    // Show analysis container
    const analysisContainer = document.getElementById("analysisContainer");
    analysisContainer.classList.remove("hidden");
    
    // Load analysis data
    await updateAnalysis();
}

async function updateAnalysis() {
    const results = await getQuizResults(currentFolder);
    
    if (!results || results.length === 0) {
        analysisContainer.innerHTML = `
            <div class="glass-card" style="padding: 40px; text-align: center;">
                <i class="fas fa-chart-line" style="font-size: 48px; color: #64748b; margin-bottom: 16px;"></i>
                <h3>No Data Yet</h3>
                <p>Complete some quizzes to see your analytics!</p>
                <button class="primary-btn" onclick="goHome()" style="margin-top: 20px;">
                    <i class="fas fa-home"></i> Back to Home
                </button>
            </div>
        `;
        return;
    }

    // Calculate statistics
    const totalQuizzes = results.length;
    const totalQuestions = results.reduce((sum, r) => sum + r.totalQuestions, 0);
    const totalCorrect = results.reduce((sum, r) => sum + r.correctAnswers, 0);
    const accuracy = totalQuestions > 0 ? ((totalCorrect / totalQuestions) * 100).toFixed(1) : 0;
    
    // Calculate streak
    const streaks = calculateStreaks(results);
    
    // Prepare chart data
    const dates = results.map(r => r.date).filter((v, i, a) => a.indexOf(v) === i).sort();
    const accuracyByDate = dates.map(date => {
        const dayResults = results.filter(r => r.date === date);
        const dayCorrect = dayResults.reduce((sum, r) => sum + r.correctAnswers, 0);
        const dayTotal = dayResults.reduce((sum, r) => sum + r.totalQuestions, 0);
        return ((dayCorrect / dayTotal) * 100).toFixed(1);
    });

    analysisContainer.innerHTML = `
        <div class="glass-card" style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2><i class="fas fa-chart-line"></i> Analytics: ${currentFolder}</h2>
                <button class="icon-btn" onclick="goHome()">
                    <i class="fas fa-home"></i>
                </button>
            </div>
            
            <div class="stats-grid" style="margin-bottom: 32px;">
                <div class="stat-card">
                    <i class="fas fa-clock"></i>
                    <div>
                        <span class="stat-label">Total Quizzes</span>
                        <span class="stat-value">${totalQuizzes}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <i class="fas fa-question-circle"></i>
                    <div>
                        <span class="stat-label">Questions</span>
                        <span class="stat-value">${totalQuestions}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <i class="fas fa-bullseye"></i>
                    <div>
                        <span class="stat-label">Accuracy</span>
                        <span class="stat-value">${accuracy}%</span>
                    </div>
                </div>
                <div class="stat-card">
                    <i class="fas fa-fire"></i>
                    <div>
                        <span class="stat-label">Streak</span>
                        <span class="stat-value">${streaks.current}</span>
                    </div>
                </div>
            </div>
            
            <div class="progress-container" style="margin-bottom: 32px;">
                <h3>Overall Progress</h3>
                <div class="progress-bar-container" style="height: 20px;">
                    <div class="progress-bar" style="width: ${accuracy}%">${accuracy}%</div>
                </div>
            </div>
            
            <div style="margin-bottom: 32px;">
                <h3>Performance Trend</h3>
                <canvas id="performanceChart"></canvas>
            </div>
            
            <div style="margin-bottom: 32px;">
                <h3>Question Timing Distribution</h3>
                <canvas id="timingChart"></canvas>
            </div>
            
            <div>
                <h3>Recent Quizzes</h3>
                <div class="recent-quizzes-list">
                    ${results.slice(-5).reverse().map(r => `
                        <div class="quiz-history-item">
                            <span class="quiz-date">${new Date(r.date).toLocaleDateString()}</span>
                            <span class="quiz-score">${r.correctAnswers}/${r.totalQuestions}</span>
                            <span class="quiz-percent">${Math.round((r.correctAnswers/r.totalQuestions)*100)}%</span>
                            <span class="quiz-time">${Math.round(r.timeTaken)}s</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // Render charts
    setTimeout(() => {
        renderPerformanceChart(dates, accuracyByDate);
        renderTimingChart(results);
    }, 100);
}

function renderPerformanceChart(labels, data) {
    const ctx = document.getElementById('performanceChart')?.getContext('2d');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Accuracy %',
                data: data,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(0,0,0,0.05)' }
                }
            }
        }
    });
}

function renderTimingChart(results) {
    const ctx = document.getElementById('timingChart')?.getContext('2d');
    if (!ctx) return;
    
    const timings = {
        fast: 0,   // < 15s
        medium: 0, // 15-30s
        slow: 0    // > 30s
    };
    
    results.forEach(r => {
        r.questionTimes?.forEach(t => {
            if (t < 15) timings.fast++;
            else if (t <= 30) timings.medium++;
            else timings.slow++;
        });
    });
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Fast (<15s)', 'Medium (15-30s)', 'Slow (>30s)'],
            datasets: [{
                data: [timings.fast, timings.medium, timings.slow],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function calculateStreaks(results) {
    if (!results || results.length === 0) return { current: 0, longest: 0 };
    
    const dates = [...new Set(results.map(r => r.date))].sort();
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    // Calculate current streak
    const today = new Date().toISOString().split('T')[0];
    let checkDate = new Date(today);
    
    while (dates.includes(checkDate.toISOString().split('T')[0])) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
    }
    
    // Calculate longest streak
    for (let i = 0; i < dates.length; i++) {
        if (i === 0) {
            tempStreak = 1;
        } else {
            const prev = new Date(dates[i - 1]);
            const curr = new Date(dates[i]);
            const diffDays = Math.floor((prev - curr) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                tempStreak++;
            } else {
                tempStreak = 1;
            }
        }
        longestStreak = Math.max(longestStreak, tempStreak);
    }
    
    return { current: currentStreak, longest: longestStreak };
}

// =============================================
// Streak & Medal Functions
// =============================================

function updateStreakCounts() {
    const today = new Date().toISOString().split("T")[0];
    
    if (lastQuizDate !== today) {
        const lastDate = new Date(lastQuizDate || 0);
        const currentDate = new Date();
        const dayDiff = (currentDate - lastDate) / (1000 * 60 * 60 * 24);

        if (lastQuizDate && dayDiff <= 1) {
            dailyStreakCount++;
        } else {
            dailyStreakCount = 1;
        }

        // Award medals
        medalCounts.bronze++;
        
        if (dailyStreakCount % 7 === 0) {
            medalCounts.silver++;
            showMedalNotification('silver');
        }
        
        if (dailyStreakCount % 30 === 0) {
            medalCounts.gold++;
            showMedalNotification('gold');
        }

        localStorage.setItem("dailyStreakCount", dailyStreakCount.toString());
        localStorage.setItem("lastQuizDate", today);
        localStorage.setItem('medalBronze', medalCounts.bronze.toString());
        localStorage.setItem('medalSilver', medalCounts.silver.toString());
        localStorage.setItem('medalGold', medalCounts.gold.toString());
        
        updateMedalDisplay();
    }
}

function updateMedalDisplay() {
    const bronze = document.getElementById('bronze-count');
    const silver = document.getElementById('silver-count');
    const gold = document.getElementById('gold-count');
    
    if (bronze) bronze.textContent = medalCounts.bronze || 0;
    if (silver) silver.textContent = medalCounts.silver || 0;
    if (gold) gold.textContent = medalCounts.gold || 0;
    
    // Update footer
    const footerBronze = document.getElementById('footer-bronze');
    const footerSilver = document.getElementById('footer-silver');
    const footerGold = document.getElementById('footer-gold');
    
    if (footerBronze) footerBronze.textContent = medalCounts.bronze || 0;
    if (footerSilver) footerSilver.textContent = medalCounts.silver || 0;
    if (footerGold) footerGold.textContent = medalCounts.gold || 0;
}

function showMedalNotification(type) {
    const titles = {
        bronze: "Bronze Medal Earned! 🥉",
        silver: "Silver Medal Earned! 🥈",
        gold: "Gold Medal Earned! 🥇"
    };
    
    const messages = {
        bronze: "You've completed a daily streak!",
        silver: "You've completed a weekly streak!",
        gold: "You've completed a monthly streak!"
    };
    
    showAchievementNotification(titles[type], messages[type], type === 'gold' ? '👑' : '🏅');
}

// =============================================
// File Management
// =============================================

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!currentFolder) {
        showToast("Select a folder first!", 'warning');
        return;
    }
    
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function () {
        try {
            const quizData = JSON.parse(reader.result);

            if (Array.isArray(quizData) && quizData.every(q => q.question && q.options && q.correctIndex !== undefined)) {
                quizData.forEach(q => {
                    if (!q.explanation) q.explanation = "";
                });

                quizzes[currentFolder] = quizData;
                await saveQuizzes();
                
                updateFolderList();
                showToast("Quiz uploaded successfully!", 'success');
            } else {
                showToast("Invalid JSON format!", 'error');
            }
        } catch (e) {
            showToast("Error parsing JSON file!", 'error');
        }
    };
    reader.readAsText(file);
}

function downloadData() {
    const blob = new Blob([JSON.stringify(quizzes, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `quiz_data_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    showToast("Data downloaded successfully!", 'success');
}

async function restoreData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            quizzes = JSON.parse(e.target.result);
            await saveQuizzes();
            updateFolderList();
            showToast("Data restored successfully!", 'success');
        } catch (error) {
            showToast("Error restoring data!", 'error');
        }
    };
    reader.readAsText(file);
}

async function clearMemory() {
    if (confirm("Are you sure you want to clear all memory? This will reset all 'timesIncorrect' to 0.")) {
        try {
            Object.keys(quizzes).forEach((folder) => {
                if (!folder.includes("_Incorrect")) {
                    quizzes[folder].forEach((question) => {
                        question.timesIncorrect = 0;
                    });
                }
            });

            await saveQuizzes();
            showToast("Memory cleared successfully!", 'success');
        } catch (error) {
            showToast("Failed to clear memory!", 'error');
        }
    }
}

function shuffleQuiz() {
    if (!currentFolder || !quizzes[currentFolder]) return;
    
    quizzes[currentFolder] = shuffleArray(quizzes[currentFolder]);
    saveQuizzes();
    showToast("Quiz shuffled successfully!", 'success');
}

// =============================================
// Edit Question Functions
// =============================================

function showEditQuestionForm(index, question) {
    const modal = document.createElement('div');
    modal.className = 'edit-question-modal';
    
    modal.innerHTML = `
        <div class="edit-question-form glass-card">
            <h3><i class="fas fa-edit"></i> Edit Question</h3>
            <form id="editQuestionForm">
                <div class="form-group">
                    <label>Question:</label>
                    <textarea name="question" required>${question.question}</textarea>
                </div>
                
                <div class="options-container">
                    <label>Options:</label>
                    ${question.options.map((option, i) => `
                        <div class="option-row">
                            <input type="text" name="option${i}" value="${option}" required>
                            <label class="radio-label">
                                <input type="radio" name="correctIndex" value="${i}" ${i === question.correctIndex ? 'checked' : ''}>
                                Correct
                            </label>
                        </div>
                    `).join('')}
                </div>
                
                <div class="form-group">
                    <label>Explanation:</label>
                    <textarea name="explanation">${question.explanation || ''}</textarea>
                </div>
                
                <div class="form-buttons">
                    <button type="submit" class="primary-btn">
                        <i class="fas fa-save"></i> Save
                    </button>
                    <button type="button" class="secondary-btn" onclick="this.closest('.edit-question-modal').remove()">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const form = modal.querySelector('#editQuestionForm');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const updatedQuestion = {
            question: formData.get('question'),
            options: [],
            correctIndex: parseInt(formData.get('correctIndex')),
            explanation: formData.get('explanation') || '',
            timesIncorrect: question.timesIncorrect || 0
        };
        
        for (let i = 0; i < question.options.length; i++) {
            updatedQuestion.options.push(formData.get(`option${i}`));
        }
        
        quizzes[currentFolder][index] = updatedQuestion;
        
        saveQuizzes().then(() => {
            modal.remove();
            showFlashcards();
            showToast("Question updated successfully!", 'success');
        });
    });
}

function showAddQuestionDialog() {
    if (!currentFolder) {
        showToast("Please select a folder first!", 'warning');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'edit-question-modal';
    
    modal.innerHTML = `
        <div class="edit-question-form glass-card">
            <h3><i class="fas fa-plus-circle"></i> Add New Question</h3>
            <form id="addQuestionForm">
                <div class="form-group">
                    <label>Question:</label>
                    <textarea name="question" required></textarea>
                </div>
                
                <div class="options-container">
                    <label>Options (at least 2):</label>
                    <div class="option-row">
                        <input type="text" name="option0" required>
                        <label class="radio-label">
                            <input type="radio" name="correctIndex" value="0" checked>
                            Correct
                        </label>
                    </div>
                    <div class="option-row">
                        <input type="text" name="option1" required>
                        <label class="radio-label">
                            <input type="radio" name="correctIndex" value="1">
                            Correct
                        </label>
                    </div>
                    <div class="option-row" id="option2Row">
                        <input type="text" name="option2">
                        <label class="radio-label">
                            <input type="radio" name="correctIndex" value="2">
                            Correct
                        </label>
                    </div>
                    <div class="option-row" id="option3Row">
                        <input type="text" name="option3">
                        <label class="radio-label">
                            <input type="radio" name="correctIndex" value="3">
                            Correct
                        </label>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Explanation:</label>
                    <textarea name="explanation"></textarea>
                </div>
                
                <div class="form-group">
                    <label>Position (optional):</label>
                    <input type="number" name="position" min="1" placeholder="Leave empty for end">
                </div>
                
                <div class="form-buttons">
                    <button type="submit" class="primary-btn">
                        <i class="fas fa-plus"></i> Add Question
                    </button>
                    <button type="button" class="secondary-btn" onclick="this.closest('.edit-question-modal').remove()">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const form = modal.querySelector('#addQuestionForm');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const newQuestion = {
            question: formData.get('question'),
            options: [],
            correctIndex: parseInt(formData.get('correctIndex')),
            explanation: formData.get('explanation') || '',
            timesIncorrect: 0
        };
        
        // Get non-empty options
        for (let i = 0; i < 4; i++) {
            const option = formData.get(`option${i}`);
            if (option && option.trim()) {
                newQuestion.options.push(option.trim());
            }
        }
        
        if (newQuestion.options.length < 2) {
            showToast("Please provide at least 2 options", 'warning');
            return;
        }
        
        if (newQuestion.correctIndex >= newQuestion.options.length) {
            showToast("Correct answer must be one of the provided options", 'warning');
            return;
        }
        
        const position = formData.get('position') ? parseInt(formData.get('position')) - 1 : -1;
        
        if (position >= 0 && position <= quizzes[currentFolder].length) {
            quizzes[currentFolder].splice(position, 0, newQuestion);
        } else {
            quizzes[currentFolder].push(newQuestion);
        }
        
        saveQuizzes().then(() => {
            modal.remove();
            showToast("Question added successfully!", 'success');
        });
    });
}

// =============================================
// Stats & Activity Functions
// =============================================

async function updateStats() {
    if (!currentFolder) return;
    
    const results = await getQuizResults(currentFolder);
    
    if (results.length > 0) {
        const totalQuestions = results.reduce((sum, r) => sum + r.totalQuestions, 0);
        const totalCorrect = results.reduce((sum, r) => sum + r.correctAnswers, 0);
        const accuracy = Math.round((totalCorrect / totalQuestions) * 100);
        
        document.getElementById('accuracyStat').textContent = accuracy + '%';
        document.getElementById('streakStat').textContent = dailyStreakCount;
        
        // Calculate total study time
        const totalTime = results.reduce((sum, r) => sum + (r.timeTaken || 0), 0);
        const hours = Math.floor(totalTime / 3600);
        document.getElementById('studyTimeStat').textContent = hours + 'h';
    }
}



function updateFrequentFoldersList() {
    const container = document.getElementById('frequentFolders');
    if (!container) return;
    
    const topFolders = Object.entries(folderUsageStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    if (topFolders.length === 0) {
        container.innerHTML = '<span>No data yet</span>';
        return;
    }
    
    container.innerHTML = topFolders.map(([folder]) => `
        <button onclick="document.getElementById('folderSelect').value = '${folder}'; selectFolder(); goHome();">
            <i class="fas fa-folder"></i> ${folder}
        </button>
    `).join('');
}

// =============================================
// Celebration Functions
// =============================================
// Line around 1710 - Update this section
document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initDB();
        await loadQuizzes();
        
        // Load theme
        const savedTheme = localStorage.getItem("quizTheme");
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.body.classList.add('dark-theme');
        }
        
        // Update UI
        updateFolderList();
        updateMedalDisplay();
        updateFrequentFoldersList();
        await updateRecentActivity();  // ✅ YEH LINE HONI CHAHIYE
        
        // Set current year in footer
        document.getElementById('current-year').textContent = new Date().getFullYear();
        
        // Check birthday
        checkBirthday();
        
        // Check for new day
        checkForNewDay();
        
        // Back to top button visibility
        window.addEventListener('scroll', () => {
            const backToTop = document.querySelector('.back-to-top');
            if (window.scrollY > 300) {
                backToTop.classList.add('visible');
            } else {
                backToTop.classList.remove('visible');
            }
        });
        
        console.log("QuizMaster Pro initialized successfully!");
        
    } catch (error) {
        console.error("Initialization error:", error);
        showToast("Error initializing app. Please refresh.", 'error');
    }
});
// Reset expand state when going home or switching views
function resetActivityExpand() {
    activityExpanded = false;
    const container = document.getElementById('recentActivityList');
    if (!container) return;
    
    // Remove collapsed class
    container.classList.remove('collapsed');
    
    // Get all items
    const allItems = container.querySelectorAll('.activity-item');
    
    // Show all items temporarily to reset
    allItems.forEach(item => item.style.display = 'flex');
    
    // Get total items
    const totalItems = allItems.length;
    
    // If more than 5, hide extras and show button
    if (totalItems > 5) {
        allItems.forEach((item, index) => {
            if (index >= 5) {
                item.style.display = 'none';
            }
        });
        container.classList.add('collapsed');
        
        // Update button if exists
        const btn = document.querySelector('.show-more-btn');
        if (btn) {
            const icon = btn.querySelector('i');
            const span = btn.querySelector('span');
            if (icon) icon.className = 'fas fa-chevron-down';
            if (span) span.textContent = `Show More (${totalItems - 5} more)`;
            btn.classList.remove('expanded');
        }
    }
}
function triggerHighAccuracyCelebration() {
    // Confetti
    const duration = 3000;
    const end = Date.now() + duration;
    
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];
    
    (function frame() {
        confetti({
            particleCount: 2,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: colors
        });
        confetti({
            particleCount: 2,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: colors
        });
        
        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
    
    // Show trophy
    const trophy = document.createElement('div');
    trophy.className = 'trophy-animation';
    trophy.innerHTML = '🏆';
    document.body.appendChild(trophy);
    
    setTimeout(() => trophy.remove(), 2000);
}

function showAchievementNotification(title, message, icon) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
        <div class="achievement-icon">${icon}</div>
        <div class="achievement-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Confetti
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#10b981', '#f59e0b']
    });
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}

// =============================================
// Initialization
// =============================================

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initDB();
        await loadQuizzes();
        
        // Load theme
        const savedTheme = localStorage.getItem("quizTheme");
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.body.classList.add('dark-theme');
        }
        
        // Update UI
        updateFolderList();
        updateMedalDisplay();
        updateFrequentFoldersList();
        await updateRecentActivity();
        
        // Set current year in footer
        document.getElementById('current-year').textContent = new Date().getFullYear();
        
        // Check birthday
        checkBirthday();
        
        // Check for new day
        checkForNewDay();
        
        // Back to top button visibility
        window.addEventListener('scroll', () => {
            const backToTop = document.querySelector('.back-to-top');
            if (window.scrollY > 300) {
                backToTop.classList.add('visible');
            } else {
                backToTop.classList.remove('visible');
            }
        });
        
        console.log("QuizMaster Pro initialized successfully!");
        
    } catch (error) {
        console.error("Initialization error:", error);
        showToast("Error initializing app. Please refresh.", 'error');
    }
});

function checkBirthday() {
    const today = new Date();
    const birthday = localStorage.getItem('userBirthday');
    
    if (birthday) {
        const bday = new Date(birthday);
        if (today.getMonth() === bday.getMonth() && today.getDate() === bday.getDate()) {
            showAchievementNotification(
                "Happy Birthday! 🎂",
                "Wishing you a wonderful day!",
                "🎉"
            );
        }
    }
}

function checkForNewDay() {
    const lastCheck = localStorage.getItem('lastDateCheck');
    const today = new Date().toISOString().split('T')[0];
    
    if (lastCheck !== today) {
        // Reset daily goal completion flag
        localStorage.setItem('goalCompletedToday', 'false');
        localStorage.setItem('lastDateCheck', today);
    }
}

// =============================================
// Export functions for global use
// =============================================

// Make functions globally available
window.toggleMenu = toggleMenu;
window.toggleTheme = toggleTheme;
window.showQuickActions = showQuickActions;
window.createFolder = createFolder;
window.confirmDeleteFolder = confirmDeleteFolder;
window.selectFolder = selectFolder;
window.startQuiz = startQuiz;
window.goHome = goHome;
window.showFlashcards = showFlashcards;
window.showAnalysis = showAnalysis;
window.showNotes = showNotes;
window.showDifficultQuestions = showDifficultQuestions;
window.handleFileUpload = handleFileUpload;
window.downloadData = downloadData;
window.restoreData = restoreData;
window.clearMemory = clearMemory;
window.shuffleQuiz = shuffleQuiz;
window.showAddQuestionDialog = showAddQuestionDialog;
window.markCurrentAsDifficult = markCurrentAsDifficult;
window.restartQuiz = restartQuiz;
window.startPomodoroSetup = () => {
    if (typeof window.startPomodoro === 'function') {
        window.startPomodoro();
    } else {
        showToast("Pomodoro module not loaded", 'warning');
    }
};
window.startRapidRound = () => {
    if (typeof window.initRapidRound === 'function') {
        window.initRapidRound();
    } else {
        showToast("Rapid Round module not loaded", 'warning');
    }
};

// =============================================
// Recent Activity Click Handler
// =============================================

function handleActivityClick(result) {
    // Hide current view
    document.getElementById("quizSelection")?.classList.remove("active");
    
    // Show quiz container
    const quizContainer = document.getElementById("quizContainer");
    quizContainer.classList.remove("hidden");
    
    // Get the questions for this quiz result
    const folderQuestions = quizzes[result.folderName];
    if (!folderQuestions) {
        showToast("Folder not found!", 'error');
        return;
    }
    
    // Prepare the quiz data based on the result
    let questionsToShow = [];
    
    if (result.correctQuestionIds && result.correctQuestionIds.length > 0) {
        // If we have specific question IDs, use those
        questionsToShow = folderQuestions.filter((_, index) => 
            result.correctQuestionIds.includes(index)
        );
    } else {
        // Otherwise, take a slice based on start/end indices
        const start = result.startIndex ? result.startIndex - 1 : 0;
        const end = result.endIndex || folderQuestions.length;
        questionsToShow = folderQuestions.slice(start, end);
    }
    
    // Set up the quiz
    currentQuiz = questionsToShow.map(q => ({ ...q }));
    currentQuestionIndex = 0;
    score = result.correctAnswers || 0;
    questionTimes = result.questionTimes || [];
    totalQuizTime = result.timeTaken || 0;
    quizMode = "review"; // Special mode for review
    
    // Update UI
    document.getElementById("total-questions").textContent = currentQuiz.length;
    document.getElementById("current-question").textContent = "1";
    
    // Reset progress bar
    updateQuizProgress();
    
    // Load the first question
    loadQuestionForReview();
    
    showToast(`Reviewing quiz from ${new Date(result.date).toLocaleDateString()}`, 'info');
}

function loadQuestionForReview() {
    if (currentQuestionIndex >= currentQuiz.length) {
        showResults();
        return;
    }

    const questionData = currentQuiz[currentQuestionIndex];

    // Update progress
    document.getElementById("current-question").textContent = currentQuestionIndex + 1;
    document.getElementById("total-questions").textContent = currentQuiz.length;
    updateQuizProgress();

    // Show question
    document.getElementById("question-text").textContent = questionData.question;

    // Clear and create options
    const optionsContainer = document.getElementById("options");
    optionsContainer.innerHTML = "";

    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    
    questionData.options.forEach((optionText, index) => {
        const button = document.createElement("button");
        button.classList.add("option-btn");
        
        // Check if this was the selected answer in the original quiz
        const wasSelected = questionData.selectedAnswer === optionText;
        const isCorrect = index === questionData.correctIndex;
        
        button.innerHTML = `
            <span class="option-prefix">${letters[index]}</span>
            <span class="option-text">${optionText}</span>
        `;
        
        // Show feedback based on original quiz
        if (wasSelected) {
            if (isCorrect) {
                button.classList.add("correct");
            } else {
                button.classList.add("incorrect");
            }
        } else if (isCorrect && wasSelected !== undefined) {
            // Highlight correct answer if user got it wrong
            button.classList.add("correct");
        }
        
        button.disabled = true; // Disable for review mode
        
        optionsContainer.appendChild(button);
    });
    
    // Add navigation buttons for review mode
    const footer = document.querySelector('.quiz-footer');
    footer.innerHTML = `
        <div style="display: flex; gap: 10px; width: 100%; justify-content: center;">
            <button class="secondary-btn" onclick="previousReviewQuestion()" ${currentQuestionIndex === 0 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i> Previous
            </button>
            <button class="primary-btn" onclick="nextReviewQuestion()" ${currentQuestionIndex === currentQuiz.length - 1 ? 'disabled' : ''}>
                Next <i class="fas fa-chevron-right"></i>
            </button>
            <button class="secondary-btn" onclick="goHome()">
                <i class="fas fa-home"></i> Home
            </button>
        </div>
    `;
}

function previousReviewQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        loadQuestionForReview();
    }
}

function nextReviewQuestion() {
    if (currentQuestionIndex < currentQuiz.length - 1) {
        currentQuestionIndex++;
        loadQuestionForReview();
    }
}

async function updateRecentActivity() {
    const activityList = document.getElementById('recentActivityList');
    if (!activityList) return;
    
    const results = await getQuizResults();
    
    // Clear container
    activityList.innerHTML = '';
    
    if (results.length === 0) {
        activityList.innerHTML = '<div class="empty-state">No recent activity</div>';
        return;
    }
    
    // Sort by date (newest first)
    const sortedResults = [...results].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    
    // Create activity items HTML with click handlers
    sortedResults.forEach((r, index) => {
        const date = new Date(r.date).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const accuracy = Math.round((r.correctAnswers / r.totalQuestions) * 100);
        const perfectClass = accuracy === 100 ? 'perfect' : '';
        
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.setAttribute('data-index', index);
        activityItem.style.cursor = 'pointer'; // Make it look clickable
        
        activityItem.innerHTML = `
            <div class="activity-icon">
                <i class="fas ${accuracy >= 80 ? 'fa-star' : 'fa-question'}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">${r.folderName || 'Quiz'} - ${r.correctAnswers}/${r.totalQuestions}</div>
                <div class="activity-time">${date}</div>
            </div>
            <span class="activity-badge ${perfectClass}">
                ${accuracy}%
            </span>
        `;
        
        // Add click handler
        activityItem.addEventListener('click', () => handleActivityClick(r));
        
        activityList.appendChild(activityItem);
    });
    
    // Remove any existing show more button
    const existingBtn = document.querySelector('.show-more-btn');
    if (existingBtn) existingBtn.remove();
    
    // Add expand/collapse functionality if more than 5 items
    if (sortedResults.length > 5) {
        createExpandButton(activityList, sortedResults.length);
    } else {
        // If 5 or fewer items, remove collapsed class
        activityList.classList.remove('collapsed');
    }
}

function createExpandButton(container, totalItems) {
    // Create button
    const showMoreBtn = document.createElement('button');
    showMoreBtn.className = 'show-more-btn';
    showMoreBtn.innerHTML = `
        <i class="fas fa-chevron-down"></i>
        <span>Show More (${totalItems - 5} more)</span>
    `;
    
    // Add click handler
    showMoreBtn.addEventListener('click', function() {
        const activityList = document.getElementById('recentActivityList');
        const allItems = activityList.querySelectorAll('.activity-item');
        const icon = this.querySelector('i');
        const span = this.querySelector('span');
        
        if (!activityExpanded) {
            // Show all items
            allItems.forEach(item => item.style.display = 'flex');
            icon.className = 'fas fa-chevron-up';
            span.textContent = 'Show Less';
            this.classList.add('expanded');
            
            // Remove gradient effect
            activityList.classList.remove('collapsed');
        } else {
            // Hide items after first 5
            allItems.forEach((item, index) => {
                if (index >= 5) {
                    item.style.display = 'none';
                } else {
                    item.style.display = 'flex';
                }
            });
            icon.className = 'fas fa-chevron-down';
            span.textContent = `Show More (${totalItems - 5} more)`;
            this.classList.remove('expanded');
            
            // Add gradient effect
            activityList.classList.add('collapsed');
        }
        
        activityExpanded = !activityExpanded;
    });
    
    // Add button after container
    container.parentNode.appendChild(showMoreBtn);
    
    // Get all items
    const allItems = container.querySelectorAll('.activity-item');
    
    // Initially hide items after first 5
    allItems.forEach((item, index) => {
        if (index >= 5) {
            item.style.display = 'none';
        } else {
            item.style.display = 'flex';
        }
    });
    
    // Add collapsed class for gradient effect
    container.classList.add('collapsed');
}
window.handleActivityClick = handleActivityClick;
window.previousReviewQuestion = previousReviewQuestion;
window.nextReviewQuestion = nextReviewQuestion;
window.resetActivityExpand = resetActivityExpand;  // ✅ YEH ADD KARO
