// Client-side acoustic feature extraction for cry analysis. Runs entirely in
// the browser/WebView (Web Audio API) - no audio is ever uploaded, only the
// engineered numeric features below, which is both privacy-friendly and a
// far smaller payload than raw audio.
//
// This replaces the old "loudest FFT bin = pitch" approximation with real
// autocorrelation-based fundamental frequency (F0) tracking plus rhythm
// (cry-burst/pause pattern) and spectral-brightness features, since those
// are the acoustic properties infant-cry research actually looks at:
// pitch height/variability, burst rhythm, and spectral harshness
// (hyperphonation) - not just "how loud" and "which FFT bin peaked".

export interface CryFeatures {
  durationMs: number;
  voicedRatio: number;
  f0Mean: number | null;
  f0Min: number | null;
  f0Max: number | null;
  f0Std: number | null;
  rmsMean: number;
  rmsMax: number;
  spectralCentroidMean: number | null;
  burstCount: number;
  meanBurstDurationMs: number | null;
  meanPauseDurationMs: number | null;
}

const average = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

// Standard autocorrelation pitch detector (ACF2+ variant): trims leading/
// trailing near-silence, autocorrelates the remaining window, finds the
// first strong peak past the initial downslope, then refines it with
// parabolic interpolation. Returns -1 when the signal is too quiet/noisy
// to yield a confident estimate.
function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0;
  let r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) < thres) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) < thres) {
      r2 = SIZE - i;
      break;
    }
  }

  const trimmed = buf.slice(r1, r2);
  const newSize = trimmed.length;
  if (newSize < 2) return -1;

  const c = new Array(newSize).fill(0);
  for (let i = 0; i < newSize; i++) {
    for (let j = 0; j < newSize - i; j++) {
      c[i] += trimmed[j] * trimmed[j + i];
    }
  }

  let d = 0;
  while (d < newSize - 1 && c[d] > c[d + 1]) d++;

  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < newSize; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  if (maxpos <= 0) return -1;

  let T0 = maxpos;
  const x1 = c[T0 - 1] ?? c[T0];
  const x2 = c[T0];
  const x3 = c[T0 + 1] ?? c[T0];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  return T0 > 0 ? sampleRate / T0 : -1;
}

export async function analyzeCryAudio(durationMs = 6000, onTick?: (elapsedMs: number) => void): Promise<CryFeatures> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContextClass();
  const analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  analyser.fftSize = 2048;

  const timeDomain = new Float32Array(analyser.fftSize);
  const freqData = new Uint8Array(analyser.frequencyBinCount);

  const SAMPLE_INTERVAL_MS = 60;
  const samples: { t: number; rms: number; f0: number | null; centroid: number }[] = [];
  const startedAt = Date.now();

  await new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      analyser.getFloatTimeDomainData(timeDomain);
      analyser.getByteFrequencyData(freqData);

      let sumSquares = 0;
      for (let i = 0; i < timeDomain.length; i++) sumSquares += timeDomain[i] * timeDomain[i];
      const rms = Math.sqrt(sumSquares / timeDomain.length);

      const rawF0 = rms > 0.02 ? autoCorrelate(timeDomain, audioContext.sampleRate) : -1;
      // Infant cry fundamental frequency typically runs ~250-1000Hz (much
      // higher than adult speech); wider ceiling to still capture the very
      // high hyperphonic bursts associated with pain/distress cries.
      const f0 = rawF0 > 150 && rawF0 < 2000 ? rawF0 : null;

      let weightedSum = 0;
      let magSum = 0;
      for (let i = 0; i < freqData.length; i++) {
        const mag = freqData[i];
        const freq = (i * audioContext.sampleRate) / analyser.fftSize;
        weightedSum += freq * mag;
        magSum += mag;
      }
      const centroid = magSum > 0 ? weightedSum / magSum : 0;

      const elapsed = Date.now() - startedAt;
      samples.push({ t: elapsed, rms, f0, centroid });
      onTick?.(elapsed);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        resolve();
      }
    }, SAMPLE_INTERVAL_MS);
  });

  stream.getTracks().forEach((t) => t.stop());
  audioContext.close();

  const rmsValues = samples.map((s) => s.rms);
  const rmsMean = average(rmsValues);
  const rmsMax = Math.max(0, ...rmsValues);
  const rmsThreshold = Math.max(0.02, rmsMean * 0.6);

  const voicedCount = samples.filter((s) => s.rms >= rmsThreshold).length;
  const voicedRatio = samples.length ? voicedCount / samples.length : 0;

  const f0Values = samples.map((s) => s.f0).filter((v): v is number => v !== null);
  const f0Mean = f0Values.length ? average(f0Values) : null;
  const f0Min = f0Values.length ? Math.min(...f0Values) : null;
  const f0Max = f0Values.length ? Math.max(...f0Values) : null;
  const f0Std = f0Values.length ? Math.sqrt(average(f0Values.map((v) => (v - (f0Mean as number)) ** 2))) : null;

  const centroidValues = samples.map((s) => s.centroid).filter((c) => c > 0);
  const spectralCentroidMean = centroidValues.length ? average(centroidValues) : null;

  // Cry-burst / pause segmentation off the same RMS threshold, so we get a
  // rhythm signature (rhythmic bursts vs. one long sustained cry vs. sparse
  // fussy whimpers) instead of just a single loudness number.
  let burstCount = 0;
  const burstDurations: number[] = [];
  const pauseDurations: number[] = [];
  let state: 'silence' | 'voiced' = 'silence';
  let segStartT = samples[0]?.t ?? 0;

  for (const s of samples) {
    const voiced = s.rms >= rmsThreshold;
    if (voiced && state === 'silence') {
      pauseDurations.push(s.t - segStartT);
      state = 'voiced';
      segStartT = s.t;
      burstCount++;
    } else if (!voiced && state === 'voiced') {
      burstDurations.push(s.t - segStartT);
      state = 'silence';
      segStartT = s.t;
    }
  }
  const lastT = samples[samples.length - 1]?.t ?? segStartT;
  if (state === 'voiced') burstDurations.push(lastT - segStartT);
  else pauseDurations.push(lastT - segStartT);

  return {
    durationMs,
    voicedRatio,
    f0Mean,
    f0Min,
    f0Max,
    f0Std,
    rmsMean,
    rmsMax,
    spectralCentroidMean,
    burstCount,
    meanBurstDurationMs: burstDurations.length ? average(burstDurations) : null,
    meanPauseDurationMs: pauseDurations.length ? average(pauseDurations) : null,
  };
}
