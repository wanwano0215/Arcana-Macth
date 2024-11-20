#!/bin/bash

# Create sounds directory if it doesn't exist
mkdir -p static/sounds

# Generate card flip sound (short beep with fade)
ffmpeg -f lavfi -i "sine=frequency=800:duration=0.15" -af "afade=t=in:st=0:d=0.05,afade=t=out:st=0.1:d=0.05,volume=0.5" -y static/sounds/card_flip.mp3

# Generate match sound (success sound)
ffmpeg -f lavfi -i "sine=frequency=600:duration=0.3" -af "afade=t=in:st=0:d=0.05,afade=t=out:st=0.25:d=0.05,volume=0.3" -y static/sounds/match.mp3

# Generate background music (simple loop)
ffmpeg -f lavfi -i "sine=frequency=440:duration=4" -af "volume=0.2" -y static/sounds/BGM.mp3
