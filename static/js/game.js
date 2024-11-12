document.addEventListener('DOMContentLoaded', function() {
    const cardGrid = document.getElementById('card-grid');
    const statusMessage = document.getElementById('status-message');
    const playerScoreElement = document.getElementById('player-score');
    const newGameBtn = document.getElementById('new-game-btn');

    let isProcessing = false;
    let firstCardFlipped = false;
    const MAX_RETRIES = 3;
    let lastClickTime = 0;
    const MIN_CLICK_INTERVAL = 300; // Minimum time between clicks in ms
    
    function createCard(index) {
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.setAttribute('data-index', index);
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-front"></div>
                <div class="card-back"></div>
            </div>
            <div class="loading-spinner"></div>
        `;
        return card;
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
        cardGrid.style.animation = 'none';
        document.querySelectorAll('.matched').forEach(card => {
            card.classList.remove('celebration');
        });
    }

    function flipCard(card, value) {
        card.classList.add('flipped');
        const cardBack = card.querySelector('.card-back');
        cardBack.textContent = value;
        
        // Add subtle transform effect
        card.style.transform = 'scale(1.02)';
        setTimeout(() => {
            card.style.transform = 'scale(1)';
        }, 300);
    }

    function unflipCard(card) {
        card.classList.remove('flipped');
        // Add smooth transition for unflip
        card.style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
    }

    function markAsMatched(card) {
        card.classList.add('matched');
        // Add match celebration effect
        card.style.animation = 'matchPulse 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
    }

    function updateScore(score) {
        if (playerScoreElement) {
            const oldScore = parseInt(playerScoreElement.textContent);
            playerScoreElement.textContent = score;
            
            if (score > oldScore) {
                playerScoreElement.classList.add('match-highlight');
                setTimeout(() => {
                    playerScoreElement.classList.remove('match-highlight');
                }, 1000);
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

    function handleRateLimitError(card, message) {
        card.classList.add('rate-limited');
        const originalBackground = statusMessage.style.background;
        
        statusMessage.textContent = message || '少々お待ちください...';
        statusMessage.classList.add('alert-warning');
        
        // Remove rate-limited class after animation
        setTimeout(() => {
            card.classList.remove('rate-limited');
            statusMessage.classList.remove('alert-warning');
            statusMessage.classList.add('alert-info');
            statusMessage.textContent = 'カードを2枚めくってください';
        }, 1000);
    }

    async function makeRequestWithRetry(url, options, retries = MAX_RETRIES) {
        let delay = 300;
        
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                if (response.ok) {
                    return await response.json();
                }
                
                if (response.status === 429) {
                    const data = await response.json();
                    if (i < retries - 1) {
                        await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 100));
                        delay *= 1.5; // Gentler backoff
                        continue;
                    }
                    throw new Error('Rate limit exceeded');
                }
                
                throw new Error(`HTTP error! status: ${response.status}`);
            } catch (error) {
                if (i === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 1.5;
            }
        }
        throw new Error('Max retries reached');
    }

    async function handleCardClick(event) {
        const currentTime = Date.now();
        if (currentTime - lastClickTime < MIN_CLICK_INTERVAL) {
            handleRateLimitError(event.target.closest('.memory-card'), '操作が早すぎます');
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
                await new Promise(resolve => setTimeout(resolve, 1000));

                if (data.turn_complete) {
                    if (data.is_match) {
                        const firstCard = document.querySelector(`[data-index="${data.first_card}"]`);
                        markAsMatched(card);
                        markAsMatched(firstCard);
                        updateScore(data.player_score);
                        
                        // Enhanced match animation
                        statusMessage.textContent = '🎉 Match! 🎉';
                        statusMessage.classList.add('match-highlight');
                        
                        card.classList.add('match-effect');
                        firstCard.classList.add('match-effect');
                        
                        setTimeout(() => {
                            statusMessage.classList.remove('match-highlight');
                            card.classList.remove('match-effect');
                            firstCard.classList.remove('match-effect');
                        }, 1500);
                    } else {
                        const firstCard = document.querySelector(`[data-index="${data.first_card}"]`);
                        await new Promise(resolve => setTimeout(resolve, 500));
                        unflipCard(card);
                        unflipCard(firstCard);
                        statusMessage.textContent = 'カードを2枚めくってください';
                    }

                    if (data.game_over) {
                        statusMessage.textContent = data.message;
                        statusMessage.classList.add('game-clear');
                        
                        // Enhanced game clear celebration
                        document.querySelectorAll('.matched').forEach(card => {
                            card.classList.add('celebration');
                        });
                        
                        cardGrid.style.animation = 'none';
                        cardGrid.offsetHeight; // Trigger reflow
                        cardGrid.style.animation = 'celebrationBorder 2s cubic-bezier(0.4, 0, 0.2, 1) infinite';
                    }
                }
            } else {
                handleRateLimitError(card, data.message);
            }
        } catch (error) {
            console.error('Error:', error.message);
            if (error.message === 'Rate limit exceeded') {
                handleRateLimitError(card, '操作が早すぎます');
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
            
            // Add animation for new game
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
