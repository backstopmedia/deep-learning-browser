self.importScripts('https://rawgit.com/chaosmail/dsp.js/fix/module-browser/dsp.js');

function spectogram(audioBuffer) {
  const fft = new FFT(audioBuffer.length, audioBuffer.sampleRate);
  fft.forward(audioBuffer.data);
  return fft.spectrum;
}

self.addEventListener('message', function(e) {
  const s = spectogram(e.data);
  self.postMessage(s);
}, false);