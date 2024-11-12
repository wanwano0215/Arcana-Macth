import os
from flask import Flask, render_template, jsonify, session
from game_logic import GameState

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or "memory-game-secret"

@app.route('/')
def index():
    # Initialize new game state
    game_state = GameState()
    session['game_state'] = game_state.to_dict()
    return render_template('index.html')

@app.route('/flip/<int:card_index>')
def flip_card(card_index):
    game_state = GameState.from_dict(session['game_state'])
    
    # Process player's move
    result = game_state.process_player_move(card_index)
    
    # If player's turn is complete, let CPU play
    if result.get('turn_complete', False):
        cpu_result = game_state.cpu_play()
        result.update(cpu_result)
    
    # Save updated game state
    session['game_state'] = game_state.to_dict()
    
    return jsonify(result)

@app.route('/new-game')
def new_game():
    game_state = GameState()
    session['game_state'] = game_state.to_dict()
    return jsonify({'success': True})
