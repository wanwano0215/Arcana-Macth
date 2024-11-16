document.addEventListener('DOMContentLoaded', function() {
    const cardGrid = document.getElementById('card-grid');
    const statusMessage = document.getElementById('status-message');
    const playerScoreElement = document.getElementById('player-score');
    const newGameBtn = document.getElementById('new-game-btn');

    let isProcessing = false;
    let firstCardFlipped = false;
    const MAX_RETRIES = 3;
    let lastClickTime = 0;
    const MIN_CLICK_INTERVAL = 200;  // Reduced from 300ms to 200ms
    const FLIP_ANIMATION_DURATION = 400; // ms
    const MATCH_DISPLAY_DURATION = 800; // ms
    
    function createCard(index) {
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.setAttribute('data-index', index);
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-front">
                    <img src="/static/images/card-back.png" alt="card back">
                </div>
                <div class="card-back">
                    <img class="card-image" alt="card">
                </div>
            </div>
            <div class="loading-spinner"></div>
        `;
        return card;
    }

    function initializeBoard() {
        cardGrid.innerHTML = '';
        for (let i = 0; i < 26; i++) {  // 13 pairs = 26 cards
            cardGrid.appendChild(createCard(i));
        }
        firstCardFlipped = false;
        statusMessage.textContent = 'カードを2枚めくってください';
        statusMessage.classList.remove('alert-danger', 'alert-warning', 'game-clear');
        statusMessage.classList.add('alert-info');
        cardGrid.style.animation = 'none';
        document.querySelectorAll('.matched').forEach(card => {
            card.classList.remove('celebration');
        });
    }

    function flipCard(card, value) {
        card.classList.add('flipped');
        const cardImage = card.querySelector('.card-back .card-image');
        // Preload image before showing
        const img = new Image();
        img.onload = () => {
            cardImage.src = `/static/images/${value}.png`;
            card.style.transform = 'scale(1.02)';
            setTimeout(() => {
                card.style.transform = 'scale(1)';
            }, FLIP_ANIMATION_DURATION / 2);
        };
        img.src = `/static/images/${value}.png`;
    }

    function unflipCard(card) {
        card.classList.remove('flipped');
        const cardImage = card.querySelector('.card-back .card-image');
        cardImage.src = '';
        card.style.transition = `transform ${FLIP_ANIMATION_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    }

    function markAsMatched(card) {
        card.classList.add('matched');
        card.style.animation = `matchPulse ${MATCH_DISPLAY_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    }

    function updateScore(score) {
        if (playerScoreElement) {
            const oldScore = parseInt(playerScoreElement.textContent);
            playerScoreElement.textContent = score;
            
            if (score > oldScore) {
                playerScoreElement.classList.add('match-highlight');
                setTimeout(() => {
                    playerScoreElement.classList.remove('match-highlight');
                }, MATCH_DISPLAY_DURATION);
            }
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
        let delay = 200; // Start with 200ms instead of 500ms
        
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
                        delay *= 1.2; // Gentler backoff (1.2 instead of 1.5)
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

        if (isProcessing) {
            return;
        }

        const card = event.target.closest('.memory-card');
        if (!card || 
            card.classList.contains('flipped') || 
            card.classList.contains('matched')) {
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
                flipCard(card, data.card_value);
                if (!firstCardFlipped) {
                    firstCardFlipped = true;
                    statusMessage.textContent = data.message;
                    return;
                }

                firstCardFlipped = false;
                await new Promise(resolve => setTimeout(resolve, MATCH_DISPLAY_DURATION));

                if (data.turn_complete) {
                    if (data.is_match) {
                        const firstCard = document.querySelector(`[data-index="${data.first_card}"]`);
                        markAsMatched(card);
                        markAsMatched(firstCard);
                        updateScore(data.player_score);
                        
                        statusMessage.textContent = '🎉 Match! 🎉';
                        statusMessage.classList.add('match-highlight');
                        
                        setTimeout(() => {
                            statusMessage.classList.remove('match-highlight');
                        }, MATCH_DISPLAY_DURATION);
                    } else {
                        const firstCard = document.querySelector(`[data-index="${data.first_card}"]`);
                        await new Promise(resolve => setTimeout(resolve, FLIP_ANIMATION_DURATION));
                        unflipCard(card);
                        unflipCard(firstCard);
                        statusMessage.textContent = 'カードを2枚めくってください';
                    }

                    if (data.game_over) {
                        statusMessage.textContent = data.message;
                        statusMessage.classList.add('game-clear');
                        
                        document.querySelectorAll('.matched').forEach(card => {
                            card.classList.add('celebration');
                        });
                        
                        cardGrid.style.animation = 'none';
                        cardGrid.offsetHeight;
                        cardGrid.style.animation = 'celebrationBorder 2s cubic-bezier(0.4, 0, 0.2, 1) infinite';
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
            
            cardGrid.style.animation = 'none';
            cardGrid.offsetHeight;
            cardGrid.style.animation = 'fadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            
            statusMessage.textContent = 'カードを2枚めくってください';
            statusMessage.classList.remove('alert-danger', 'alert-warning', 'game-clear');
            statusMessage.classList.add('alert-info');
        } catch (error) {
            console.error('Error starting new game:', error.message);
            statusMessage.textContent = '新しいゲームを開始できませんでした';
            statusMessage.classList.add('alert-danger');
        }
    }

    newGameBtn.addEventListener('click', startNewGame);
    cardGrid.addEventListener('click', handleCardClick);
    initializeBoard();
});
