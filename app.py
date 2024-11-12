import os
from flask import Flask, render_template, jsonify, session, send_from_directory, request
from flask_cors import CORS
from flask_session import Session
from game_logic import GameState
from datetime import datetime, timedelta
import logging
from werkzeug.middleware.proxy_fix import ProxyFix

# Initialize Flask app with explicit static folder
app = Flask(__name__, static_folder='static', static_url_path='/static')
CORS(app)

# Use ProxyFix to handle proxy headers correctly
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Configure logging with more detailed format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configure Flask-Session with filesystem storage
app.config.update(
    SECRET_KEY=os.environ.get("FLASK_SECRET_KEY", "memory-game-secret"),
    SESSION_TYPE='filesystem',
    SESSION_FILE_DIR=os.path.join(os.getcwd(), '.flask_session'),
    SESSION_PERMANENT=False,
    PERMANENT_SESSION_LIFETIME=timedelta(minutes=30),
    SESSION_USE_SIGNER=True,
    MAX_CONTENT_LENGTH=16 * 1024 * 1024,  # 16MB max request size
    SESSION_FILE_THRESHOLD=500  # Limit number of session files
)

# Ensure session directory exists
os.makedirs(app.config['SESSION_FILE_DIR'], exist_ok=True)
Session(app)

# Session recovery mechanism
def recover_session():
    """Attempt to recover or reinitialize session"""
    try:
        if 'id' not in session:
            session['id'] = os.urandom(16).hex()
            session.modified = True
        
        if 'game_state' not in session:
            game_state = GameState()
            session['game_state'] = game_state.to_dict()
            session.modified = True
            logger.info("Session recovered with new game state")
        return True
    except Exception as e:
        logger.error(f"Session recovery failed: {str(e)}", exc_info=True)
        return False

# Request logging middleware
@app.before_request
def log_request_info():
    logger.info(f'Request: {request.method} {request.url} from {request.remote_addr}')
    if not os.path.exists(app.config['SESSION_FILE_DIR']):
        os.makedirs(app.config['SESSION_FILE_DIR'], exist_ok=True)
    
    if not recover_session():
        return jsonify({'error': 'Session initialization failed'}), 500

@app.after_request
def after_request(response):
    logger.info(f'Response: {response.status} - Size: {response.content_length}')
    return response

# Error handlers
@app.errorhandler(404)
def not_found_error(error):
    logger.warning(f'404 Error: {request.url}')
    return jsonify({'error': 'Not found', 'message': 'リクエストされたページは存在しません'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f'500 Error: {str(error)}', exc_info=True)
    return jsonify({'error': 'Internal server error', 'message': 'サーバーエラーが発生しました'}), 500

@app.errorhandler(503)
def service_unavailable(error):
    logger.error(f'503 Error: {str(error)}')
    return jsonify({
        'error': 'Service temporarily unavailable',
        'message': 'サーバーが混雑しています。少々お待ちください。'
    }), 503

# Rate limiting
request_times = {}
RATE_LIMIT = 0.3  # Reduced from 1.0 to 0.3 seconds
CLEANUP_INTERVAL = 60  # Cleanup every minute

def cleanup_request_times():
    """Clean up old rate limiting entries"""
    global request_times
    current_time = datetime.now()
    cutoff_time = current_time - timedelta(seconds=CLEANUP_INTERVAL)
    request_times = {k: v for k, v in request_times.items() if v >= cutoff_time}

def rate_limit():
    """Rate limiting with improved cleanup and logging"""
    cleanup_request_times()
    current_time = datetime.now()
    session_key = str(session.get('id', os.urandom(16).hex()))
    
    if 'id' not in session:
        session['id'] = session_key
        session.modified = True
    
    last_request_time = request_times.get(session_key)
    
    if last_request_time:
        time_since_last = (current_time - last_request_time).total_seconds()
        if time_since_last < RATE_LIMIT:
            logger.warning(f'Rate limit exceeded: {time_since_last:.2f}s since last request')
            return True
    
    request_times[session_key] = current_time
    return False

@app.route('/')
def index():
    try:
        if not recover_session():
            return jsonify({'error': 'Failed to initialize session'}), 500
        
        logger.info("Index page loaded successfully")
        return render_template('index.html')
    except Exception as e:
        logger.error(f"Error in index route: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to initialize game', 'message': 'ゲームの初期化に失敗しました'}), 500

@app.route('/flip/<int:card_index>', methods=['POST'])
def flip_card(card_index):
    try:
        if rate_limit():
            return jsonify({
                'valid': False,
                'message': '操作が早すぎます。少し待ってから試してください。'
            }), 429

        if not recover_session():
            return jsonify({'error': 'Session recovery failed'}), 500

        game_state = GameState.from_dict(session['game_state'])
        result = game_state.process_player_move(card_index)
        session['game_state'] = game_state.to_dict()
        session.modified = True
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error processing flip: {str(e)}", exc_info=True)
        return jsonify({
            'valid': False,
            'message': 'エラーが発生しました。もう一度お試しください。'
        }), 500

@app.route('/new-game', methods=['POST'])
def new_game():
    try:
        if rate_limit():
            return jsonify({
                'success': False,
                'message': '操作が早すぎます。少し待ってから試してください。'
            }), 429

        game_state = GameState()
        session['game_state'] = game_state.to_dict()
        session.modified = True
        
        logger.info("New game created successfully")
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error creating new game: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': '新しいゲームの作成に失敗しました'
        }), 500

# Explicit static file handling
@app.route('/static/<path:filename>')
def serve_static(filename):
    if app.static_folder is None:
        return jsonify({'error': 'Static folder not configured'}), 500
    try:
        return send_from_directory(app.static_folder, filename)
    except Exception as e:
        logger.error(f"Error serving static file {filename}: {str(e)}")
        return jsonify({'error': 'Static file not found'}), 404

if __name__ == '__main__':
    app.run(debug=True)