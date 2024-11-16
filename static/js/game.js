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
    const FLIP_ANIMATION_DURATION = 600; // Increased for smoother animation
    const MATCH_DISPLAY_DURATION = 1000;
    
    // Initialize fabric canvas for each card
    const cardCanvases = new Map();
    
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
        21: '21世界',
        22: '6-1恋人'
    };

    let preloadedImages = {};

    const preloadImages = async () => {
        const imagePromises = Object.values(cardImageMap).map(imageName => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    preloadedImages[imageName] = img;
                    resolve(img);
                };
                img.onerror = () => {
                    console.error(`Failed to load image: ${imageName}`);
                    reject(new Error(`Failed to load image: ${imageName}`));
                };
                img.src = `/static/images/${imageName}.png`;
            });
        });
        
        // Preload card back
        imagePromises.push(new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                preloadedImages['カード裏面'] = img;
                resolve(img);
            };
            img.onerror = () => {
                console.error('Failed to load card back image');
                reject(new Error('Failed to load card back image'));
            };
            img.src = '/static/images/カード裏面.png';
        }));
        
        try {
            await Promise.all(imagePromises);
            console.log('Images preloaded and cached');
            return preloadedImages;
        } catch (error) {
            console.error('Error preloading images:', error);
            throw error;
        }
    };

    function createCardCanvas(card) {
        const canvas = new fabric.Canvas(card.querySelector('canvas'), {
            width: card.offsetWidth,
            height: card.offsetHeight,
            selection: false,
            renderOnAddRemove: true,
        });
        
        // Initialize with card back
        fabric.Image.fromURL('/static/images/カード裏面.png', img => {
            img.scaleToWidth(canvas.width);
            canvas.add(img);
            canvas.renderAll();
        });
        
        return canvas;
    }
    
    function createCard(index) {
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.setAttribute('data-index', index);
        card.innerHTML = `
            <canvas class="card-canvas"></canvas>
            <div class="card-inner">
                <div class="card-front">
                    <img src="/static/images/カード裏面.png" alt="card back" class="card-img">
                </div>
                <div class="card-back">
                    <img class="card-img" alt="card front">
                </div>
            </div>
        `;
        
        // Initialize Fabric.js canvas for this card
        const canvas = createCardCanvas(card);
        cardCanvases.set(index, canvas);
        
        return card;
    }

    function animateFlip(card, value, duration = FLIP_ANIMATION_DURATION) {
        return new Promise(resolve => {
            const canvas = cardCanvases.get(parseInt(card.dataset.index));
            const imageName = cardImageMap[value] || `${value}愚者`;
            
            // Create flip animation
            fabric.Image.fromURL(`/static/images/${imageName}.png`, img => {
                img.scaleToWidth(canvas.width);
                
                // First half of flip
                fabric.util.animate({
                    startValue: 0,
                    endValue: -90,
                    duration: duration / 2,
                    onChange: (value) => {
                        canvas.clear();
                        canvas.add(img);
                        img.set('skewY', value);
                        canvas.renderAll();
                    },
                    onComplete: () => {
                        // Second half of flip
                        fabric.util.animate({
                            startValue: 90,
                            endValue: 0,
                            duration: duration / 2,
                            onChange: (value) => {
                                canvas.clear();
                                canvas.add(img);
                                img.set('skewY', value);
                                canvas.renderAll();
                            },
                            onComplete: resolve
                        });
                    }
                });
            });
        });
    }

    async function flipCard(card, value) {
        card.classList.add('flipped');
        await animateFlip(card, value);
    }

    async function unflipCard(card) {
        card.classList.remove('flipped');
        const canvas = cardCanvases.get(parseInt(card.dataset.index));
        
        // Animate back to card back
        await new Promise(resolve => {
            fabric.Image.fromURL('/static/images/カード裏面.png', img => {
                img.scaleToWidth(canvas.width);
                canvas.clear();
                canvas.add(img);
                canvas.renderAll();
                resolve();
            });
        });
    }

    function markAsMatched(card) {
        card.classList.add('matched');
        const canvas = cardCanvases.get(parseInt(card.dataset.index));
        
        // Add glow effect to matched cards
        canvas.backgroundColor = 'rgba(76, 175, 80, 0.1)';
        canvas.renderAll();
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
                console.warn('Attempt ' + attempt + ' failed:', error.message);
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
            console.error('Error:', error.message);
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
            console.error('Error starting new game:', error.message);
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

    // Preload images before starting the game
    try {
        await preloadImages();
        console.log('Images preloaded successfully');
    } catch (error) {
        console.warn('Error preloading images:', error);
    }

    newGameBtn.addEventListener('click', startNewGame);
    cardGrid.addEventListener('click', handleCardClick);
    initializeBoard();
});
