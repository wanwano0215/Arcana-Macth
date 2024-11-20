// Simple Web Audio API sound generator
const fs = require('fs');
const { AudioContext, OfflineAudioContext } = require('node:web_audio_api');

async function generateCardFlipSound() {
    const sampleRate = 44100;
    const duration = 0.2;  // 200ms
    const ctx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);
    
    // Create oscillator for card flip sound
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, 0);
    osc.frequency.exponentialRampToValueAtTime(400, duration);
    
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(0.5, 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    
    // Render audio
    const audioBuffer = await ctx.startRendering();
    const wavData = audioBufferToWav(audioBuffer);
    
    // Ensure directory exists
    if (!fs.existsSync('static/sounds')) {
        fs.mkdirSync('static/sounds', { recursive: true });
    }
    
    // Save the sound
    fs.writeFileSync('static/sounds/card_flip.mp3', Buffer.from(wavData));
}

// Helper function to convert AudioBuffer to WAV format
function audioBufferToWav(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const data = new Float32Array(audioBuffer.length * numChannels);
    const channelData = [];
    for (let channel = 0; channel < numChannels; channel++) {
        channelData.push(audioBuffer.getChannelData(channel));
    }
    
    // Interleave channels
    for (let i = 0; i < audioBuffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            data[i * numChannels + channel] = channelData[channel][i];
        }
    }
    
    // Create WAV file
    const buffer = new ArrayBuffer(44 + data.length * 2);
    const view = new DataView(buffer);
    
    // Write WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + data.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, data.length * 2, true);
    
    // Write audio data
    const length = data.length;
    let index = 44;
    for (let i = 0; i < length; i++) {
        view.setInt16(index, data[i] * 0x7FFF, true);
        index += 2;
    }
    
    return new Uint8Array(buffer);
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// Generate sounds
generateCardFlipSound().then(() => {
    console.log('Card flip sound generated successfully');
}).catch(err => {
    console.error('Error generating sound:', err);
});
