from app import app
import os
import logging
import shutil
from datetime import datetime

def setup_directories():
    """Ensure all required directories exist"""
    directories = [
        '.flask_session',
        'static/css',
        'static/js',
        'templates'
    ]
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        # Ensure directory has proper permissions
        os.chmod(directory, 0o755)

def setup_logging():
    """Configure logging"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

def cleanup_session_files():
    """Clean up old session files and recreate session directory"""
    session_dir = os.path.join(os.getcwd(), '.flask_session')
    try:
        if os.path.exists(session_dir):
            shutil.rmtree(session_dir)
        os.makedirs(session_dir, exist_ok=True)
        os.chmod(session_dir, 0o755)
    except Exception as e:
        logging.error(f"Error cleaning up session files: {e}")

if __name__ == "__main__":
    try:
        setup_logging()
        setup_directories()
        cleanup_session_files()
        
        app.run(
            host='0.0.0.0',
            port=5000,
            debug=False,
            threaded=True,
            use_reloader=False
        )
    except Exception as e:
        logging.error(f"Application startup error: {e}")
