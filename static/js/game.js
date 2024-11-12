document.addEventListener('DOMContentLoaded', function() {
    const cardGrid = document.getElementById('card-grid');
    const statusMessage = document.getElementById('status-message');
    const playerScoreElement = document.getElementById('player-score');
    const newGameBtn = document.getElementById('new-game-btn');

    let isProcessing = false;
    let firstCardFlipped = false;
    const MAX_RETRIES = 3;
    
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
        statusMessage.classList.remove('alert-danger', 'alert-warning');
        statusMessage.classList.add('alert-info');
    }

    function flipCard(card, value) {
        const cardBack = card.querySelector('.card-back');
        card.classList.add('flipped');
        cardBack.textContent = value;
    }

    function unflipCard(card) {
        card.classList.remove('flipped');
    }

    function markAsMatched(card) {
        card.classList.add('matched');
    }

    function updateScore(score) {
        const playerScoreElement = document.getElementById('player-score');
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

    function displayError(message, isRateLimit = false) {
        if (!isRateLimit) {
            statusMessage.textContent = message || 'エラーが発生しました。もう一度お試しください。';
            statusMessage.classList.add('alert-danger');
            setTimeout(() => {
                statusMessage.classList.remove('alert-danger');
                statusMessage.classList.add('alert-info');
                statusMessage.textContent = 'カードを2枚めくってください';
            }, 3000);
        }
    }

    async function makeRequestWithRetry(url, options, retries = MAX_RETRIES) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                if (response.ok) {
                    return await response.json();
                }
                if (response.status === 429) {
                    const data = await response.json();
                    // Don't show error message for rate limits
                    await new Promise(resolve => setTimeout(resolve, 300));
                    continue;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            } catch (error) {
                if (i === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        throw new Error('Max retries reached');
    }

    async function handleCardClick(event) {
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
                        statusMessage.classList.add('match-highlight');
                        setTimeout(() => {
                            statusMessage.classList.remove('match-highlight');
                        }, 1500);
                    } else {
                        const firstCard = document.querySelector(`[data-index="${data.first_card}"]`);
                        await new Promise(resolve => setTimeout(resolve, 500));
                        unflipCard(card);
                        unflipCard(firstCard);
                    }

                    if (data.game_over) {
                        statusMessage.textContent = data.message;
                    } else {
                        statusMessage.textContent = 'カードを2枚めくってください';
                    }
                }
            } else {
                displayError(data.message);
            }
        } catch (error) {
            console.error('Error:', error.message);
            if (error.message !== 'Rate limit exceeded') {
                displayError('通信エラーが発生しました。もう一度お試しください。');
            }
        } finally {
            isProcessing = false;
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
            statusMessage.classList.remove('alert-danger', 'alert-warning');
            statusMessage.classList.add('alert-info');
        } catch (error) {
            console.error('Error starting new game:', error.message);
            displayError('新しいゲームを開始できませんでした。もう一度お試しください。');
        }
    }

    newGameBtn.addEventListener('click', startNewGame);
    cardGrid.addEventListener('click', handleCardClick);
    initializeBoard();
});
