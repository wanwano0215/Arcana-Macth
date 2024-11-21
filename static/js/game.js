// Load Panzoom from CDN
const loadPanzoom = () => {
    return new Promise((resolve, reject) => {
        if (window.Panzoom) {
            resolve(window.Panzoom);
            return;
        }
        
        const panzoomScript = document.createElement('script');
        panzoomScript.src = 'https://unpkg.com/@panzoom/panzoom@4.5.1/dist/panzoom.min.js';
        panzoomScript.onload = () => resolve(window.Panzoom);
        panzoomScript.onerror = () => reject(new Error('Failed to load Panzoom'));
        document.head.appendChild(panzoomScript);
    });
};

document.addEventListener('DOMContentLoaded', async function() {
// Initialize variables and Panzoom
const cardImageMap = {
    0: '0愚者',
    1: '1魔術師',
    2: '2女教皇',
    3: '3女帝',
    4: '4皇帝',
    5: '5教皇',
    6: '6恋人',
    7: '7戦車',
    8: '8力',
    9: '9隠者',
    10: '10運命の輪',
    11: '11正義',
    12: '12吊るされた男',
    13: '13死神',
    14: '14節制',
    15: '15悪魔',
    16: '16塔',
    17: '17星',
    18: '18月',
    19: '19太陽',
    20: '20審判',
    21: '21世界'
};

// Preload images
async function preloadImages() {
    console.log('Starting image preload...');
    const imagePromises = [];
    
    // Preload card back
    imagePromises.push(new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(`Card back loaded`);
        img.onerror = () => reject(`Failed to load card back`);
        img.src = `/static/images/card-back.png`;
    }));
    
    // Preload all card faces
    for (let i = 0; i <= 21; i++) {
        const imageName = cardImageMap[i];
        if (imageName) {
            imagePromises.push(new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(`Loaded ${imageName}`);
                img.onerror = () => reject(`Failed to load ${imageName}`);
                img.src = `/static/images/${imageName}.png`;
            }));
        }
    }
    
    try {
        const results = await Promise.allSettled(imagePromises);
        console.log('Image preload results:', results);
        const failedLoads = results.filter(r => r.status === 'rejected');
        if (failedLoads.length > 0) {
            console.warn('Some images failed to load:', failedLoads);
        }
    } catch (error) {
        console.error('Error preloading images:', error);
    }
}

// Load Panzoom from CDN
const panzoomScript = document.createElement('script');
panzoomScript.src = 'https://unpkg.com/@panzoom/panzoom@4.5.1/dist/panzoom.min.js';
document.head.appendChild(panzoomScript);
    const cardGrid = document.getElementById('card-grid');
    const statusMessage = document.getElementById('status-message');
    const playerScoreElement = document.getElementById('player-score');
    const newGameBtn = document.getElementById('new-game-btn');

    let isProcessing = false;
    let firstCardFlipped = false;
    const MAX_RETRIES = 3;
    let lastClickTime = 0;
    const MIN_CLICK_INTERVAL = 200;
    const FLIP_ANIMATION_DURATION = 600;
    const MATCH_DISPLAY_DURATION = 1000;
    
    // Timer variables
    let gameStartTime = null;
    let timerInterval = null;
    
    // Audio state management
    let cardFlipSound = null;
    let matchSound = null;
    let bgmPlayer = null;
    let audioContext = null;
    let audioInitialized = false;

    // Timer functions
    function startTimer() {
        if (!gameStartTime) {
            gameStartTime = Date.now();
            updateTimer();
            timerInterval = setInterval(updateTimer, 1000);
        }
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function updateTimer() {
        const timerDisplay = document.getElementById('timer-display');
        if (!gameStartTime || !timerDisplay) return;
        
        const elapsedTime = Math.floor((Date.now() - gameStartTime) / 1000);
        const minutes = Math.floor(elapsedTime / 60);
        const seconds = elapsedTime % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Initialize audio context and gain node
    async function initializeAudio() {
        if (audioInitialized) return;
        
        const loadAudio = async (url, volume = 0.3) => {
            const audio = new Audio(url);
            audio.volume = volume;
            
            try {
                await new Promise((resolve, reject) => {
                    const loadHandler = () => {
                        audio.removeEventListener('canplaythrough', loadHandler);
                        audio.removeEventListener('error', errorHandler);
                        resolve();
                    };
                    const errorHandler = (e) => {
                        audio.removeEventListener('canplaythrough', loadHandler);
                        audio.removeEventListener('error', errorHandler);
                        reject(new Error(`Failed to load audio: ${url}`));
                    };
                    audio.addEventListener('canplaythrough', loadHandler);
                    audio.addEventListener('error', errorHandler);
                    audio.load();
                });
                return audio;
            } catch (error) {
                console.error(`Failed to load audio ${url}:`, error);
                return null;
            }
        };
        
        try {
            console.log('Loading audio files...');
            
            // Load all audio files in parallel
            const [cardFlipAudio, matchAudio, bgmAudio] = await Promise.all([
                loadAudio('/static/sounds/card_flip.mp3', 0.3),
                loadAudio('/static/sounds/match.mp3', 0.3),
                loadAudio('/static/sounds/BGM.mp3', 0.1)
            ]);
            
            // Verify all audio files loaded successfully
            if (!cardFlipAudio || !matchAudio || !bgmAudio) {
                throw new Error('Some audio files failed to load');
            }
            
            cardFlipSound = cardFlipAudio;
            matchSound = matchAudio;
            bgmPlayer = bgmAudio;
            bgmPlayer.loop = true;
            
            console.log('Audio elements created:', {
                cardFlipSound: !!cardFlipSound,
                matchSound: !!matchSound,
                bgmPlayer: !!bgmPlayer
            });
            
            // Set up BGM to start on first user interaction
            document.addEventListener('click', async function bgmInitHandler() {
                try {
                    if (bgmPlayer && !bgmPlayer.playing) {
                        bgmPlayer.volume = 0.1; // Set initial volume to 10%
                        await bgmPlayer.play();
                        document.removeEventListener('click', bgmInitHandler);
                        console.log('BGM started successfully');
                    }
                } catch (error) {
                    console.warn('BGM playback failed:', error);
                }
            }, { once: false });
            
            audioInitialized = true;
            console.log('Audio initialized successfully');
        } catch (error) {
            console.error('Audio initialization failed:', error);
            audioInitialized = false;
            throw new Error('Audio initialization failed');
        }
    }

    // Audio playback functions
    async function playCardFlipSound() {
        if (!audioInitialized || !cardFlipSound) return;
        try {
            // Create a new instance for each play to handle rapid clicks
            const sound = cardFlipSound.cloneNode();
            sound.volume = 0.3;  // Increased from 0.2 to 0.3
            await sound.play();
        } catch (error) {
            console.error('Error playing card flip sound:', error);
            // Silent fail to not disrupt gameplay
        }
    }

    async function playMatchSound() {
        if (!audioInitialized || !matchSound) return;
        try {
            // Create a new instance for match sound as well
            const sound = matchSound.cloneNode();
            sound.volume = 0.3;  // Reduced from 0.4 to 0.3
            await sound.play();
        } catch (error) {
            console.error('Error playing match sound:', error);
            // Silent fail to not disrupt gameplay
        }
    }

    // Cleanup function for audio resources
    function cleanupAudio() {
        try {
            if (bgmPlayer) {
                bgmPlayer.pause();
                bgmPlayer.currentTime = 0;
                // Fade out BGM
                const fadeOut = setInterval(() => {
                    if (bgmPlayer.volume > 0.01) {
                        bgmPlayer.volume = Math.max(0, bgmPlayer.volume - 0.05);
                    } else {
                        clearInterval(fadeOut);
                        bgmPlayer = null;
                    }
                }, 50);
            }
            if (cardFlipSound) {
                cardFlipSound.pause();
                cardFlipSound = null;
            }
            if (matchSound) {
                matchSound.pause();
                matchSound = null;
            }
            audioInitialized = false;
            console.log('Audio cleanup completed');
        } catch (error) {
            console.error('Error during audio cleanup:', error);
        }
    }

    // Map card values to their corresponding image names
    const cardImageMap = {
        0: '0愚者',
        1: '1魔術師',
        2: '2女教皇',
        3: '3女帝',
        4: '4皇帝',
        5: '5教皇',
        6: '6恋人',
        7: '7戦車',
        8: '8力',
        9: '9隠者',
        10: '10運命の輪',
        11: '11正義',
        12: '12吊るされた男',
        13: '13死神',
        14: '14節制',
        15: '15悪魔',
        16: '16塔',
        17: '17星',
        18: '18月',
        19: '19太陽',
        20: '20審判',
        21: '21世界'
    };

    let preloadedImages = new Map();

    const preloadImages = async () => {
        const loadImage = (imageName) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    preloadedImages.set(imageName, img);
                    resolve(img);
                };
                img.onerror = () => reject(new Error(`Failed to load image: ${imageName}`));
                img.src = `/static/images/${imageName}.png`;
            });
        };

        try {
            const imagePromises = Object.values(cardImageMap).map(imageName => loadImage(imageName));
            imagePromises.push(loadImage('カード裏面'));
            await Promise.all(imagePromises);
        } catch (error) {
            // Silent fail for image preload
        }
    };

    function createCard(index) {
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.setAttribute('data-index', index);
        
        // Create card inner structure
        const cardInner = document.createElement('div');
        cardInner.className = 'card-inner';
        
        // Create front face
        const cardFront = document.createElement('div');
        cardFront.className = 'card-front';
        const frontImg = document.createElement('img');
        frontImg.src = '/static/images/カード裏面.png';
        frontImg.alt = 'card back';
        frontImg.className = 'card-img';
        cardFront.appendChild(frontImg);
        
        // Create back face
        const cardBack = document.createElement('div');
        cardBack.className = 'card-back';
        const backImg = document.createElement('img');
        backImg.alt = 'card front';
        backImg.className = 'card-img';
        cardBack.appendChild(backImg);
        
        // Assemble card
        cardInner.appendChild(cardFront);
        cardInner.appendChild(cardBack);
        card.appendChild(cardInner);
        
        // Add click event listener
        card.addEventListener('click', handleCardClick);
        
        return card;
    // Initialize Panzoom when needed
    let panzoomInstance = null;
    const cardModal = document.getElementById('cardModal');
    const panzoomElement = document.querySelector('.panzoom');

    // Initialize Panzoom when modal is shown
    cardModal.addEventListener('show.bs.modal', async function () {
        try {
            if (!panzoomInstance) {
                const Panzoom = await loadPanzoom();
                panzoomInstance = Panzoom(panzoomElement, {
                    maxScale: 5,
                    minScale: 0.5,
                    contain: 'outside'
                });
                
                // Add mouse wheel zoom support
                panzoomElement.parentElement.addEventListener('wheel', function(event) {
                    if (!event.shiftKey) return;
                    event.preventDefault();
                    panzoomInstance.zoomWithWheel(event);
                });
            }
        } catch (error) {
            console.error('Failed to initialize Panzoom:', error);
            statusMessage.textContent = 'Failed to initialize zoom functionality';
            statusMessage.classList.add('alert-warning');
        }
    });

    cardModal.addEventListener('hidden.bs.modal', function () {
        if (panzoomInstance) {
            try {
                panzoomInstance.reset();
            } catch (error) {
                console.error('Failed to reset Panzoom:', error);
            }
        }
    });

    function showEnlargedCard(card) {
        try {
            const cardImage = card.querySelector('.card-back img');
            if (cardImage && cardImage.src) {
                const enlargedCard = document.getElementById('enlarged-card');
                enlargedCard.src = cardImage.src;
                const modalInstance = new bootstrap.Modal(cardModal);
                modalInstance.show();
            }
        } catch (error) {
            console.error('Failed to show enlarged card:', error);
            statusMessage.textContent = 'Failed to show enlarged card';
            statusMessage.classList.add('alert-warning');
        }
    }

    // Update card click handler to support enlargement
    function handleCardClick(event) {
        const card = event.target.closest('.memory-card');
        if (!card) return;
        
        // If the card is already flipped, show enlarged view
        if (card.classList.contains('flipped')) {
            const cardImage = card.querySelector('.card-back img');
            if (cardImage && cardImage.src) {
                showEnlargedCard(cardImage.src);
                return;
            }
        }

        // Continue with original click handling for unflipped cards
        const currentTime = Date.now();
        if (currentTime - lastClickTime < MIN_CLICK_INTERVAL) {
            handleRateLimitError(card, '操作が早すぎます', 0.2);
            return;
        }
    }

    async function flipCard(card, value) {
        const backFace = card.querySelector('.card-back img');
        const imageName = cardImageMap[value] || `${value}愚者`;
        backFace.src = `/static/images/${imageName}.png`;
        card.classList.add('flipped');
        await playCardFlipSound();
    }

    async function unflipCard(card) {
        card.classList.remove('flipped');
        await playCardFlipSound();
        setTimeout(() => {
            const backFace = card.querySelector('.card-back img');
            backFace.src = '';
        }, FLIP_ANIMATION_DURATION);
    }

    function markAsMatched(card) {
        card.classList.add('matched');
    }

    function updateScore(score) {
        if (playerScoreElement) {
            playerScoreElement.textContent = score;
        }
    }

    function showLoadingState(card, show) {
        if (show) {
            card.classList.add('loading');
        } else {
            card.classList.remove('loading');
        }
    }

    function handleRateLimitError(card, message, backoffTime = 1.0) {
        card.classList.add('rate-limited');
        statusMessage.textContent = `${message} (${backoffTime.toFixed(1)}秒後に再試行可能)`;
        statusMessage.classList.add('alert-warning');
        
        setTimeout(() => {
            card.classList.remove('rate-limited');
            statusMessage.classList.remove('alert-warning');
            statusMessage.classList.add('alert-info');
            statusMessage.textContent = 'カードを2枚めくってください';
        }, backoffTime * 1000);
    }

    async function makeRequestWithRetry(url, options, retries = MAX_RETRIES) {
        let attempt = 1;
        let delay = 200;
        
        while (attempt <= retries) {
            try {
                const response = await fetch(url, options);
                if (response.ok) {
                    return await response.json();
                }
                
                if (response.status === 429) {
                    const data = await response.json();
                    if (attempt < retries) {
                        const backoffTime = data.backoff || delay / 1000;
                        await new Promise(resolve => setTimeout(resolve, backoffTime * 1000));
                        delay *= 1.2;
                        attempt++;
                        continue;
                    }
                    throw new Error('Rate limit exceeded');
                }
                
                throw new Error(`HTTP error! status: ${response.status}`);
            } catch (error) {
                if (attempt === retries) throw error;
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 1.2;
                attempt++;
            }
        }
        throw new Error('Max retries reached');
    }

    // Initialize modal and Panzoom elements
    const cardModal = document.getElementById('cardModal');
    const panzoomElement = document.querySelector('.panzoom');
    let panzoomInstance = null;

    // Initialize Panzoom when modal is shown
    cardModal.addEventListener('show.bs.modal', function () {
        if (!panzoomInstance && window.Panzoom) {
            panzoomInstance = window.Panzoom(panzoomElement, {
                maxScale: 5,
                minScale: 0.5,
                contain: 'outside'
            });
            
            // Add mouse wheel zoom support
            panzoomElement.parentElement.addEventListener('wheel', function(event) {
                if (!event.shiftKey) return;
                event.preventDefault();
                panzoomInstance.zoomWithWheel(event);
            });
        }
    });

    cardModal.addEventListener('hidden.bs.modal', function () {
        if (panzoomInstance) {
            panzoomInstance.reset();
        }
    });

    function showEnlargedCard(card) {
        const cardImage = card.querySelector('.card-back img');
        if (cardImage && cardImage.src) {
            const enlargedCard = document.getElementById('enlarged-card');
            enlargedCard.src = cardImage.src;
            const modalInstance = new bootstrap.Modal(cardModal);
            modalInstance.show();
        }
    }

    function handleCardClick(event) {
        const currentTime = Date.now();
        if (currentTime - lastClickTime < MIN_CLICK_INTERVAL) {
            handleRateLimitError(event.target.closest('.memory-card'), '操作が早すぎます', 0.2);
            return;
        }
        lastClickTime = currentTime;

        const card = event.target.closest('.memory-card');
        if (!card) return;

        // Show enlarged view for matched cards
        if (card.classList.contains('matched')) {
            showEnlargedCard(card);
            return;
        }

        if (isProcessing) return;
        if (!card || card.classList.contains('flipped') || card.classList.contains('matched')) {
            return;
        }

        isProcessing = true;
        showLoadingState(card, true);
        
        try {
            const cardIndex = parseInt(card.dataset.index);
            const data = await makeRequestWithRetry(`/flip/${cardIndex}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (data.valid) {
                await flipCard(card, data.card_value);
                if (!firstCardFlipped) {
                    firstCardFlipped = true;
                    startTimer();  // Start timer on first card flip
                    statusMessage.textContent = data.message;
                    isProcessing = false;
                    return;
                }

                firstCardFlipped = false;
                if (data.turn_complete) {
                    if (data.is_match) {
                        const firstCard = document.querySelector(`[data-index="${data.first_card}"]`);
                        markAsMatched(card);
                        markAsMatched(firstCard);
                        updateScore(data.player_score);
                        await playMatchSound();
                        statusMessage.textContent = '🎉 Match! 🎉';
                    } else {
                        await new Promise(resolve => setTimeout(resolve, MATCH_DISPLAY_DURATION));
                        const firstCard = document.querySelector(`[data-index="${data.first_card}"]`);
                        await Promise.all([
                            unflipCard(card),
                            unflipCard(firstCard)
                        ]);
                        statusMessage.textContent = 'カードを2枚めくってください';
                    }

                    if (data.game_over) {
                        stopTimer();
                        statusMessage.textContent = data.message;
                        statusMessage.classList.add('game-clear');
                        cleanupAudio();
                    }
                }
            } else {
                handleRateLimitError(card, data.message, data.backoff || 0.2);
            }
        } catch (error) {
            if (error.message === 'Rate limit exceeded') {
                handleRateLimitError(card, '操作が早すぎます', 0.2);
            } else {
                statusMessage.textContent = 'エラーが発生しました';
                statusMessage.classList.add('alert-danger');
            }
        } finally {
            isProcessing = false;
            showLoadingState(card, false);
        }
    }

    async function startNewGame() {
        try {
            stopTimer();
            gameStartTime = null;
            document.getElementById('timer-display').textContent = '00:00';
            statusMessage.textContent = '新しいゲームを開始中...';
            await makeRequestWithRetry('/new-game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            initializeBoard();
            updateScore(0);
            statusMessage.textContent = 'カードを2枚めくってください';
            statusMessage.classList.remove('alert-danger', 'alert-warning', 'game-clear');
            statusMessage.classList.add('alert-info');
            cleanupAudio();  // Stop previous audio
            await initializeAudio();  // Initialize new audio
        } catch (error) {
            statusMessage.textContent = '新しいゲームを開始できませんでした';
            statusMessage.classList.add('alert-danger');
        }
    }

    function initializeBoard() {
        // Clear existing content
        while (cardGrid.firstChild) {
            cardGrid.removeChild(cardGrid.firstChild);
        }
        
        // Create fragment for better performance
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < 44; i++) {
            fragment.appendChild(createCard(i));
        }
        
        // Append all cards at once
        cardGrid.appendChild(fragment);
        firstCardFlipped = false;
        
        // Reset game state
        isProcessing = false;
        lastClickTime = 0;
        statusMessage.textContent = 'カードを2枚めくってください';
        statusMessage.classList.remove('alert-danger', 'alert-warning', 'game-clear');
        statusMessage.classList.add('alert-info');
    }

    // Initialize game
    (async function initGame() {
        try {
            await preloadImages();
            await initializeAudio();
        } catch (error) {
            console.error('Initialization error:', error);
        }
        
        newGameBtn.addEventListener('click', startNewGame);
        cardGrid.addEventListener('click', handleCardClick);
        
        initializeBoard();
    })();
});
