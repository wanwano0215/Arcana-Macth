document.addEventListener('DOMContentLoaded', async function() {
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
        
        try {
            // Create audio elements with proper error handling
            cardFlipSound = new Audio('/static/sounds/card_flip.mp3');
            cardFlipSound.volume = 0.2;
            
            // Wait for the sound to be loaded
            await new Promise((resolve, reject) => {
                cardFlipSound.addEventListener('canplaythrough', resolve);
                cardFlipSound.addEventListener('error', reject);
                cardFlipSound.load();
            });
            
            matchSound = new Audio('/static/sounds/match.mp3');
            matchSound.volume = 0.4;  // Increased from 0.3
            
            bgmPlayer = new Audio('/static/sounds/BGM.mp3');
            bgmPlayer.volume = 0.1;  // Reduced from 0.15
            bgmPlayer.loop = true;
            
            // Ensure BGM is properly loaded before attempting playback
            await new Promise((resolve, reject) => {
                bgmPlayer.addEventListener('canplaythrough', resolve);
                bgmPlayer.addEventListener('error', reject);
                bgmPlayer.load();
            });
            
            // Start BGM after initialization
            try {
                await bgmPlayer.play();
            } catch (error) {
                console.error('BGM playback failed:', error);
                // Silent fail to not disrupt gameplay
            }
            
            audioInitialized = true;
            console.log('Audio initialized successfully');
        } catch (error) {
            console.error('Audio initialization failed:', error);
            audioInitialized = false;
        }
    }

    // Audio playback functions
    async function playCardFlipSound() {
        if (!audioInitialized || !cardFlipSound) return;
        try {
            // Create a new instance for each play to handle rapid clicks
            const sound = cardFlipSound.cloneNode();
            sound.volume = 0.2;
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
            sound.volume = 0.4;  // Increased from 0.3
            await sound.play();
        } catch (error) {
            console.error('Error playing match sound:', error);
            // Silent fail to not disrupt gameplay
        }
    }

    // Cleanup function for audio resources
    function cleanupAudio() {
        if (bgmPlayer) {
            bgmPlayer.pause();
            bgmPlayer.currentTime = 0;
            bgmPlayer = null;
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
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-front">
                    <img src="/static/images/カード裏面.png" alt="card back" class="card-img">
                </div>
                <div class="card-back">
                    <img src="" alt="card front" class="card-img">
                </div>
            </div>
        `;
        return card;
    }

    async function flipCard(card, value) {
        const backFace = card.querySelector('.card-back img');
        const imageName = cardImageMap[value] || `${value}愚者`;
        backFace.src = `/static/images/${imageName}.png`;
        card.classList.add('flipped');
        await playCardFlipSound();
        
        // Show enlarged view after flip
        setTimeout(() => {
            showEnlargedCard(card);
        }, 500); // Wait for flip animation to complete
    }

    function showEnlargedCard(card) {
        const overlay = document.getElementById('enlarged-card-overlay');
        const container = overlay.querySelector('.enlarged-card-container');
        
        // Only show enlarged view if card is flipped
        if (!card.classList.contains('flipped')) return;
        
        // Create a new card element for the enlarged view
        const enlargedCard = document.createElement('div');
        enlargedCard.className = 'memory-card enlarged-card';
        
        // Copy the inner content from the original card
        const cardInner = card.querySelector('.card-inner').cloneNode(true);
        enlargedCard.appendChild(cardInner);
        
        // Clear previous content and add new enlarged card
        container.innerHTML = '';
        container.appendChild(enlargedCard);
        
        // Show overlay
        overlay.style.display = 'flex';
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });
        
        // Add click handler to close when clicking either the overlay or the card
        const closeEnlarged = (e) => {
            if (e.target === overlay || e.target.closest('.enlarged-card')) {
                overlay.classList.remove('active');
                setTimeout(() => {
                    overlay.style.display = 'none';
                    container.innerHTML = '';
                }, 300);
            }
        };
        
        overlay.onclick = closeEnlarged;
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

    async function handleCardClick(event) {
        const currentTime = Date.now();
        if (currentTime - lastClickTime < MIN_CLICK_INTERVAL) {
            handleRateLimitError(event.target.closest('.memory-card'), '操作が早すぎます', 0.2);
            return;
        }
        lastClickTime = currentTime;

        if (isProcessing) return;

        const card = event.target.closest('.memory-card');
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
                    statusMessage.innerHTML = `${data.message}<br><small>※画像拡大時、カード以外をクリックしてください</small>`;
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
                        statusMessage.innerHTML = '🎉 Match! 🎉<br><small>※画像拡大時、カード以外をクリックしてください</small>';
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
        cardGrid.innerHTML = '';
        for (let i = 0; i < 44; i++) {
            cardGrid.appendChild(createCard(i));
        }
        firstCardFlipped = false;
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
