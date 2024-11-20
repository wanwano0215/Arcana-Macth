const { Context, Recorder, MetalSynth, PolySynth, Synth } = require('tone');
const { writeFileSync, mkdirSync, existsSync } = require('fs');

async function generateSounds() {
    // Create audio context
    const context = new Context();
    
    // Ensure directory exists
    if (!existsSync('static/sounds')) {
        mkdirSync('static/sounds', { recursive: true });
    }
    
    // Create recorder
    const recorder = new Recorder();
    
    // Generate card flip sound
    const cardFlipSynth = new MetalSynth({
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
    }).connect(recorder);

    // Record card flip sound
    await recorder.start();
    cardFlipSynth.triggerAttackRelease("C4", "32n");
    await new Promise(resolve => setTimeout(resolve, 500));
    const cardFlipBlob = await recorder.stop();
    writeFileSync('static/sounds/card_flip.mp3', Buffer.from(await cardFlipBlob.arrayBuffer()));
    
    // Generate match sound
    const matchSynth = new PolySynth(Synth).connect(recorder);
    await recorder.start();
    matchSynth.triggerAttackRelease(["C4", "E4", "G4"], "8n");
    await new Promise(resolve => setTimeout(resolve, 1000));
    const matchBlob = await recorder.stop();
    writeFileSync('static/sounds/match.mp3', Buffer.from(await matchBlob.arrayBuffer()));
    
    // Generate BGM
    const bgmSynth = new PolySynth(Synth).connect(recorder);
    const notes = ["C4", "E4", "G4", "B4"];
    await recorder.start();
    
    for (let i = 0; i < 4; i++) {
        notes.forEach((note, index) => {
            bgmSynth.triggerAttackRelease(note, "8n", context.now() + (i * 2) + (index * 0.5));
        });
    }
    
    await new Promise(resolve => setTimeout(resolve, 8000));
    const bgmBlob = await recorder.stop();
    writeFileSync('static/sounds/BGM.mp3', Buffer.from(await bgmBlob.arrayBuffer()));
    
    // Cleanup
    cardFlipSynth.dispose();
    matchSynth.dispose();
    bgmSynth.dispose();
    recorder.dispose();
    await context.close();
}

generateSounds().then(() => {
    console.log('Sounds generated successfully');
    process.exit(0);
}).catch(err => {
    console.error('Error generating sounds:', err);
    process.exit(1);
});
