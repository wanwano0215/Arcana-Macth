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
    
    // Audio state management
    let audioInitialized = false;
    let audioEnabled = true;

    // Initialize audio context and players
    async function initializeAudio() {
        if (audioInitialized) return;
        
        try {
            // Try multiple audio formats
            const audioFormats = [
                '/static/sounds/card-flip.wav',
                '/static/sounds/card.mp3'
            ];
            
            for (const format of audioFormats) {
                try {
                    const audio = new Audio(format);
                    await new Promise((resolve, reject) => {
                        audio.addEventListener('canplaythrough', resolve, { once: true });
                        audio.addEventListener('error', reject, { once: true });
                        audio.load();
                    });
                    
                    window.cardFlipPlayer = audio;
                    audioInitialized = true;
                    console.log('Audio initialized successfully with format:', format);
                    return;
                } catch (err) {
                    console.warn('Failed to load audio format:', format, err);
                    continue;
                }
            }
            throw new Error('No supported audio format found');
        } catch (error) {
            console.error('Audio initialization failed:', error);
            audioEnabled = false;
        }
    }

    // Cleanup function for audio resources
    function cleanupAudio() {
        if (window.cardFlipPlayer) {
            window.cardFlipPlayer.pause();
            window.cardFlipPlayer.src = '';
            window.cardFlipPlayer = null;
        }
        audioInitialized = false;
        audioEnabled = true; // Reset for next initialization
    }

    // Audio playback with fallback
    async function playCardFlipSound() {
        if (!audioEnabled || !window.cardFlipPlayer) return;
        
        try {
            const sound = window.cardFlipPlayer.cloneNode();
            sound.volume = 0.5;
            await sound.play();
        } catch (error) {
            console.error('Error playing card flip sound:', error);
            audioEnabled = false;
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
                        statusMessage.textContent = data.message;
                        statusMessage.classList.add('game-clear');
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
            // Silent fail for initialization
        }
        
        newGameBtn.addEventListener('click', startNewGame);
        cardGrid.addEventListener('click', handleCardClick);
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', cleanupAudio);
        
        initializeBoard();
    })();
});
