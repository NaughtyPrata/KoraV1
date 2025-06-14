// Quick fix for Level: 0.000 microphone issue
// This script will force a fresh audio setup

export function fixMicrophoneIssue() {
  console.log('🔧 Starting microphone troubleshooting...');
  
  // Step 1: Test basic microphone access
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      console.log('✅ Microphone access successful');
      
      // Step 2: Test AudioContext
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('AudioContext state:', audioContext.state);
      
      if (audioContext.state === 'suspended') {
        console.log('🔄 Resuming AudioContext...');
        audioContext.resume().then(() => {
          console.log('✅ AudioContext resumed');
          testAudioLevels(stream, audioContext);
        });
      } else {
        testAudioLevels(stream, audioContext);
      }
    })
    .catch(error => {
      console.error('❌ Microphone access failed:', error);
      console.log('Troubleshooting steps:');
      console.log('1. Check browser permissions (click microphone icon in address bar)');
      console.log('2. Check system microphone settings');
      console.log('3. Try refreshing the page');
      console.log('4. Try a different browser');
    });
}

function testAudioLevels(stream: MediaStream, audioContext: AudioContext) {
  console.log('🎤 Testing audio levels...');
  
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(1024, 1, 1);
  let sampleCount = 0;
  let maxLevel = 0;
  
  processor.onaudioprocess = (event) => {
    const inputData = event.inputBuffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < inputData.length; i++) {
      sum += Math.abs(inputData[i]);
    }
    const average = sum / inputData.length;
    if (average > maxLevel) maxLevel = average;
    sampleCount++;
    
    // Log first few samples
    if (sampleCount <= 10) {
      console.log(`Sample ${sampleCount}: ${average.toFixed(6)}`);
    }
    
    if (sampleCount === 100) { // After ~2 seconds
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach(track => track.stop());
      
      console.log(`🎤 Test complete. Max level: ${maxLevel.toFixed(6)}`);
      
      if (maxLevel < 0.0001) {
        console.error('❌ No audio detected. Possible causes:');
        console.error('1. Microphone is muted or volume is too low');
        console.error('2. Wrong microphone selected in system settings');
        console.error('3. Hardware issue with microphone');
        console.error('4. Browser audio routing problem');
      } else {
        console.log('✅ Audio detected successfully!');
      }
    }
  };
  
  source.connect(processor);
  processor.connect(audioContext.destination);
}

// Auto-run on page load for debugging
if (typeof window !== 'undefined') {
  console.log('🔧 Microphone diagnostic tool loaded. Run fixMicrophoneIssue() to test.');
}
