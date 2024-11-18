import numpy as np
from scipy.io import wavfile
import os

def generate_card_flip_sound():
    # Sound parameters
    sample_rate = 44100
    duration = 0.15
    t = np.linspace(0, duration, int(sample_rate * duration))
    
    # Generate a metallic sound for card flip
    frequency = 1000
    decay = np.exp(-7 * t)
    sound = np.sin(2 * np.pi * frequency * t) * decay
    
    # Add some high-frequency components for the "flip" effect
    sound += 0.5 * np.sin(4 * np.pi * frequency * t) * decay
    sound += 0.25 * np.sin(8 * np.pi * frequency * t) * decay
    
    # Normalize and convert to 16-bit PCM
    sound = np.int16(sound * 32767)
    
    # Ensure directory exists
    os.makedirs('static/sounds', exist_ok=True)
    
    # Save the sound
    wavfile.write('static/sounds/card_flip.wav', sample_rate, sound)

def generate_match_sound():
    # Sound parameters
    sample_rate = 44100
    duration = 0.3
    t = np.linspace(0, duration, int(sample_rate * duration))
    
    # Generate a pleasant chord for match sound
    frequencies = [440, 550, 660]  # A major chord
    sound = np.zeros_like(t)
    
    for freq in frequencies:
        decay = np.exp(-4 * t)
        sound += np.sin(2 * np.pi * freq * t) * decay
    
    # Normalize and convert to 16-bit PCM
    sound = np.int16(sound/len(frequencies) * 32767)
    
    # Save the sound
    wavfile.write('static/sounds/match.wav', sample_rate, sound)

if __name__ == '__main__':
    generate_card_flip_sound()
    generate_match_sound()
    print("Sound files generated successfully!")
