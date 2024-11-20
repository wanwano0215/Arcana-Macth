import os
from flask import send_from_directory

def init_sound_effects(app):
    # Ensure the sounds directory exists
    os.makedirs('static/sounds', exist_ok=True)
    
    # Register sound routes
    @app.route('/sounds/<filename>')
    def serve_sound(filename):
        return send_from_directory('static/sounds', filename)

# List of available sound effects
SOUND_EFFECTS = {
    'card_flip': 'card_flip.mp3',
    'match': 'match.mp3',
    'bgm': 'BGM.mp3'
}
