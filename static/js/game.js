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

// Image cache and preloading
const imageCache = new Map();
const cardBackImage = '/static/images/カード裏面.png';

// Clear image cache
function clearImageCache() {
    console.log('Clearing image cache...');
    imageCache.clear();
}

// Preload single image with retries
async function preloadImage(src, retries = 3) {
    console.log(`Attempting to preload image: ${src}`);
    
    if (imageCache.has(src)) {
        console.log(`Image already cached: ${src}`);
        return imageCache.get(src);
    }
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const img = await new Promise((resolve, reject) => {
                const newImg = new Image();
                
                newImg.onload = () => {
                    console.log(`Successfully loaded image: ${src}`);
                    imageCache.set(src, newImg);
                    resolve(newImg);
                };
                
                newImg.onerror = () => {
                    reject(new Error(`Failed to load image (attempt ${attempt}/${retries}): ${src}`));
                };
                
                newImg.src = src;
            });
            
            return img;
        } catch (error) {
            console.error(`Attempt ${attempt}/${retries} failed:`, error);
            
            if (attempt === retries) {
                console.error(`All attempts to load image failed: ${src}`);
                // Use fallback image if available
                const fallbackImage = '/static/images/card-back.png';
                if (src !== fallbackImage) {
                    console.log(`Attempting to use fallback image: ${fallbackImage}`);
                    return preloadImage(fallbackImage, 1);
                }
                throw error;
            }
            
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt - 1), 5000)));
        }
    }
}

async function preloadImages() {
    console.log('Starting batch image preload...');
    const loadedImages = new Set();
    const failedImages = new Set();
    const maxRetries = 3;
    
    try {
        // Clear existing cache
        clearImageCache();
        
        // Preload card back image first with retries
        console.log('Preloading card back image...');
        try {
            await preloadImageWithRetries(cardBackImage, maxRetries);
            loadedImages.add(cardBackImage);
        } catch (error) {
            console.error('Failed to load card back image:', error);
            failedImages.add(cardBackImage);
            // Use fallback if available
            if (cardBackImage !== '/static/images/card-back.png') {
                try {
                    await preloadImageWithRetries('/static/images/card-back.png', 1);
                } catch (fallbackError) {
                    console.error('Failed to load fallback card back image:', fallbackError);
                }
            }
        }
        
        // Preload all card front images with individual retries
        const preloadPromises = Object.entries(cardImageMap).map(async ([key, value]) => {
            const imagePath = `/static/images/${value}.png`;
            try {
                await preloadImageWithRetries(imagePath, maxRetries);
                loadedImages.add(imagePath);
                console.log(`Successfully preloaded: ${imagePath}`);
            } catch (error) {
                failedImages.add(imagePath);
                console.error(`Failed to preload card image after ${maxRetries} attempts: ${imagePath}`, error);
            }
        });
        
        await Promise.allSettled(preloadPromises);
        
        // Log preload results
        console.log('Image preload complete:');
        console.log(`Successfully loaded: ${loadedImages.size} images`);
        if (failedImages.size > 0) {
            console.warn(`Failed to load: ${failedImages.size} images`);
            failedImages.forEach(path => console.warn(`- ${path}`));
        }
        
        // Update status message based on preload results
        const statusMessage = document.getElementById('status-message');
        if (failedImages.size > 0) {
            statusMessage.textContent = '一部の画像の読み込みに失敗しました。ゲームは続行できます。';
            statusMessage.classList.add('alert-warning');
        } else {
            statusMessage.textContent = 'カードを2枚めくってください';
            statusMessage.classList.remove('alert-warning');
        }
        
    } catch (error) {
        console.error('Critical error during image preload:', error);
        const statusMessage = document.getElementById('status-message');
        statusMessage.textContent = '画像の読み込みに問題が発生しました。ページを更新してください。';
        statusMessage.classList.add('alert-warning');
    }
    
    return {
        success: loadedImages.size > 0,
        loaded: loadedImages.size,
        failed: failedImages.size,
        failedPaths: Array.from(failedImages)
    };
}

async function preloadImageWithRetries(src, maxRetries) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const img = await new Promise((resolve, reject) => {
                const newImg = new Image();
                
                newImg.onload = () => {
                    console.log(`Successfully loaded image on attempt ${attempt}: ${src}`);
                    imageCache.set(src, newImg);
                    resolve(newImg);
                };
                
                newImg.onerror = () => {
                    reject(new Error(`Failed to load image on attempt ${attempt}: ${src}`));
                };
                
                newImg.src = src;
            });
            
            return img;
        } catch (error) {
            lastError = error;
            console.warn(`Attempt ${attempt}/${maxRetries} failed for ${src}:`, error);
            
            if (attempt < maxRetries) {
                // Exponential backoff with jitter
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                const jitter = delay * 0.1 * Math.random();
                await new Promise(resolve => setTimeout(resolve, delay + jitter));
            }
        }
    }
    
    throw lastError;
}

// Initialize game board with error handling
async function initializeBoard() {
    console.log('Starting board initialization...');
    try {
        // Verify cardGrid exists
        const cardGrid = document.getElementById('card-grid');
        if (!cardGrid) {
            throw new Error('Card grid element not found');
        }
        
        // Clear existing cards
        cardGrid.innerHTML = '';
        console.log('Card grid cleared');

        // Create cards with proper error handling
        const cardValues = [];
        for (let i = 0; i < 44; i++) {
            cardValues.push(Math.floor(i / 2));
        }
        console.log(`Created card values array with ${cardValues.length} cards`);

        // Shuffle cards
        for (let i = cardValues.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cardValues[i], cardValues[j]] = [cardValues[j], cardValues[i]];
        }
        console.log('Card values shuffled');

        // Create and append cards
        for (let i = 0; i < cardValues.length; i++) {
            try {
                const card = createCard(i);
                card.setAttribute('data-value', cardValues[i]);
                cardGrid.appendChild(card);
                console.log(`Card ${i} created and appended successfully`);
            } catch (error) {
                console.error(`Error creating card ${i}:`, error);
                // Continue with other cards if one fails
                continue;
            }
        }

        console.log('Board initialization completed successfully');
        return true;
    } catch (error) {
        console.error('Critical error during board initialization:', error);
        const statusMessage = document.getElementById('status-message');
        if (statusMessage) {
            statusMessage.textContent = 'ゲームボードの初期化に失敗しました。ページを更新してください。';
            statusMessage.classList.add('alert-warning');
        }
        return false;
    }
}

// Initialize board when document is ready
document.addEventListener('DOMContentLoaded', async function() {
    try {
        await preloadImages();
        const boardInitialized = await initializeBoard();
        if (!boardInitialized) {
            throw new Error('Board initialization failed');
        }
        await initializeAudio();
        console.log('Game initialization completed successfully');
    } catch (error) {
        console.error('Game initialization failed:', error);
    }
});
document.addEventListener('DOMContentLoaded', async function() {
    // Constants
    const MIN_CLICK_INTERVAL = 200;
    const FLIP_ANIMATION_DURATION = 500;
    const MATCH_DISPLAY_DURATION = 1000;
    const MAX_RETRIES = 3;
    
    // Preload images before game starts
    await preloadImages();

    // DOM Elements
    const cardGrid = document.getElementById('card-grid');
    const newGameBtn = document.getElementById('new-game-btn');
    const playerScoreElement = document.getElementById('player-score');
    const statusMessage = document.getElementById('status-message');

    // Game state
    let isProcessing = false;
    let firstCardFlipped = false;
    let lastClickTime = 0;
    let gameStartTime = null;

    // Audio elements
    let cardFlipSound, matchSound, bgmPlayer;

    // Card image mapping
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

    // Initialize Panzoom elements
    const cardModal = document.getElementById('cardModal');
    const panzoomElement = document.querySelector('.panzoom');
    let panzoomInstance = null;

    // Show loading state for a card
    function showLoadingState(card, isLoading) {
        if (isLoading) {
            card.classList.add('loading');
        } else {
            card.classList.remove('loading');
        }
    }

    // Card flipping with improved preloading
    async function flipCard(card, value) {
        const backFace = card.querySelector('.card-back img');
        const imageName = cardImageMap[value];
        const imageUrl = `/static/images/${imageName}.png`;
        
        showLoadingState(card, true);
        
        try {
            // Use cached image if available or load it with retries
            let imageLoaded = false;
            if (imageCache.has(imageUrl)) {
                backFace.src = imageUrl;
                imageLoaded = true;
            } else {
                try {
                    await preloadImageWithRetries(imageUrl, 3);
                    backFace.src = imageUrl;
                    imageLoaded = true;
                } catch (error) {
                    console.error(`Failed to load card image: ${imageUrl}`, error);
                    backFace.src = '/static/images/card-back.png';
                }
            }
            
            card.classList.add('flipped');
            if (imageLoaded) {
                await playCardFlipSound();
            }
        
            // Add flip-complete class after animation finishes
            setTimeout(() => {
                card.classList.add('flip-complete');
            }, FLIP_ANIMATION_DURATION);
            
        } catch (error) {
            console.error('Error during card flip:', error);
            statusMessage.textContent = 'カードをめくる際にエラーが発生しました';
            statusMessage.classList.add('alert-warning');
        } finally {
            showLoadingState(card, false);
        }
    }

    // Load Panzoom dynamically
    const loadPanzoom = () => {
        return new Promise((resolve, reject) => {
            if (window.Panzoom) {
                resolve(window.Panzoom);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@panzoom/panzoom@4.5.1/dist/panzoom.min.js';
            script.onload = () => resolve(window.Panzoom);
            script.onerror = () => reject(new Error('Failed to load Panzoom'));
            document.head.appendChild(script);
        });
    };

    // Initialize audio elements
    async function initializeAudio() {
        console.log('Loading audio files...');
        try {
            cardFlipSound = document.getElementById('card-flip-sound');
            matchSound = document.getElementById('match-sound');
            bgmPlayer = document.getElementById('bgm-sound');

            console.log('Audio elements created:', {
                cardFlipSound: !!cardFlipSound,
                matchSound: !!matchSound,
                bgmPlayer: !!bgmPlayer
            });

            if (bgmPlayer) {
                bgmPlayer.volume = 0.1;
                const playPromise = bgmPlayer.play();
                if (playPromise) {
                    await playPromise;
                    console.log('BGM started successfully');
                }
            }
            console.log('Audio initialized successfully');
        } catch (error) {
            console.error('Audio initialization error:', error);
        }
    }

    async function playCardFlipSound() {
        if (cardFlipSound) {
            cardFlipSound.volume = 0.3;
            try {
                await cardFlipSound.play();
            } catch (error) {
                console.error('Error playing card flip sound:', error);
            }
        }
    }

    async function playMatchSound() {
        if (matchSound) {
            matchSound.volume = 0.3;
            try {
                await matchSound.play();
            } catch (error) {
                console.error('Error playing match sound:', error);
            }
        }
    }

    function cleanupAudio() {
        if (bgmPlayer) {
            bgmPlayer.pause();
            bgmPlayer.currentTime = 0;
        }
    }

    // Timer functions
    function startTimer() {
        if (!gameStartTime) {
            gameStartTime = Date.now();
            updateTimer();
        }
    }

    function stopTimer() {
        gameStartTime = null;
    }

    function updateTimer() {
        if (!gameStartTime) return;
        
        const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        document.getElementById('timer-display').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        requestAnimationFrame(updateTimer);
    }

    // Card creation and manipulation
    function createCard(index) {
        console.log(`Creating card with index: ${index}`);
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.setAttribute('data-index', index);
        
        // Add magnifying glass icon
        const magnifier = document.createElement('div');
        magnifier.className = 'magnifier';
        const magnifierImg = document.createElement('img');
        magnifierImg.src = '/static/images/拡大鏡.png';
        magnifierImg.alt = 'Magnify';
        magnifierImg.style.width = '100%';
        magnifierImg.style.height = '100%';
        magnifier.appendChild(magnifierImg);
        magnifier.addEventListener('click', (e) => {
            e.stopPropagation();
            showEnlargedCard(card);
        });
        card.appendChild(magnifier);
        
        const cardInner = document.createElement('div');
        cardInner.className = 'card-inner';
        
        const cardFront = document.createElement('div');
        cardFront.className = 'card-front';
        const frontImg = new Image();
        frontImg.src = imageCache.has(cardBackImage) ? cardBackImage : '/static/images/カード裏面.png';
        frontImg.alt = 'card back';
        frontImg.className = 'card-img';
        cardFront.appendChild(frontImg);
        
        const cardBack = document.createElement('div');
        cardBack.className = 'card-back';
        const backImg = document.createElement('img');
        backImg.alt = 'card front';
        backImg.className = 'card-img';
        cardBack.appendChild(backImg);
        
        cardInner.appendChild(cardFront);
        cardInner.appendChild(cardBack);
        card.appendChild(cardInner);

        // Add click event listener to each card
        card.addEventListener('click', function(e) {
            console.log(`Card clicked - index: ${index}, flipped: ${card.classList.contains('flipped')}`);
            handleCardClick(e);
        });
        
        console.log(`Card created successfully - index: ${index}`);
        return card;
    }

    // Initialize Panzoom when modal is shown
    cardModal.addEventListener('show.bs.modal', async function () {
        try {
            const panzoomContainer = document.querySelector('.panzoom-container');
            panzoomContainer.classList.add('loading');

            if (!panzoomInstance) {
                const Panzoom = await loadPanzoom();
                panzoomInstance = Panzoom(panzoomElement, {
                    maxScale: 5,
                    minScale: 0.5,
                    contain: 'outside',
                    step: 0.1
                });

                // Add mouse wheel zoom support
                panzoomElement.parentElement.addEventListener('wheel', function(event) {
                    if (!event.shiftKey) return;
                    event.preventDefault();
                    panzoomInstance.zoomWithWheel(event);
                    updateZoomLevel();
                });

                // Double-click to reset
                panzoomElement.addEventListener('dblclick', function() {
                    panzoomInstance.reset({ animate: true });
                    updateZoomLevel();
                });

                // Add zoom controls
                const zoomIn = document.querySelector('.zoom-in');
                const zoomOut = document.querySelector('.zoom-out');
                const zoomReset = document.querySelector('.zoom-reset');

                zoomIn.addEventListener('click', () => {
                    panzoomInstance.zoomIn({ animate: true });
                    updateZoomLevel();
                });

                zoomOut.addEventListener('click', () => {
                    panzoomInstance.zoomOut({ animate: true });
                    updateZoomLevel();
                });

                zoomReset.addEventListener('click', () => {
                    panzoomInstance.reset({ animate: true });
                    updateZoomLevel();
                });
            }

            // Update zoom level display
            function updateZoomLevel() {
                const scale = panzoomInstance.getScale();
                const percentage = Math.round(scale * 100);
                document.querySelector('.zoom-level').textContent = `${percentage}%`;
            }

            // Remove loading state when image is loaded
            const enlargedCard = document.getElementById('enlarged-card');
            enlargedCard.onload = () => {
                panzoomContainer.classList.remove('loading');
                updateZoomLevel();
            };

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

    // Card interaction handlers
    async function handleCardClick(event) {
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

        if (isProcessing || card.classList.contains('flipped')) return;

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
                    startTimer();
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

    // Card state updates
    async function flipCard(card, value) {
        const backFace = card.querySelector('.card-back img');
        const imageName = cardImageMap[value];
        const imageUrl = `/static/images/${imageName}.png`;
        
        try {
            // Use cached image if available or load it with retries
            let imageLoaded = false;
            if (imageCache.has(imageUrl)) {
                backFace.src = imageUrl;
                imageLoaded = true;
            } else {
                try {
                    await preloadImage(imageUrl);
                    backFace.src = imageUrl;
                    imageLoaded = true;
                } catch (error) {
                    console.error(`Failed to load card image: ${imageUrl}`, error);
                    // Use fallback image
                    backFace.src = '/static/images/card-back.png';
                }
            }
            
            card.classList.add('flipped');
            if (imageLoaded) {
                await playCardFlipSound();
            }
            
            // Add flip-complete class after animation finishes
            setTimeout(() => {
                card.classList.add('flip-complete');
            }, 500);
            
        } catch (error) {
            console.error('Error during card flip:', error);
            statusMessage.textContent = 'カードをめくる際にエラーが発生しました';
            statusMessage.classList.add('alert-warning');
        } finally {
            showLoadingState(card, false);
        }
    }
            card.classList.add('flip-complete');
        }, FLIP_ANIMATION_DURATION);
    }

    async function unflipCard(card) {
        card.classList.remove('flipped', 'flip-complete');
        await playCardFlipSound();
        setTimeout(() => {
            const backFace = card.querySelector('.card-back img');
            backFace.src = '';
        }, FLIP_ANIMATION_DURATION);
    }

    function markAsMatched(card) {
        card.classList.add('matched');
    }

    // UI updates
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

    // Network requests
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

    // Game initialization
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
            cleanupAudio();
            await initializeAudio();
        } catch (error) {
            statusMessage.textContent = '新しいゲームを開始できませんでした';
            statusMessage.classList.add('alert-danger');
        }
    }

    function initializeBoard() {
        console.log('Initializing game board...');
        if (!cardGrid) {
            console.error('Card grid element not found!');
            return;
        }

        // Clear existing cards
        while (cardGrid.firstChild) {
            cardGrid.removeChild(cardGrid.firstChild);
        }
        
        console.log('Creating new cards...');
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < 44; i++) {
            fragment.appendChild(createCard(i));
        }
        
        cardGrid.appendChild(fragment);
        console.log('Cards added to grid');

        // Reset game state
        firstCardFlipped = false;
        isProcessing = false;
        lastClickTime = 0;
        statusMessage.textContent = 'カードを2枚めくってください';
        statusMessage.classList.remove('alert-danger', 'alert-warning', 'game-clear');
        statusMessage.classList.add('alert-info');

        // Initialize Panzoom for matched cards
        const cardModal = document.getElementById('cardModal');
        if (cardModal) {
            console.log('Initializing Panzoom...');
            const panzoomElement = cardModal.querySelector('.panzoom');
            if (panzoomElement) {
                loadPanzoom().then(Panzoom => {
                    panzoomInstance = Panzoom(panzoomElement, {
                        maxScale: 5,
                        minScale: 0.5,
                        contain: 'outside'
                    });
                    console.log('Panzoom initialized successfully');
                }).catch(error => {
                    console.error('Failed to initialize Panzoom:', error);
                });
            }
        }

        console.log('Board initialization complete');
    }

    // Initialize game
    (async function initGame() {
        try {
            await initializeAudio();
        } catch (error) {
            console.error('Initialization error:', error);
        }
        
        newGameBtn.addEventListener('click', startNewGame);
        initializeBoard();
    })();
});