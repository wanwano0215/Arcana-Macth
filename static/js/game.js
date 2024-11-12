document.addEventListener('DOMContentLoaded', function() {
    const cardGrid = document.getElementById('card-grid');
    const statusMessage = document.getElementById('status-message');
    const playerScoreElement = document.getElementById('player-score');
    const newGameBtn = document.getElementById('new-game-btn');

    let isProcessing = false;
    let firstCardFlipped = false;
    
    function createCard(index) {
        const card = document.createElement('div');
        card.className = 'col-3 col-sm-2 col-md-1';
        card.innerHTML = `
            <div class="memory-card" data-index="${index}">
                <div class="card-inner">
                    <div class="card-front"></div>
                    <div class="card-back"></div>
                </div>
            </div>
        `;
        return card;
    }

    function initializeBoard() {
        cardGrid.innerHTML = '';
        for (let i = 0; i < 44; i++) {
            cardGrid.appendChild(createCard(i));
        }
        firstCardFlipped = false;
        statusMessage.textContent = '1枚目のカードを選んでください';
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

    function displayError(message) {
        statusMessage.textContent = message || 'エラーが発生しました。もう一度お試しください。';
        statusMessage.classList.remove('alert-info');
        statusMessage.classList.add('alert-danger');
        setTimeout(() => {
            statusMessage.classList.remove('alert-danger');
            statusMessage.classList.add('alert-info');
        }, 3000);
    }

    async function handleCardClick(event) {
        if (isProcessing) {
            return;
        }

        const card = event.target.closest('.memory-card');
        if (!card || card.classList.contains('flipped') || card.classList.contains('matched')) {
            return;
        }

        isProcessing = true;
        const cardIndex = parseInt(card.dataset.index);

        try {
            const response = await fetch(`/flip/${cardIndex}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.valid) {
                flipCard(card, data.card_value);
                statusMessage.textContent = data.message;

                if (!firstCardFlipped) {
                    firstCardFlipped = true;
                    isProcessing = false;
                    return;
                }

                firstCardFlipped = false;
                await new Promise(resolve => setTimeout(resolve, 1000));

                if (data.turn_complete) {
                    if (data.is_match) {
                        const firstCard = document.querySelector(`.memory-card[data-index="${data.first_card}"]`);
                        markAsMatched(card);
                        markAsMatched(firstCard);
                        updateScore(data.player_score);
                    } else {
                        const firstCard = document.querySelector(`.memory-card[data-index="${data.first_card}"]`);
                        await new Promise(resolve => setTimeout(resolve, 500));
                        unflipCard(card);
                        unflipCard(firstCard);
                    }

                    if (data.game_over) {
                        statusMessage.textContent = data.message;
                    } else {
                        statusMessage.textContent = '1枚目のカードを選んでください';
                    }
                }
            } else {
                displayError(data.message);
            }
        } catch (error) {
            console.error('Error:', error.message);
            displayError();
        } finally {
            isProcessing = false;
        }
    }

    function updateScore(playerScore) {
        playerScoreElement.textContent = playerScore;
    }

    async function startNewGame() {
        try {
            const response = await fetch('/new-game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            await response.json();
            initializeBoard();
            updateScore(0);
            statusMessage.textContent = '1枚目のカードを選んでください';
            statusMessage.classList.remove('alert-danger');
            statusMessage.classList.add('alert-info');
        } catch (error) {
            console.error('Error starting new game:', error.message);
            displayError('新しいゲームの開始に失敗しました');
        }
    }

    newGameBtn.addEventListener('click', startNewGame);
    cardGrid.addEventListener('click', handleCardClick);
    initializeBoard();
});
