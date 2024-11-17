import * as Tone from 'tone';
import { writeFileSync } from 'fs';

async function generateCardFlipSound() {
    const synth = new Tone.Synth({
        oscillator: {
            type: "triangle"
        },
        envelope: {
            attack: 0.001,
            decay: 0.1,
            sustain: 0,
            release: 0.1
        }
    });

    const recorder = new Tone.Recorder();
    synth.connect(recorder);

    await recorder.start();
    synth.triggerAttackRelease("C6", "32n");
    await Tone.getContext().rawContext.suspend();

    const recording = await recorder.stop();
    const blob = new Blob([recording], { type: 'audio/mp3' });
    
    writeFileSync('static/sounds/card.mp3', Buffer.from(await blob.arrayBuffer()));
    
    synth.dispose();
    recorder.dispose();
}

generateCardFlipSound();
