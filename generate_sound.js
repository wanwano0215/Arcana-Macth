import * as Tone from 'tone';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateSounds() {
    // Create audio context
    const audioContext = new Tone.Context();
    
    // Create card flip sound with metallic characteristics
    const cardFlipSynth = new Tone.MetalSynth({
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

    // Create match sound with pleasant harmonics
    const matchSynth = new Tone.PolySynth(Tone.Synth).toDestination();
    
    // Ensure directory exists
    if (!existsSync('static/sounds')) {
        mkdirSync('static/sounds', { recursive: true });
    }
    
    // Create recorder
    const recorder = new Tone.Recorder();
    
    // Record card flip sound
    cardFlipSynth.connect(recorder);
    await recorder.start();
    cardFlipSynth.triggerAttackRelease("C4", "32n");
    await new Promise(resolve => setTimeout(resolve, 500));
    const cardFlipBlob = await recorder.stop();
    writeFileSync('static/sounds/card_flip.mp3', Buffer.from(await cardFlipBlob.arrayBuffer()));
    
    // Record match sound
    matchSynth.connect(recorder);
    await recorder.start();
    matchSynth.triggerAttackRelease(["C4", "E4", "G4"], "8n");
    await new Promise(resolve => setTimeout(resolve, 1000));
    const matchBlob = await recorder.stop();
    writeFileSync('static/sounds/match.mp3', Buffer.from(await matchBlob.arrayBuffer()));
    
    // Cleanup
    cardFlipSynth.dispose();
    matchSynth.dispose();
    recorder.dispose();
    await audioContext.close();
}

generateSounds().then(() => {
    console.log('Sounds generated successfully');
    process.exit(0);
}).catch(err => {
    console.error('Error generating sounds:', err);
    process.exit(1);
});