document.addEventListener('DOMContentLoaded', function() {
    const cardGrid = document.getElementById('card-grid');
    const statusMessage = document.getElementById('status-message');
    const playerScoreElement = document.getElementById('player-score');
    const cpuScoreElement = document.getElementById('cpu-score');
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
            const response = await fetch(`/flip/${cardIndex}`);
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
                        updateScores(data.player_score, data.cpu_score);
                    } else {
                        const firstCard = document.querySelector(`.memory-card[data-index="${data.first_card}"]`);
                        await new Promise(resolve => setTimeout(resolve, 500));
                        unflipCard(card);
                        unflipCard(firstCard);
                    }

                    // Handle CPU's turn
                    if (data.cpu_moves) {
                        statusMessage.textContent = 'CPUの番です';
                        await processCPUMoves(data.cpu_moves, data.cpu_match);
                        updateScores(data.player_score, data.cpu_score);
                        statusMessage.textContent = '1枚目のカードを選んでください';
                    }
                }
            } else {
                statusMessage.textContent = data.message;
            }
        } catch (error) {
            console.error('Error:', error);
            statusMessage.textContent = 'エラーが発生しました';
        } finally {
            isProcessing = false;
        }
    }

    async function processCPUMoves(moves, isMatch) {
        for (const move of moves) {
            const card = document.querySelector(`.memory-card[data-index="${move.index}"]`);
            await new Promise(resolve => setTimeout(resolve, 500));
            flipCard(card, move.value);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!isMatch) {
            for (const move of moves) {
                const card = document.querySelector(`.memory-card[data-index="${move.index}"]`);
                unflipCard(card);
            }
        } else {
            for (const move of moves) {
                const card = document.querySelector(`.memory-card[data-index="${move.index}"]`);
                markAsMatched(card);
            }
        }
    }

    function updateScores(playerScore, cpuScore) {
        playerScoreElement.textContent = playerScore;
        cpuScoreElement.textContent = cpuScore;
    }

    newGameBtn.addEventListener('click', async () => {
        try {
            await fetch('/new-game');
            initializeBoard();
            updateScores(0, 0);
            statusMessage.textContent = '1枚目のカードを選んでください';
        } catch (error) {
            console.error('Error starting new game:', error);
        }
    });

    cardGrid.addEventListener('click', handleCardClick);
    initializeBoard();
});
