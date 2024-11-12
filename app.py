import os
from flask import Flask, render_template, jsonify, session, send_from_directory
from flask_cors import CORS
from flask_session import Session
from game_logic import GameState

# Initialize Flask app with explicit static folder
app = Flask(__name__, static_folder='static', static_url_path='/static')
CORS(app)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "memory-game-secret")

# Configure Flask-Session
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_FILE_DIR'] = '.flask_session/'
Session(app)

@app.route('/')
def index():
    try:
        # Initialize new game state if not exists
        if 'game_state' not in session:
            game_state = GameState()
            session['game_state'] = game_state.to_dict()
            app.logger.info("New game state initialized")
        return render_template('index.html')
    except Exception as e:
        app.logger.error(f"Error in index route: {str(e)}")
        return jsonify({'error': 'Failed to initialize game'}), 500

@app.route('/flip/<int:card_index>', methods=['POST'])
def flip_card(card_index):
    try:
        if 'game_state' not in session:
            app.logger.warning("Session expired, creating new game state")
            game_state = GameState()
            session['game_state'] = game_state.to_dict()
            return jsonify({
                'valid': False,
                'message': 'Session expired. Starting new game.'
            })
            
        game_state = GameState.from_dict(session['game_state'])
        app.logger.debug(f"Processing move for card index: {card_index}")
        
        # Process player's move
        result = game_state.process_player_move(card_index)
        
        # Save updated game state
        session['game_state'] = game_state.to_dict()
        session.modified = True
        
        return jsonify(result)
    except Exception as e:
        app.logger.error(f"Error processing flip: {str(e)}")
        return jsonify({
            'valid': False,
            'message': 'An error occurred. Please try again.'
        }), 500

@app.route('/new-game', methods=['POST'])
def new_game():
    try:
        game_state = GameState()
        session['game_state'] = game_state.to_dict()
        session.modified = True
        app.logger.info("New game created successfully")
        return jsonify({'success': True})
    except Exception as e:
        app.logger.error(f"Error creating new game: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Failed to start new game'
        }), 500

if __name__ == '__main__':
    # Ensure all required directories exist
    os.makedirs('.flask_session', exist_ok=True)
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)
    
    # Start the Flask application
    app.run(host='0.0.0.0', port=5000, debug=True)
