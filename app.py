import os
import random
from flask import Flask, render_template, jsonify, session, send_from_directory, request
from flask_cors import CORS
from flask_session import Session
from game_logic import GameState
from sound_effects import init_sound_effects, SOUND_EFFECTS
from datetime import datetime, timedelta
import logging
from werkzeug.middleware.proxy_fix import ProxyFix

# Initialize Flask app
app = Flask(__name__)
app.config.update(
    STATIC_FOLDER='static',
    STATIC_URL_PATH='/static'
)
CORS(app)

# Use ProxyFix to handle proxy headers correctly
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Configure logging with more detailed format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configure Flask-Session with enhanced security and stability
app.config.update(
    SECRET_KEY=os.environ.get("FLASK_SECRET_KEY", "memory-game-secret"),
    SESSION_TYPE='filesystem',
    SESSION_FILE_DIR='.flask_session',
    SESSION_PERMANENT=False,
    PERMANENT_SESSION_LIFETIME=timedelta(minutes=30),
    SESSION_USE_SIGNER=True,
    SESSION_COOKIE_SECURE=False,  # Changed for local development compatibility
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    MAX_CONTENT_LENGTH=16 * 1024 * 1024,  # 16MB max request size
    SESSION_FILE_THRESHOLD=500,  # Limit number of session files
    SESSION_REFRESH_EACH_REQUEST=True,
    SEND_FILE_MAX_AGE_DEFAULT=43200,  # 12 hours cache for static files
    STATIC_FOLDER_PATH=os.path.join(os.getcwd(), 'static')
)

# Enhanced error handlers
@app.errorhandler(404)
def handle_404_error(error):
    logger.error(f"404 error occurred: {str(error)}")
    if request.path.startswith('/static/'):
        return jsonify({
            'valid': False,
            'message': '静的ファイルが見つかりませんでした'
        }), 404
    return jsonify({
        'valid': False,
        'message': 'ページが見つかりませんでした'
    }), 404

@app.errorhandler(500)
def handle_500_error(error):
    logger.error(f"500 error occurred: {str(error)}", exc_info=True)
    return jsonify({
        'valid': False,
        'message': 'サーバーエラーが発生しました'
    }), 500

# Configure logging for static file access
logging.getLogger('werkzeug').setLevel(logging.INFO)

@app.errorhandler(Exception)
def handle_error(error):
    logger.error(f"Unexpected error: {str(error)}", exc_info=True)
    return jsonify({
        'valid': False,
        'message': 'エラーが発生しました。もう一度お試しください。'
    }), 500

def initialize_session():
    """Initialize or recover session state"""
    if 'game_state' not in session:
        game_state = GameState()
        session['game_state'] = game_state.to_dict()
        session.modified = True
    return session['game_state']

@app.before_request
def before_request():
    # Ensure static directories exist
    if not os.path.exists(app.static_folder):
        os.makedirs(app.static_folder)
    if not os.path.exists(os.path.join(app.static_folder, 'images')):
        os.makedirs(os.path.join(app.static_folder, 'images'))
    
    # Initialize session
    if not session.get('id'):
        session['id'] = os.urandom(16).hex()
    initialize_session()

# Ensure session directory exists
os.makedirs(app.config['SESSION_FILE_DIR'], exist_ok=True)
# Initialize sound effects
init_sound_effects(app)
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

# Rate limiting
request_times = {}
RATE_LIMIT = 0.15  # Reduced from 0.2 to 0.15
BURST_LIMIT = 6   # Increased from 5 to 6
BURST_WINDOW = 2  # Within 2 seconds window
CLEANUP_INTERVAL = 60  # Cleanup every minute

def cleanup_request_times():
    """Clean up old rate limiting entries"""
    global request_times
    current_time = datetime.now()
    cutoff_time = current_time - timedelta(seconds=CLEANUP_INTERVAL)
    request_times = {k: {'times': [t for t in v['times'] if t >= cutoff_time]} 
                    for k, v in request_times.items() if v['times']}

def calculate_backoff(attempts):
    """Calculate exponential backoff time"""
    base_delay = 0.2  # Start with 200ms
    max_delay = 1.0   # Cap at 1 second
    backoff = min(base_delay * (1.2 ** attempts), max_delay)
    jitter = backoff * 0.1  # 10% jitter
    return backoff + (random.random() * jitter)

def rate_limit():
    """Rate limiting with burst allowance and exponential backoff"""
    cleanup_request_times()
    current_time = datetime.now()
    session_key = str(session.get('id', os.urandom(16).hex()))
    
    if 'id' not in session:
        session['id'] = session_key
        session.modified = True
    
    if session_key not in request_times:
        request_times[session_key] = {'times': [], 'attempts': 0}
    
    # Get recent requests within burst window
    recent_requests = [t for t in request_times[session_key]['times'] 
                      if (current_time - t).total_seconds() <= BURST_WINDOW]
    
    if recent_requests:
        # Check if within burst limit
        if len(recent_requests) >= BURST_LIMIT:
            # Check time since oldest request in burst
            time_since_last = (current_time - recent_requests[-1]).total_seconds()
            if time_since_last < RATE_LIMIT:
                # Increment attempts for exponential backoff
                request_times[session_key]['attempts'] += 1
                backoff_time = calculate_backoff(request_times[session_key]['attempts'])
                logger.warning(f'Rate limit exceeded: {time_since_last:.2f}s since last request, backing off for {backoff_time:.2f}s')
                return True, backoff_time
    
    # Reset attempts on successful request
    request_times[session_key]['attempts'] = 0
    request_times[session_key]['times'].append(current_time)
    return False, 0

@app.after_request
def add_header(response):
    """Add caching headers to responses"""
    if request.path.startswith('/static/'):
        # 静的ファイルのキャッシュを1週間に設定
        response.headers['Cache-Control'] = 'public, max-age=604800'
    return response

@app.route('/')
def index():
    try:
        if not recover_session():
            return jsonify({'error': 'Failed to initialize session'}), 500
        
        logger.info("Game page loaded successfully")
        return render_template('game.html')
    except Exception as e:
        logger.error(f"Error in index route: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to initialize game'}), 500

@app.route('/flip/<int:card_index>', methods=['POST'])
def flip_card(card_index):
    try:
        is_rate_limited, backoff_time = rate_limit()
        if is_rate_limited:
            return jsonify({
                'valid': False,
                'message': '操作が早すぎます。少し待ってから試してください。',
                'backoff': backoff_time
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
        is_rate_limited, backoff_time = rate_limit()
        if is_rate_limited:
            return jsonify({
                'success': False,
                'message': '操作が早すぎます。少し待ってから試してください。',
                'backoff': backoff_time
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
    try:
        return send_from_directory('static', filename)
    except Exception as e:
        logger.error(f"Error serving static file {filename}: {str(e)}")
        return jsonify({'error': 'Static file not found'}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
