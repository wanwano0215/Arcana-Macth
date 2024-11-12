import os
from flask import Flask, render_template, jsonify, session, send_from_directory
from flask_cors import CORS
from flask_session import Session
from game_logic import GameState
from datetime import datetime, timedelta

# Initialize Flask app with explicit static folder
app = Flask(__name__, static_folder='static', static_url_path='/static')
CORS(app)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "memory-game-secret")

# Configure Flask-Session with more robust settings
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_FILE_DIR'] = '.flask_session/'
app.config['SESSION_PERMANENT'] = False
app.config['PERMANENT_SESSION_LIFETIME'] = 1800  # 30 minutes
app.config['SESSION_USE_SIGNER'] = True
Session(app)

# Rate limiting
request_times = {}
RATE_LIMIT = 0.3  # Increased minimum time between requests
CLEANUP_INTERVAL = 300  # Clean up every 5 minutes
last_cleanup = datetime.now()

def cleanup_request_times():
    """Clean up old rate limiting entries"""
    global last_cleanup
    current_time = datetime.now()
    if (current_time - last_cleanup).total_seconds() > CLEANUP_INTERVAL:
        cutoff_time = current_time - timedelta(seconds=CLEANUP_INTERVAL)
        for key in list(request_times.keys()):
            if request_times[key] < cutoff_time:
                del request_times[key]
        last_cleanup = current_time

def rate_limit():
    current_time = datetime.now()
    session_key = str(session.get('id', os.urandom(16).hex()))
    if 'id' not in session:
        session['id'] = session_key
        session.modified = True
    
    last_request_time = request_times.get(session_key)
    
    if last_request_time and (current_time - last_request_time) < timedelta(seconds=RATE_LIMIT):
        return True
    
    request_times[session_key] = current_time
    return False

def validate_session():
    """Check if session is valid and initialize if needed"""
    if 'id' not in session or 'game_state' not in session:
        session.clear()
        session['id'] = os.urandom(16).hex()
        game_state = GameState()
        session['game_state'] = game_state.to_dict()
        session.modified = True
        return False
    return True

@app.route('/')
def index():
    try:
        session.permanent = True
        validate_session()
        return render_template('index.html')
    except Exception as e:
        app.logger.error(f"Error in index route: {str(e)}")
        return jsonify({'error': 'Failed to initialize game'}), 500

@app.route('/flip/<int:card_index>', methods=['POST'])
def flip_card(card_index):
    try:
        session.permanent = True
        
        # Rate limiting check with proper error response
        if rate_limit():
            return jsonify({
                'valid': False,
                'message': '操作が早すぎます。少し待ってから試してください。'
            }), 429

        # Validate session and reinitialize if invalid
        if not validate_session():
            return jsonify({
                'valid': False,
                'message': '新しいゲームを開始します'
            })

        # Ensure session directory exists
        os.makedirs('.flask_session', exist_ok=True)
            
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
        # Create new game state if there's an error
        session.clear()
        session['id'] = os.urandom(16).hex()
        game_state = GameState()
        session['game_state'] = game_state.to_dict()
        session.modified = True
        return jsonify({
            'valid': False,
            'message': 'エラーが発生しました。新しいゲームを開始します。'
        })

@app.route('/new-game', methods=['POST'])
def new_game():
    try:
        session.permanent = True
        
        # Rate limiting check with proper error response
        if rate_limit():
            return jsonify({
                'success': False,
                'message': '操作が早すぎます。少し待ってから試してください。'
            }), 429

        session.clear()
        session['id'] = os.urandom(16).hex()
        game_state = GameState()
        session['game_state'] = game_state.to_dict()
        session.modified = True
        
        app.logger.info("New game created successfully")
        return jsonify({'success': True})
    except Exception as e:
        app.logger.error(f"Error creating new game: {str(e)}")
        session.clear()
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
