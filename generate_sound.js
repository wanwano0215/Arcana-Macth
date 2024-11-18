const Tone = require('tone');
const fs = require('fs');

async function generateSounds() {
    // Create audio context
    const audioContext = new (Tone.Context)();
    
    // Create card flip sound
    const cardFlipOsc = new Tone.Oscillator({
        type: 'triangle',
        frequency: 800,
    }).toDestination();
    
    const cardFlipEnv = new Tone.AmplitudeEnvelope({
        attack: 0.01,
        decay: 0.1,
        sustain: 0,
        release: 0.1
    }).toDestination();
    
    cardFlipOsc.connect(cardFlipEnv);
    
    // Create match sound
    const matchOsc1 = new Tone.Oscillator({
        type: 'sine',
        frequency: 600,
    }).toDestination();
    
    const matchOsc2 = new Tone.Oscillator({
        type: 'sine',
        frequency: 800,
    }).toDestination();
    
    const matchEnv = new Tone.AmplitudeEnvelope({
        attack: 0.01,
        decay: 0.3,
        sustain: 0,
        release: 0.2
    }).toDestination();
    
    matchOsc1.connect(matchEnv);
    matchOsc2.connect(matchEnv);
    
    // Create BGM
    const bgmSynth = new Tone.PolySynth(Tone.Synth).toDestination();
    const bgmPart = new Tone.Part(((time) => {
        bgmSynth.triggerAttackRelease('C4', '8n', time);
        bgmSynth.triggerAttackRelease('E4', '8n', time + 0.5);
        bgmSynth.triggerAttackRelease('G4', '8n', time + 1);
    }), [0]).start(0);
    
    // Record and save sounds
    const recorder = new Tone.Recorder();
    
    // Ensure directory exists
    if (!fs.existsSync('static/sounds')) {
        fs.mkdirSync('static/sounds', { recursive: true });
    }
    
    // Record card flip sound
    cardFlipOsc.connect(recorder);
    await recorder.start();
    cardFlipEnv.triggerAttackRelease(0.1);
    const cardFlipBlob = await recorder.stop();
    const cardFlipBuffer = await cardFlipBlob.arrayBuffer();
    fs.writeFileSync('static/sounds/card_flip.mp3', Buffer.from(cardFlipBuffer));
    
    // Record match sound
    matchOsc1.connect(recorder);
    matchOsc2.connect(recorder);
    await recorder.start();
    matchEnv.triggerAttackRelease(0.3);
    const matchBlob = await recorder.stop();
    const matchBuffer = await matchBlob.arrayBuffer();
    fs.writeFileSync('static/sounds/match.mp3', Buffer.from(matchBuffer));
    
    // Record BGM
    bgmSynth.connect(recorder);
    await recorder.start();
    Tone.Transport.start();
    await new Promise(resolve => setTimeout(resolve, 3000));
    const bgmBlob = await recorder.stop();
    const bgmBuffer = await bgmBlob.arrayBuffer();
    fs.writeFileSync('static/sounds/BGM.mp3', Buffer.from(bgmBuffer));
    
    // Cleanup
    cardFlipOsc.dispose();
    matchOsc1.dispose();
    matchOsc2.dispose();
    cardFlipEnv.dispose();
    matchEnv.dispose();
    bgmSynth.dispose();
    bgmPart.dispose();
    recorder.dispose();
}

generateSounds().then(() => {
    console.log('Sounds generated successfully');
    process.exit(0);
}).catch(err => {
    console.error('Error generating sounds:', err);
    process.exit(1);
});
