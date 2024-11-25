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
    // Preload images in the background
    preloadImages().catch(console.error);
// キャッシュを保持する
const imageCache = new Map();

async function preloadImages() {
    console.log('Starting image preload...');
    const imageLoadTimes = new Map();
    
    try {
        const images = Object.entries(cardImageMap).map(([value, name]) => {
            const start = performance.now();
            const path = `/static/images/${name}.png`;
            imageLoadTimes.set(path, start);
            return { value, path };
        });

        for (const img of images) {
            try {
                await preloadSingleImage(img.path);
                const loadTime = performance.now() - imageLoadTimes.get(img.path);
                console.log(`Loaded ${img.path} in ${loadTime.toFixed(2)}ms`);
            } catch (error) {
                console.error(`Failed to load ${img.path}:`, error);
            }
        }
    
    // 優先度の設定
    function setPriority(cardValue) {
        const visibleCards = Array.from(document.querySelectorAll('.memory-card'))
            .filter(card => isElementInViewport(card));
        const cardIndex = visibleCards.findIndex(card => card.dataset.cardValue === cardValue);
        return cardIndex > -1 ? 1 : 0;
    }

    // 画像のバッファリング
    async function bufferImage(src, priority) {
        if (imageCache.has(src)) return imageCache.get(src);
        
        const img = new Image();
        const promise = new Promise((resolve, reject) => {
            img.onload = () => {
                loadedImages++;
                updateLoadingProgress(loadedImages);
                resolve(img);
            };
            img.onerror = reject;
        });
        
        img.src = src;
        imageCache.set(src, promise);
        loadPriority.set(src, priority);
        return promise;
    }

    // 画像の読み込み状況の更新
    function updateLoadingProgress(loaded) {
        const total = Object.keys(cardImageMap).length;
        const progress = Math.floor((loaded / total) * 100);
        console.log(`Loading progress: ${progress}%`);
    }

    // 表示されている要素かどうかの判定
    function isElementInViewport(el) {
        const rect = el.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth
        );
    }

    // メイン処理
    try {
        const cardBackImage = '/static/images/カード裏面.png';
        const magnifierImage = '/static/images/拡大鏡.png';

        // 重要な画像を先に読み込む
        await Promise.all([
            bufferImage(cardBackImage, 2),
            bufferImage(magnifierImage, 2)
        ]);

        // カード画像を非同期で読み込む
        const loadPromises = Object.entries(cardImageMap).map(([value, name]) => {
            const priority = setPriority(value);
            const imagePath = `/static/images/${name}.png`;
            return bufferImage(imagePath, priority);
        });

        // 優先度の高い画像から順に読み込む
        await Promise.all(loadPromises);

    return;  // 成功したら終了
            } catch (error) {
                console.error(`Attempt ${i + 1} failed:`, error);
                if (i === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000));  // 1秒待機
            }
        }
    } catch (error) {
        console.error('Image preloading failed:', error);
        statusMessage.textContent = '画像の読み込みに失敗しました。ページを更新してください。';
        statusMessage.classList.add('alert-danger');
    }
}

// 画像のプリロード関数を最適化
function preloadSingleImage(src) {
    if (imageCache.has(src)) {
        return Promise.resolve(src);
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            imageCache.set(src, true);
// Error handling functions
function handleError(error, context) {
    console.error(`Error in ${context}:`, error);
    
    // エラーの種類に基づいて対応
    if (error.name === 'NetworkError') {
        retryOperation(context);
    } else if (error.name === 'TimeoutError') {
        handleTimeout(context);
    } else {
        // その他のエラー
        showErrorMessage('予期せぬエラーが発生しました。');
    }
}

// リトライ処理
async function retryOperation(context, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await performOperation(context);
            return;
        } catch (error) {
            if (i === maxRetries - 1) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

// メモリ使用量の監視と最適化
const CACHE_SIZE_LIMIT = 50;

function cleanupCache() {
    if (imageCache.size > CACHE_SIZE_LIMIT) {
        const entriesToRemove = Array.from(imageCache.entries())
            .slice(0, Math.floor(CACHE_SIZE_LIMIT / 2));
        entriesToRemove.forEach(([key]) => imageCache.delete(key));
    }
}

// メモリ使用量のログ出力
setInterval(() => {
    if (performance && performance.memory) {
        console.log(`Memory usage: ${Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)}MB`);
    }
    cleanupCache();
}, 30000);
            resolve(src);
        };
        img.onerror = () => reject(src);
        img.src = src;
    });
}

// カード画像のプリロード
function preloadCardImage(cardValue) {
    const imagePath = `/static/images/${cardImageMap[cardValue]}.png`;
    return preloadSingleImage(imagePath);
}

    // Constants
    const MIN_CLICK_INTERVAL = 200;
    const FLIP_ANIMATION_DURATION = 500;
    const MATCH_DISPLAY_DURATION = 500; // Reduced from 1000 to 500 milliseconds
    const MAX_RETRIES = 3;

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

        if (bgmPlayer) {
            bgmPlayer.volume = 0.5;  // 音量を50%に変更
            bgmPlayer.loop = true;
            
            // ページ読み込み直後にBGM再生を試みる
            const playBGM = async () => {
                try {
                    await bgmPlayer.play();
                    console.log('BGM started successfully');
                } catch (error) {
                    console.warn('BGM autoplay failed:', error);
                }
            };

            // 即時実行
            playBGM();
            
            // 自動再生が失敗した場合のフォールバック
            document.addEventListener('click', async function initBGM() {
                if (bgmPlayer.paused) {
                    await playBGM();
                }
                document.removeEventListener('click', initBGM);
            }, { once: true });

            // バックグラウンド切り替え時の制御
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    bgmPlayer.pause();
                } else if (bgmPlayer.paused) {
                    bgmPlayer.play().catch(() => {});
                }
            });
        }
    } catch (error) {
        console.error('Audio initialization error:', error);
    }
}

// 初期化を即時実行
initializeAudio();

    async function playCardFlipSound() {
        if (cardFlipSound) {
            cardFlipSound.volume = 1.0;  // 音量を100%に変更
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
        const frontImg = document.createElement('img');
        frontImg.src = '/static/images/カード裏面.png';
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
                        // Keep the MATCH_DISPLAY_DURATION delay
                        await new Promise(resolve => setTimeout(resolve, MATCH_DISPLAY_DURATION));
                        // Make sure both cards are unflipped simultaneously
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
        backFace.src = `/static/images/${imageName}.png`;
        card.classList.add('flipped');
        await playCardFlipSound();
        
        // Add flip-complete class after animation finishes
        setTimeout(() => {
            card.classList.add('flip-complete');
        }, FLIP_ANIMATION_DURATION);
    }

    async function unflipCard(card) {
        // Remove flip-complete class first
        card.classList.remove('flip-complete');
        // Reduce the delay before removing flipped class
        setTimeout(() => {
            card.classList.remove('flipped');
        }, 25); // Reduced from 50 to 25 milliseconds
        
        await playCardFlipSound();
        
        // Reduce the animation duration for clearing the back image
        setTimeout(() => {
            const backFace = card.querySelector('.card-back img');
            backFace.src = '';
        }, 300); // Reduced from FLIP_ANIMATION_DURATION (500) to 300 milliseconds
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