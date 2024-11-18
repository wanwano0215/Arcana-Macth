import * as Tone from 'tone';
import { writeFileSync } from 'fs';

async function generateCardFlipSound() {
    // Create a synth with metallic characteristics
    const synth = new Tone.MetalSynth({
        frequency: 200,
        envelope: {
            attack: 0.001,
            decay: 0.1,
            release: 0.1
        },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5
    }).toDestination();

    const reverb = new Tone.Reverb({
        decay: 0.5,
        wet: 0.2
    }).toDestination();

    synth.connect(reverb);
    
    // Create a recorder
    const recorder = new Tone.Recorder();
    synth.connect(recorder);

    // Start recording and play the sound
    await recorder.start();
    synth.triggerAttackRelease("C4", "32n");
    
    // Wait for the sound to finish
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Stop recording and get the audio
    const recording = await recorder.stop();
    const audioBlob = new Blob([await recording.arrayBuffer()], { type: 'audio/mp3' });
    const buffer = Buffer.from(await audioBlob.arrayBuffer());
    
    // Ensure directory exists
    const fs = require('fs');
    if (!fs.existsSync('./static/sounds')) {
        fs.mkdirSync('./static/sounds', { recursive: true });
    }
    
    // Save the file
    writeFileSync('static/sounds/card_flip.mp3', buffer);
    
    // Cleanup
    synth.dispose();
    reverb.dispose();
    recorder.dispose();
}

generateCardFlipSound().then(() => {
    console.log('Card flip sound generated successfully');
    process.exit(0);
}).catch(err => {
    console.error('Error generating sound:', err);
    process.exit(1);
});
