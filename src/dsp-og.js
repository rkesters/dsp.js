function Sampler(
	file,
	bufferSize,
	sampleRate,
	playStart,
	playEnd,
	loopStart,
	loopEnd,
	loopMode,
) {
	this.file = file;
	this.bufferSize = bufferSize;
	this.sampleRate = sampleRate;
	this.playStart = playStart || 0; // 0%
	this.playEnd = playEnd || 1; // 100%
	this.loopStart = loopStart || 0;
	this.loopEnd = loopEnd || 1;
	this.loopMode = loopMode || DSP.OFF;
	this.loaded = false;
	this.samples = [];
	this.signal = new Float64Array(bufferSize);
	this.frameCount = 0;
	this.envelope = null;
	this.amplitude = 1;
	this.rootFrequency = 110; // A2 110
	this.frequency = 550;
	this.step = this.frequency / this.rootFrequency;
	this.duration = 0;
	this.samplesProcessed = 0;
	this.playhead = 0;

	var audio = /* new Audio();*/ document.createElement('AUDIO');
	var self = this;

	this.loadSamples = function (event) {
		var buffer = DSP.getChannel(DSP.MIX, event.frameBuffer);
		for (var i = 0; i < buffer.length; i++) {
			self.samples.push(buffer[i]);
		}
	};

	this.loadComplete = function () {
		// convert flexible js array into a fast typed array
		self.samples = new Float64Array(self.samples);
		self.loaded = true;
	};

	this.loadMetaData = function () {
		self.duration = audio.duration;
	};

	audio.addEventListener('MozAudioAvailable', this.loadSamples, false);
	audio.addEventListener('loadedmetadata', this.loadMetaData, false);
	audio.addEventListener('ended', this.loadComplete, false);
	audio.muted = true;
	audio.src = file;
	audio.play();
}

Sampler.prototype.applyEnvelope = function () {
	this.envelope.process(this.signal);
	return this.signal;
};

Sampler.prototype.generate = function () {
	var frameOffset = this.frameCount * this.bufferSize;

	var loopWidth =
		this.playEnd * this.samples.length -
		this.playStart * this.samples.length;
	var playStartSamples = this.playStart * this.samples.length; // ie 0.5 -> 50% of the length
	var playEndSamples = this.playEnd * this.samples.length; // ie 0.5 -> 50% of the length
	var offset;

	for (var i = 0; i < this.bufferSize; i++) {
		switch (this.loopMode) {
			case DSP.OFF:
				this.playhead = Math.round(
					this.samplesProcessed * this.step + playStartSamples,
				);
				if (this.playhead < this.playEnd * this.samples.length) {
					this.signal[i] =
						this.samples[this.playhead] * this.amplitude;
				} else {
					this.signal[i] = 0;
				}
				break;

			case DSP.FW:
				this.playhead = Math.round(
					((this.samplesProcessed * this.step) % loopWidth) +
						playStartSamples,
				);
				if (this.playhead < this.playEnd * this.samples.length) {
					this.signal[i] =
						this.samples[this.playhead] * this.amplitude;
				}
				break;

			case DSP.BW:
				this.playhead =
					playEndSamples -
					Math.round((this.samplesProcessed * this.step) % loopWidth);
				if (this.playhead < this.playEnd * this.samples.length) {
					this.signal[i] =
						this.samples[this.playhead] * this.amplitude;
				}
				break;

			case DSP.FWBW:
				if (
					Math.floor(
						(this.samplesProcessed * this.step) / loopWidth,
					) %
						2 ===
					0
				) {
					this.playhead = Math.round(
						((this.samplesProcessed * this.step) % loopWidth) +
							playStartSamples,
					);
				} else {
					this.playhead =
						playEndSamples -
						Math.round(
							(this.samplesProcessed * this.step) % loopWidth,
						);
				}
				if (this.playhead < this.playEnd * this.samples.length) {
					this.signal[i] =
						this.samples[this.playhead] * this.amplitude;
				}
				break;
		}
		this.samplesProcessed++;
	}

	this.frameCount++;

	return this.signal;
};

Sampler.prototype.setFreq = function (frequency) {
	var totalProcessed = this.samplesProcessed * this.step;
	this.frequency = frequency;
	this.step = this.frequency / this.rootFrequency;
	this.samplesProcessed = Math.round(totalProcessed / this.step);
};

Sampler.prototype.reset = function () {
	this.samplesProcessed = 0;
	this.playhead = 0;
};

/**
 * Oscillator class for generating and modifying signals
 *
 * @param {Number} type       A waveform constant (eg. DSP.SINE)
 * @param {Number} frequency  Initial frequency of the signal
 * @param {Number} amplitude  Initial amplitude of the signal
 * @param {Number} bufferSize Size of the sample buffer to generate
 * @param {Number} sampleRate The sample rate of the signal
 *
 * @contructor
 */
function Oscillator(type, frequency, amplitude, bufferSize, sampleRate) {
	this.frequency = frequency;
	this.amplitude = amplitude;
	this.bufferSize = bufferSize;
	this.sampleRate = sampleRate;
	//this.pulseWidth = pulseWidth;
	this.frameCount = 0;

	this.waveTableLength = 2048;

	this.cyclesPerSample = frequency / sampleRate;

	this.signal = new Float64Array(bufferSize);
	this.envelope = null;

	switch (parseInt(type, 10)) {
		case DSP.TRIANGLE:
			this.func = Oscillator.Triangle;
			break;

		case DSP.SAW:
			this.func = Oscillator.Saw;
			break;

		case DSP.SQUARE:
			this.func = Oscillator.Square;
			break;

		default:
		case DSP.SINE:
			this.func = Oscillator.Sine;
			break;
	}

	this.generateWaveTable = function () {
		Oscillator.waveTable[this.func] = new Float64Array(2048);
		var waveTableTime = this.waveTableLength / this.sampleRate;
		var waveTableHz = 1 / waveTableTime;

		for (var i = 0; i < this.waveTableLength; i++) {
			Oscillator.waveTable[this.func][i] = this.func(
				(i * waveTableHz) / this.sampleRate,
			);
		}
	};

	if (typeof Oscillator.waveTable === 'undefined') {
		Oscillator.waveTable = {};
	}

	if (typeof Oscillator.waveTable[this.func] === 'undefined') {
		this.generateWaveTable();
	}

	this.waveTable = Oscillator.waveTable[this.func];
}

/**
 * Set the amplitude of the signal
 *
 * @param {Number} amplitude The amplitude of the signal (between 0 and 1)
 */
Oscillator.prototype.setAmp = function (amplitude) {
	if (amplitude >= 0 && amplitude <= 1) {
		this.amplitude = amplitude;
	} else {
		throw 'Amplitude out of range (0..1).';
	}
};

/**
 * Set the frequency of the signal
 *
 * @param {Number} frequency The frequency of the signal
 */
Oscillator.prototype.setFreq = function (frequency) {
	this.frequency = frequency;
	this.cyclesPerSample = frequency / this.sampleRate;
};

// Add an oscillator
Oscillator.prototype.add = function (oscillator) {
	for (var i = 0; i < this.bufferSize; i++) {
		//this.signal[i] += oscillator.valueAt(i);
		this.signal[i] += oscillator.signal[i];
	}

	return this.signal;
};

// Add a signal to the current generated osc signal
Oscillator.prototype.addSignal = function (signal) {
	for (var i = 0; i < signal.length; i++) {
		if (i >= this.bufferSize) {
			break;
		}
		this.signal[i] += signal[i];

		/*
    // Constrain amplitude
    if ( this.signal[i] > 1 ) {
      this.signal[i] = 1;
    } else if ( this.signal[i] < -1 ) {
      this.signal[i] = -1;
    }
    */
	}
	return this.signal;
};

// Add an envelope to the oscillator
Oscillator.prototype.addEnvelope = function (envelope) {
	this.envelope = envelope;
};

Oscillator.prototype.applyEnvelope = function () {
	this.envelope.process(this.signal);
};

Oscillator.prototype.valueAt = function (offset) {
	return this.waveTable[offset % this.waveTableLength];
};

Oscillator.prototype.generate = function () {
	var frameOffset = this.frameCount * this.bufferSize;
	var step = (this.waveTableLength * this.frequency) / this.sampleRate;
	var offset;

	for (var i = 0; i < this.bufferSize; i++) {
		//var step = (frameOffset + i) * this.cyclesPerSample % 1;
		//this.signal[i] = this.func(step) * this.amplitude;
		//this.signal[i] = this.valueAt(Math.round((frameOffset + i) * step)) * this.amplitude;
		offset = Math.round((frameOffset + i) * step);
		this.signal[i] =
			this.waveTable[offset % this.waveTableLength] * this.amplitude;
	}

	this.frameCount++;

	return this.signal;
};

Oscillator.Sine = function (step) {
	return Math.sin(DSP.TWO_PI * step);
};

Oscillator.Square = function (step) {
	return step < 0.5 ? 1 : -1;
};

Oscillator.Saw = function (step) {
	return 2 * (step - Math.round(step));
};

Oscillator.Triangle = function (step) {
	return 1 - 4 * Math.abs(Math.round(step) - step);
};

Oscillator.Pulse = function (step) {
	// stub
};

function ADSR(
	attackLength,
	decayLength,
	sustainLevel,
	sustainLength,
	releaseLength,
	sampleRate,
) {
	this.sampleRate = sampleRate;
	// Length in seconds
	this.attackLength = attackLength;
	this.decayLength = decayLength;
	this.sustainLevel = sustainLevel;
	this.sustainLength = sustainLength;
	this.releaseLength = releaseLength;
	this.sampleRate = sampleRate;

	// Length in samples
	this.attackSamples = attackLength * sampleRate;
	this.decaySamples = decayLength * sampleRate;
	this.sustainSamples = sustainLength * sampleRate;
	this.releaseSamples = releaseLength * sampleRate;

	// Updates the envelope sample positions
	this.update = function () {
		this.attack = this.attackSamples;
		this.decay = this.attack + this.decaySamples;
		this.sustain = this.decay + this.sustainSamples;
		this.release = this.sustain + this.releaseSamples;
	};

	this.update();

	this.samplesProcessed = 0;
}

ADSR.prototype.noteOn = function () {
	this.samplesProcessed = 0;
	this.sustainSamples = this.sustainLength * this.sampleRate;
	this.update();
};

// Send a note off when using a sustain of infinity to let the envelope enter the release phase
ADSR.prototype.noteOff = function () {
	this.sustainSamples = this.samplesProcessed - this.decaySamples;
	this.update();
};

ADSR.prototype.processSample = function (sample) {
	var amplitude = 0;

	if (this.samplesProcessed <= this.attack) {
		amplitude =
			0 + (1 - 0) * ((this.samplesProcessed - 0) / (this.attack - 0));
	} else if (
		this.samplesProcessed > this.attack &&
		this.samplesProcessed <= this.decay
	) {
		amplitude =
			1 +
			(this.sustainLevel - 1) *
				((this.samplesProcessed - this.attack) /
					(this.decay - this.attack));
	} else if (
		this.samplesProcessed > this.decay &&
		this.samplesProcessed <= this.sustain
	) {
		amplitude = this.sustainLevel;
	} else if (
		this.samplesProcessed > this.sustain &&
		this.samplesProcessed <= this.release
	) {
		amplitude =
			this.sustainLevel +
			(0 - this.sustainLevel) *
				((this.samplesProcessed - this.sustain) /
					(this.release - this.sustain));
	}

	return sample * amplitude;
};

ADSR.prototype.value = function () {
	var amplitude = 0;

	if (this.samplesProcessed <= this.attack) {
		amplitude =
			0 + (1 - 0) * ((this.samplesProcessed - 0) / (this.attack - 0));
	} else if (
		this.samplesProcessed > this.attack &&
		this.samplesProcessed <= this.decay
	) {
		amplitude =
			1 +
			(this.sustainLevel - 1) *
				((this.samplesProcessed - this.attack) /
					(this.decay - this.attack));
	} else if (
		this.samplesProcessed > this.decay &&
		this.samplesProcessed <= this.sustain
	) {
		amplitude = this.sustainLevel;
	} else if (
		this.samplesProcessed > this.sustain &&
		this.samplesProcessed <= this.release
	) {
		amplitude =
			this.sustainLevel +
			(0 - this.sustainLevel) *
				((this.samplesProcessed - this.sustain) /
					(this.release - this.sustain));
	}

	return amplitude;
};

ADSR.prototype.process = function (buffer) {
	for (var i = 0; i < buffer.length; i++) {
		buffer[i] *= this.value();

		this.samplesProcessed++;
	}

	return buffer;
};

ADSR.prototype.isActive = function () {
	if (this.samplesProcessed > this.release || this.samplesProcessed === -1) {
		return false;
	} else {
		return true;
	}
};

ADSR.prototype.disable = function () {
	this.samplesProcessed = -1;
};

function IIRFilter(type, cutoff, resonance, sampleRate) {
	this.sampleRate = sampleRate;

	switch (type) {
		case DSP.LOWPASS:
		case DSP.LP12:
			this.func = new IIRFilter.LP12(cutoff, resonance, sampleRate);
			break;
	}
}

IIRFilter.prototype.__defineGetter__('cutoff', function () {
	return this.func.cutoff;
});

IIRFilter.prototype.__defineGetter__('resonance', function () {
	return this.func.resonance;
});

IIRFilter.prototype.set = function (cutoff, resonance) {
	this.func.calcCoeff(cutoff, resonance);
};

IIRFilter.prototype.process = function (buffer) {
	this.func.process(buffer);
};

// Add an envelope to the filter
IIRFilter.prototype.addEnvelope = function (envelope) {
	if (envelope instanceof ADSR) {
		this.func.addEnvelope(envelope);
	} else {
		throw 'Not an envelope.';
	}
};

IIRFilter.LP12 = function (cutoff, resonance, sampleRate) {
	this.sampleRate = sampleRate;
	this.vibraPos = 0;
	this.vibraSpeed = 0;
	this.envelope = false;

	this.calcCoeff = function (cutoff, resonance) {
		this.w = (2.0 * Math.PI * cutoff) / this.sampleRate;
		this.q =
			1.0 -
			this.w / (2.0 * (resonance + 0.5 / (1.0 + this.w)) + this.w - 2.0);
		this.r = this.q * this.q;
		this.c = this.r + 1.0 - 2.0 * Math.cos(this.w) * this.q;

		this.cutoff = cutoff;
		this.resonance = resonance;
	};

	this.calcCoeff(cutoff, resonance);

	this.process = function (buffer) {
		for (var i = 0; i < buffer.length; i++) {
			this.vibraSpeed += (buffer[i] - this.vibraPos) * this.c;
			this.vibraPos += this.vibraSpeed;
			this.vibraSpeed *= this.r;

			/*
      var temp = this.vibraPos;
     
      if ( temp > 1.0 ) {
        temp = 1.0;
      } else if ( temp < -1.0 ) {
        temp = -1.0;
      } else if ( temp != temp ) {
        temp = 1;
      }
     
      buffer[i] = temp;
      */

			if (this.envelope) {
				buffer[i] =
					buffer[i] * (1 - this.envelope.value()) +
					this.vibraPos * this.envelope.value();
				this.envelope.samplesProcessed++;
			} else {
				buffer[i] = this.vibraPos;
			}
		}
	};
};

IIRFilter.LP12.prototype.addEnvelope = function (envelope) {
	this.envelope = envelope;
};

function IIRFilter2(type, cutoff, resonance, sampleRate) {
	this.type = type;
	this.cutoff = cutoff;
	this.resonance = resonance;
	this.sampleRate = sampleRate;

	this.f = Float64Array(4);
	this.f[0] = 0.0; // lp
	this.f[1] = 0.0; // hp
	this.f[2] = 0.0; // bp
	this.f[3] = 0.0; // br

	this.calcCoeff = function (cutoff, resonance) {
		this.freq =
			2 *
			Math.sin(Math.PI * Math.min(0.25, cutoff / (this.sampleRate * 2)));
		this.damp = Math.min(
			2 * (1 - Math.pow(resonance, 0.25)),
			Math.min(2, 2 / this.freq - this.freq * 0.5),
		);
	};

	this.calcCoeff(cutoff, resonance);
}

IIRFilter2.prototype.process = function (buffer) {
	var input, output;
	var f = this.f;

	for (var i = 0; i < buffer.length; i++) {
		input = buffer[i];

		// first pass
		f[3] = input - this.damp * f[2];
		f[0] = f[0] + this.freq * f[2];
		f[1] = f[3] - f[0];
		f[2] = this.freq * f[1] + f[2];
		output = 0.5 * f[this.type];

		// second pass
		f[3] = input - this.damp * f[2];
		f[0] = f[0] + this.freq * f[2];
		f[1] = f[3] - f[0];
		f[2] = this.freq * f[1] + f[2];
		output += 0.5 * f[this.type];

		if (this.envelope) {
			buffer[i] =
				buffer[i] * (1 - this.envelope.value()) +
				output * this.envelope.value();
			this.envelope.samplesProcessed++;
		} else {
			buffer[i] = output;
		}
	}
};

IIRFilter2.prototype.addEnvelope = function (envelope) {
	if (envelope instanceof ADSR) {
		this.envelope = envelope;
	} else {
		throw 'This is not an envelope.';
	}
};

IIRFilter2.prototype.set = function (cutoff, resonance) {
	this.calcCoeff(cutoff, resonance);
};

function WindowFunction(type, alpha) {
	this.alpha = alpha;

	switch (type) {
		case DSP.BARTLETT:
			this.func = WindowFunction.Bartlett;
			break;

		case DSP.BARTLETTHANN:
			this.func = WindowFunction.BartlettHann;
			break;

		case DSP.BLACKMAN:
			this.func = WindowFunction.Blackman;
			this.alpha = this.alpha || 0.16;
			break;

		case DSP.COSINE:
			this.func = WindowFunction.Cosine;
			break;

		case DSP.GAUSS:
			this.func = WindowFunction.Gauss;
			this.alpha = this.alpha || 0.25;
			break;

		case DSP.HAMMING:
			this.func = WindowFunction.Hamming;
			break;

		case DSP.HANN:
			this.func = WindowFunction.Hann;
			break;

		case DSP.LANCZOS:
			this.func = WindowFunction.Lanczoz;
			break;

		case DSP.RECTANGULAR:
			this.func = WindowFunction.Rectangular;
			break;

		case DSP.TRIANGULAR:
			this.func = WindowFunction.Triangular;
			break;
	}
}

WindowFunction.prototype.process = function (buffer) {
	var length = buffer.length;
	for (var i = 0; i < length; i++) {
		buffer[i] *= this.func(length, i, this.alpha);
	}
	return buffer;
};

WindowFunction.Bartlett = function (length, index) {
	return (
		(2 / (length - 1)) *
		((length - 1) / 2 - Math.abs(index - (length - 1) / 2))
	);
};

WindowFunction.BartlettHann = function (length, index) {
	return (
		0.62 -
		0.48 * Math.abs(index / (length - 1) - 0.5) -
		0.38 * Math.cos((DSP.TWO_PI * index) / (length - 1))
	);
};

WindowFunction.Blackman = function (length, index, alpha) {
	var a0 = (1 - alpha) / 2;
	var a1 = 0.5;
	var a2 = alpha / 2;

	return (
		a0 -
		a1 * Math.cos((DSP.TWO_PI * index) / (length - 1)) +
		a2 * Math.cos((4 * Math.PI * index) / (length - 1))
	);
};

WindowFunction.Cosine = function (length, index) {
	return Math.cos((Math.PI * index) / (length - 1) - Math.PI / 2);
};

WindowFunction.Gauss = function (length, index, alpha) {
	return Math.pow(
		Math.E,
		-0.5 *
			Math.pow(
				(index - (length - 1) / 2) / ((alpha * (length - 1)) / 2),
				2,
			),
	);
};

WindowFunction.Hamming = function (length, index) {
	return 0.54 - 0.46 * Math.cos((DSP.TWO_PI * index) / (length - 1));
};

WindowFunction.Hann = function (length, index) {
	return 0.5 * (1 - Math.cos((DSP.TWO_PI * index) / (length - 1)));
};

WindowFunction.Lanczos = function (length, index) {
	var x = (2 * index) / (length - 1) - 1;
	return Math.sin(Math.PI * x) / (Math.PI * x);
};

WindowFunction.Rectangular = function (length, index) {
	return 1;
};

WindowFunction.Triangular = function (length, index) {
	return (2 / length) * (length / 2 - Math.abs(index - (length - 1) / 2));
};



/*
 *  Biquad filter
 *
 *  Created by Ricard Marxer <email@ricardmarxer.com> on 2010-05-23.
 *  Copyright 2010 Ricard Marxer. All rights reserved.
 *
 */
// Implementation based on:
// http://www.musicdsp.org/files/Audio-EQ-Cookbook.txt
function Biquad(type, sampleRate) {
	this.Fs = sampleRate;
	this.type = type; // type of the filter
	this.parameterType = DSP.Q; // type of the parameter

	this.x_1_l = 0;
	this.x_2_l = 0;
	this.y_1_l = 0;
	this.y_2_l = 0;

	this.x_1_r = 0;
	this.x_2_r = 0;
	this.y_1_r = 0;
	this.y_2_r = 0;

	this.b0 = 1;
	this.a0 = 1;

	this.b1 = 0;
	this.a1 = 0;

	this.b2 = 0;
	this.a2 = 0;

	this.b0a0 = this.b0 / this.a0;
	this.b1a0 = this.b1 / this.a0;
	this.b2a0 = this.b2 / this.a0;
	this.a1a0 = this.a1 / this.a0;
	this.a2a0 = this.a2 / this.a0;

	this.f0 = 3000; // "wherever it's happenin', man."  Center Frequency or
	// Corner Frequency, or shelf midpoint frequency, depending
	// on which filter type.  The "significant frequency".

	this.dBgain = 12; // used only for peaking and shelving filters

	this.Q = 1; // the EE kind of definition, except for peakingEQ in which A*Q is
	// the classic EE Q.  That adjustment in definition was made so that
	// a boost of N dB followed by a cut of N dB for identical Q and
	// f0/Fs results in a precisely flat unity gain filter or "wire".

	this.BW = -3; // the bandwidth in octaves (between -3 dB frequencies for BPF
	// and notch or between midpoint (dBgain/2) gain frequencies for
	// peaking EQ

	this.S = 1; // a "shelf slope" parameter (for shelving EQ only).  When S = 1,
	// the shelf slope is as steep as it can be and remain monotonically
	// increasing or decreasing gain with frequency.  The shelf slope, in
	// dB/octave, remains proportional to S for all other values for a
	// fixed f0/Fs and dBgain.

	this.coefficients = function () {
		var b = [this.b0, this.b1, this.b2];
		var a = [this.a0, this.a1, this.a2];
		return { b: b, a: a };
	};

	this.setFilterType = function (type) {
		this.type = type;
		this.recalculateCoefficients();
	};

	this.setSampleRate = function (rate) {
		this.Fs = rate;
		this.recalculateCoefficients();
	};

	this.setQ = function (q) {
		this.parameterType = DSP.Q;
		this.Q = Math.max(Math.min(q, 115.0), 0.001);
		this.recalculateCoefficients();
	};

	this.setBW = function (bw) {
		this.parameterType = DSP.BW;
		this.BW = bw;
		this.recalculateCoefficients();
	};

	this.setS = function (s) {
		this.parameterType = DSP.S;
		this.S = Math.max(Math.min(s, 5.0), 0.0001);
		this.recalculateCoefficients();
	};

	this.setF0 = function (freq) {
		this.f0 = freq;
		this.recalculateCoefficients();
	};

	this.setDbGain = function (g) {
		this.dBgain = g;
		this.recalculateCoefficients();
	};

	this.recalculateCoefficients = function () {
		var A;
		if (
			type === DSP.PEAKING_EQ ||
			type === DSP.LOW_SHELF ||
			type === DSP.HIGH_SHELF
		) {
			A = Math.pow(10, this.dBgain / 40); // for peaking and shelving EQ filters only
		} else {
			A = Math.sqrt(Math.pow(10, this.dBgain / 20));
		}

		var w0 = (DSP.TWO_PI * this.f0) / this.Fs;

		var cosw0 = Math.cos(w0);
		var sinw0 = Math.sin(w0);

		var alpha = 0;

		switch (this.parameterType) {
			case DSP.Q:
				alpha = sinw0 / (2 * this.Q);
				break;

			case DSP.BW:
				alpha = sinw0 * sinh(((Math.LN2 / 2) * this.BW * w0) / sinw0);
				break;

			case DSP.S:
				alpha =
					(sinw0 / 2) * Math.sqrt((A + 1 / A) * (1 / this.S - 1) + 2);
				break;
		}

		/**
        FYI: The relationship between bandwidth and Q is
             1/Q = 2*sinh(ln(2)/2*BW*w0/sin(w0))     (digital filter w BLT)
        or   1/Q = 2*sinh(ln(2)/2*BW)             (analog filter prototype)

        The relationship between shelf slope and Q is
             1/Q = sqrt((A + 1/A)*(1/S - 1) + 2)
    */

		var coeff;

		switch (this.type) {
			case DSP.LPF: // H(s) = 1 / (s^2 + s/Q + 1)
				this.b0 = (1 - cosw0) / 2;
				this.b1 = 1 - cosw0;
				this.b2 = (1 - cosw0) / 2;
				this.a0 = 1 + alpha;
				this.a1 = -2 * cosw0;
				this.a2 = 1 - alpha;
				break;

			case DSP.HPF: // H(s) = s^2 / (s^2 + s/Q + 1)
				this.b0 = (1 + cosw0) / 2;
				this.b1 = -(1 + cosw0);
				this.b2 = (1 + cosw0) / 2;
				this.a0 = 1 + alpha;
				this.a1 = -2 * cosw0;
				this.a2 = 1 - alpha;
				break;

			case DSP.BPF_CONSTANT_SKIRT: // H(s) = s / (s^2 + s/Q + 1)  (constant skirt gain, peak gain = Q)
				this.b0 = sinw0 / 2;
				this.b1 = 0;
				this.b2 = -sinw0 / 2;
				this.a0 = 1 + alpha;
				this.a1 = -2 * cosw0;
				this.a2 = 1 - alpha;
				break;

			case DSP.BPF_CONSTANT_PEAK: // H(s) = (s/Q) / (s^2 + s/Q + 1)      (constant 0 dB peak gain)
				this.b0 = alpha;
				this.b1 = 0;
				this.b2 = -alpha;
				this.a0 = 1 + alpha;
				this.a1 = -2 * cosw0;
				this.a2 = 1 - alpha;
				break;

			case DSP.NOTCH: // H(s) = (s^2 + 1) / (s^2 + s/Q + 1)
				this.b0 = 1;
				this.b1 = -2 * cosw0;
				this.b2 = 1;
				this.a0 = 1 + alpha;
				this.a1 = -2 * cosw0;
				this.a2 = 1 - alpha;
				break;

			case DSP.APF: // H(s) = (s^2 - s/Q + 1) / (s^2 + s/Q + 1)
				this.b0 = 1 - alpha;
				this.b1 = -2 * cosw0;
				this.b2 = 1 + alpha;
				this.a0 = 1 + alpha;
				this.a1 = -2 * cosw0;
				this.a2 = 1 - alpha;
				break;

			case DSP.PEAKING_EQ: // H(s) = (s^2 + s*(A/Q) + 1) / (s^2 + s/(A*Q) + 1)
				this.b0 = 1 + alpha * A;
				this.b1 = -2 * cosw0;
				this.b2 = 1 - alpha * A;
				this.a0 = 1 + alpha / A;
				this.a1 = -2 * cosw0;
				this.a2 = 1 - alpha / A;
				break;

			case DSP.LOW_SHELF: // H(s) = A * (s^2 + (sqrt(A)/Q)*s + A)/(A*s^2 + (sqrt(A)/Q)*s + 1)
				coeff =
					sinw0 * Math.sqrt((A ^ (2 + 1)) * (1 / this.S - 1) + 2 * A);
				this.b0 = A * (A + 1 - (A - 1) * cosw0 + coeff);
				this.b1 = 2 * A * (A - 1 - (A + 1) * cosw0);
				this.b2 = A * (A + 1 - (A - 1) * cosw0 - coeff);
				this.a0 = A + 1 + (A - 1) * cosw0 + coeff;
				this.a1 = -2 * (A - 1 + (A + 1) * cosw0);
				this.a2 = A + 1 + (A - 1) * cosw0 - coeff;
				break;

			case DSP.HIGH_SHELF: // H(s) = A * (A*s^2 + (sqrt(A)/Q)*s + 1)/(s^2 + (sqrt(A)/Q)*s + A)
				coeff =
					sinw0 * Math.sqrt((A ^ (2 + 1)) * (1 / this.S - 1) + 2 * A);
				this.b0 = A * (A + 1 + (A - 1) * cosw0 + coeff);
				this.b1 = -2 * A * (A - 1 + (A + 1) * cosw0);
				this.b2 = A * (A + 1 + (A - 1) * cosw0 - coeff);
				this.a0 = A + 1 - (A - 1) * cosw0 + coeff;
				this.a1 = 2 * (A - 1 - (A + 1) * cosw0);
				this.a2 = A + 1 - (A - 1) * cosw0 - coeff;
				break;
		}

		this.b0a0 = this.b0 / this.a0;
		this.b1a0 = this.b1 / this.a0;
		this.b2a0 = this.b2 / this.a0;
		this.a1a0 = this.a1 / this.a0;
		this.a2a0 = this.a2 / this.a0;
	};

	this.process = function (buffer) {
		//y[n] = (b0/a0)*x[n] + (b1/a0)*x[n-1] + (b2/a0)*x[n-2]
		//       - (a1/a0)*y[n-1] - (a2/a0)*y[n-2]

		var len = buffer.length;
		var output = new Float64Array(len);

		for (var i = 0; i < buffer.length; i++) {
			output[i] =
				this.b0a0 * buffer[i] +
				this.b1a0 * this.x_1_l +
				this.b2a0 * this.x_2_l -
				this.a1a0 * this.y_1_l -
				this.a2a0 * this.y_2_l;
			this.y_2_l = this.y_1_l;
			this.y_1_l = output[i];
			this.x_2_l = this.x_1_l;
			this.x_1_l = buffer[i];
		}

		return output;
	};

	this.processStereo = function (buffer) {
		//y[n] = (b0/a0)*x[n] + (b1/a0)*x[n-1] + (b2/a0)*x[n-2]
		//       - (a1/a0)*y[n-1] - (a2/a0)*y[n-2]

		var len = buffer.length;
		var output = new Float64Array(len);

		for (var i = 0; i < len / 2; i++) {
			output[2 * i] =
				this.b0a0 * buffer[2 * i] +
				this.b1a0 * this.x_1_l +
				this.b2a0 * this.x_2_l -
				this.a1a0 * this.y_1_l -
				this.a2a0 * this.y_2_l;
			this.y_2_l = this.y_1_l;
			this.y_1_l = output[2 * i];
			this.x_2_l = this.x_1_l;
			this.x_1_l = buffer[2 * i];

			output[2 * i + 1] =
				this.b0a0 * buffer[2 * i + 1] +
				this.b1a0 * this.x_1_r +
				this.b2a0 * this.x_2_r -
				this.a1a0 * this.y_1_r -
				this.a2a0 * this.y_2_r;
			this.y_2_r = this.y_1_r;
			this.y_1_r = output[2 * i + 1];
			this.x_2_r = this.x_1_r;
			this.x_1_r = buffer[2 * i + 1];
		}

		return output;
	};
}

/*
 *  Magnitude to decibels
 *
 *  Created by Ricard Marxer <email@ricardmarxer.com> on 2010-05-23.
 *  Copyright 2010 Ricard Marxer. All rights reserved.
 *
 *  @buffer array of magnitudes to convert to decibels
 *
 *  @returns the array in decibels
 *
 */
DSP.mag2db = function (buffer) {
	var minDb = -120;
	var minMag = Math.pow(10.0, minDb / 20.0);

	var log = Math.log;
	var max = Math.max;

	var result = Float64Array(buffer.length);
	for (var i = 0; i < buffer.length; i++) {
		result[i] = 20.0 * log(max(buffer[i], minMag));
	}

	return result;
};

/*
 *  Frequency response
 *
 *  Created by Ricard Marxer <email@ricardmarxer.com> on 2010-05-23.
 *  Copyright 2010 Ricard Marxer. All rights reserved.
 *
 *  Calculates the frequency response at the given points.
 *
 *  @b b coefficients of the filter
 *  @a a coefficients of the filter
 *  @w w points (normally between -PI and PI) where to calculate the frequency response
 *
 *  @returns the frequency response in magnitude
 *
 */
DSP.freqz = function (b, a, w) {
	var i, j;

	if (!w) {
		w = Float64Array(200);
		for (i = 0; i < w.length; i++) {
			w[i] = (DSP.TWO_PI / w.length) * i - Math.PI;
		}
	}

	var result = Float64Array(w.length);

	var sqrt = Math.sqrt;
	var cos = Math.cos;
	var sin = Math.sin;

	for (i = 0; i < w.length; i++) {
		var numerator = { real: 0.0, imag: 0.0 };
		for (j = 0; j < b.length; j++) {
			numerator.real += b[j] * cos(-j * w[i]);
			numerator.imag += b[j] * sin(-j * w[i]);
		}

		var denominator = { real: 0.0, imag: 0.0 };
		for (j = 0; j < a.length; j++) {
			denominator.real += a[j] * cos(-j * w[i]);
			denominator.imag += a[j] * sin(-j * w[i]);
		}

		result[i] =
			sqrt(
				numerator.real * numerator.real +
					numerator.imag * numerator.imag,
			) /
			sqrt(
				denominator.real * denominator.real +
					denominator.imag * denominator.imag,
			);
	}

	return result;
};

/*
 *  Graphical Equalizer
 *
 *  Implementation of a graphic equalizer with a configurable bands-per-octave
 *  and minimum and maximum frequencies
 *
 *  Created by Ricard Marxer <email@ricardmarxer.com> on 2010-05-23.
 *  Copyright 2010 Ricard Marxer. All rights reserved.
 *
 */
function GraphicalEq(sampleRate) {
	this.FS = sampleRate;
	this.minFreq = 40.0;
	this.maxFreq = 16000.0;

	this.bandsPerOctave = 1.0;

	this.filters = [];
	this.freqzs = [];

	this.calculateFreqzs = true;

	this.recalculateFilters = function () {
		var bandCount = Math.round(
			(Math.log(this.maxFreq / this.minFreq) * this.bandsPerOctave) /
				Math.LN2,
		);

		this.filters = [];
		for (var i = 0; i < bandCount; i++) {
			var freq = this.minFreq * Math.pow(2, i / this.bandsPerOctave);
			var newFilter = new Biquad(DSP.PEAKING_EQ, this.FS);
			newFilter.setDbGain(0);
			newFilter.setBW(1 / this.bandsPerOctave);
			newFilter.setF0(freq);
			this.filters[i] = newFilter;
			this.recalculateFreqz(i);
		}
	};

	this.setMinimumFrequency = function (freq) {
		this.minFreq = freq;
		this.recalculateFilters();
	};

	this.setMaximumFrequency = function (freq) {
		this.maxFreq = freq;
		this.recalculateFilters();
	};

	this.setBandsPerOctave = function (bands) {
		this.bandsPerOctave = bands;
		this.recalculateFilters();
	};

	this.setBandGain = function (bandIndex, gain) {
		if (bandIndex < 0 || bandIndex > this.filters.length - 1) {
			throw 'The band index of the graphical equalizer is out of bounds.';
		}

		if (!gain) {
			throw 'A gain must be passed.';
		}

		this.filters[bandIndex].setDbGain(gain);
		this.recalculateFreqz(bandIndex);
	};

	this.recalculateFreqz = function (bandIndex) {
		if (!this.calculateFreqzs) {
			return;
		}

		if (bandIndex < 0 || bandIndex > this.filters.length - 1) {
			throw (
				'The band index of the graphical equalizer is out of bounds. ' +
				bandIndex +
				' is out of [' +
				0 +
				', ' +
				this.filters.length -
				1 +
				']'
			);
		}

		if (!this.w) {
			this.w = Float64Array(400);
			for (var i = 0; i < this.w.length; i++) {
				this.w[i] = (Math.PI / this.w.length) * i;
			}
		}

		var b = [
			this.filters[bandIndex].b0,
			this.filters[bandIndex].b1,
			this.filters[bandIndex].b2,
		];
		var a = [
			this.filters[bandIndex].a0,
			this.filters[bandIndex].a1,
			this.filters[bandIndex].a2,
		];

		this.freqzs[bandIndex] = DSP.mag2db(DSP.freqz(b, a, this.w));
	};

	this.process = function (buffer) {
		var output = buffer;

		for (var i = 0; i < this.filters.length; i++) {
			output = this.filters[i].process(output);
		}

		return output;
	};

	this.processStereo = function (buffer) {
		var output = buffer;

		for (var i = 0; i < this.filters.length; i++) {
			output = this.filters[i].processStereo(output);
		}

		return output;
	};
}

/**
 * MultiDelay effect by Almer Thie (http://code.almeros.com).
 * Copyright 2010 Almer Thie. All rights reserved.
 * Example: http://code.almeros.com/code-examples/delay-firefox-audio-api/
 *
 * This is a delay that feeds it's own delayed signal back into its circular
 * buffer. Also known as a CombFilter.
 *
 * Compatible with interleaved stereo (or more channel) buffers and
 * non-interleaved mono buffers.
 *
 * @param {Number} maxDelayInSamplesSize Maximum possible delay in samples (size of circular buffer)
 * @param {Number} delayInSamples Initial delay in samples
 * @param {Number} masterVolume Initial master volume. Float value: 0.0 (silence), 1.0 (normal), >1.0 (amplify)
 * @param {Number} delayVolume Initial feedback delay volume. Float value: 0.0 (silence), 1.0 (normal), >1.0 (amplify)
 *
 * @constructor
 */
function MultiDelay(
	maxDelayInSamplesSize,
	delayInSamples,
	masterVolume,
	delayVolume,
) {
	this.delayBufferSamples = new Float64Array(maxDelayInSamplesSize); // The maximum size of delay
	this.delayInputPointer = delayInSamples;
	this.delayOutputPointer = 0;

	this.delayInSamples = delayInSamples;
	this.masterVolume = masterVolume;
	this.delayVolume = delayVolume;
}

/**
 * Change the delay time in samples.
 *
 * @param {Number} delayInSamples Delay in samples
 */
MultiDelay.prototype.setDelayInSamples = function (delayInSamples) {
	this.delayInSamples = delayInSamples;

	this.delayInputPointer = this.delayOutputPointer + delayInSamples;

	if (this.delayInputPointer >= this.delayBufferSamples.length - 1) {
		this.delayInputPointer =
			this.delayInputPointer - this.delayBufferSamples.length;
	}
};

/**
 * Change the master volume.
 *
 * @param {Number} masterVolume Float value: 0.0 (silence), 1.0 (normal), >1.0 (amplify)
 */
MultiDelay.prototype.setMasterVolume = function (masterVolume) {
	this.masterVolume = masterVolume;
};

/**
 * Change the delay feedback volume.
 *
 * @param {Number} delayVolume Float value: 0.0 (silence), 1.0 (normal), >1.0 (amplify)
 */
MultiDelay.prototype.setDelayVolume = function (delayVolume) {
	this.delayVolume = delayVolume;
};

/**
 * Process a given interleaved or mono non-interleaved float value Array and adds the delayed audio.
 *
 * @param {Array} samples Array containing Float values or a Float64Array
 *
 * @returns A new Float64Array interleaved or mono non-interleaved as was fed to this function.
 */
MultiDelay.prototype.process = function (samples) {
	// NB. Make a copy to put in the output samples to return.
	var outputSamples = new Float64Array(samples.length);

	for (var i = 0; i < samples.length; i++) {
		// delayBufferSamples could contain initial NULL's, return silence in that case
		var delaySample =
			this.delayBufferSamples[this.delayOutputPointer] === null
				? 0.0
				: this.delayBufferSamples[this.delayOutputPointer];

		// Mix normal audio data with delayed audio
		var sample = delaySample * this.delayVolume + samples[i];

		// Add audio data with the delay in the delay buffer
		this.delayBufferSamples[this.delayInputPointer] = sample;

		// Return the audio with delay mix
		outputSamples[i] = sample * this.masterVolume;

		// Manage circulair delay buffer pointers
		this.delayInputPointer++;
		if (this.delayInputPointer >= this.delayBufferSamples.length - 1) {
			this.delayInputPointer = 0;
		}

		this.delayOutputPointer++;
		if (this.delayOutputPointer >= this.delayBufferSamples.length - 1) {
			this.delayOutputPointer = 0;
		}
	}

	return outputSamples;
};

/**
 * SingleDelay effect by Almer Thie (http://code.almeros.com).
 * Copyright 2010 Almer Thie. All rights reserved.
 * Example: See usage in Reverb class
 *
 * This is a delay that does NOT feeds it's own delayed signal back into its
 * circular buffer, neither does it return the original signal. Also known as
 * an AllPassFilter(?).
 *
 * Compatible with interleaved stereo (or more channel) buffers and
 * non-interleaved mono buffers.
 *
 * @param {Number} maxDelayInSamplesSize Maximum possible delay in samples (size of circular buffer)
 * @param {Number} delayInSamples Initial delay in samples
 * @param {Number} delayVolume Initial feedback delay volume. Float value: 0.0 (silence), 1.0 (normal), >1.0 (amplify)
 *
 * @constructor
 */

function SingleDelay(maxDelayInSamplesSize, delayInSamples, delayVolume) {
	this.delayBufferSamples = new Float64Array(maxDelayInSamplesSize); // The maximum size of delay
	this.delayInputPointer = delayInSamples;
	this.delayOutputPointer = 0;

	this.delayInSamples = delayInSamples;
	this.delayVolume = delayVolume;
}

/**
 * Change the delay time in samples.
 *
 * @param {Number} delayInSamples Delay in samples
 */
SingleDelay.prototype.setDelayInSamples = function (delayInSamples) {
	this.delayInSamples = delayInSamples;
	this.delayInputPointer = this.delayOutputPointer + delayInSamples;

	if (this.delayInputPointer >= this.delayBufferSamples.length - 1) {
		this.delayInputPointer =
			this.delayInputPointer - this.delayBufferSamples.length;
	}
};

/**
 * Change the return signal volume.
 *
 * @param {Number} delayVolume Float value: 0.0 (silence), 1.0 (normal), >1.0 (amplify)
 */
SingleDelay.prototype.setDelayVolume = function (delayVolume) {
	this.delayVolume = delayVolume;
};

/**
 * Process a given interleaved or mono non-interleaved float value Array and
 * returns the delayed audio.
 *
 * @param {Array} samples Array containing Float values or a Float64Array
 *
 * @returns A new Float64Array interleaved or mono non-interleaved as was fed to this function.
 */
SingleDelay.prototype.process = function (samples) {
	// NB. Make a copy to put in the output samples to return.
	var outputSamples = new Float64Array(samples.length);

	for (var i = 0; i < samples.length; i++) {
		// Add audio data with the delay in the delay buffer
		this.delayBufferSamples[this.delayInputPointer] = samples[i];

		// delayBufferSamples could contain initial NULL's, return silence in that case
		var delaySample = this.delayBufferSamples[this.delayOutputPointer];

		// Return the audio with delay mix
		outputSamples[i] = delaySample * this.delayVolume;

		// Manage circulair delay buffer pointers
		this.delayInputPointer++;

		if (this.delayInputPointer >= this.delayBufferSamples.length - 1) {
			this.delayInputPointer = 0;
		}

		this.delayOutputPointer++;

		if (this.delayOutputPointer >= this.delayBufferSamples.length - 1) {
			this.delayOutputPointer = 0;
		}
	}

	return outputSamples;
};

/**
 * Reverb effect by Almer Thie (http://code.almeros.com).
 * Copyright 2010 Almer Thie. All rights reserved.
 * Example: http://code.almeros.com/code-examples/reverb-firefox-audio-api/
 *
 * This reverb consists of 6 SingleDelays, 6 MultiDelays and an IIRFilter2
 * for each of the two stereo channels.
 *
 * Compatible with interleaved stereo buffers only!
 *
 * @param {Number} maxDelayInSamplesSize Maximum possible delay in samples (size of circular buffers)
 * @param {Number} delayInSamples Initial delay in samples for internal (Single/Multi)delays
 * @param {Number} masterVolume Initial master volume. Float value: 0.0 (silence), 1.0 (normal), >1.0 (amplify)
 * @param {Number} mixVolume Initial reverb signal mix volume. Float value: 0.0 (silence), 1.0 (normal), >1.0 (amplify)
 * @param {Number} delayVolume Initial feedback delay volume for internal (Single/Multi)delays. Float value: 0.0 (silence), 1.0 (normal), >1.0 (amplify)
 * @param {Number} dampFrequency Initial low pass filter frequency. 0 to 44100 (depending on your maximum sampling frequency)
 *
 * @constructor
 */
function Reverb(
	maxDelayInSamplesSize,
	delayInSamples,
	masterVolume,
	mixVolume,
	delayVolume,
	dampFrequency,
) {
	this.delayInSamples = delayInSamples;
	this.masterVolume = masterVolume;
	this.mixVolume = mixVolume;
	this.delayVolume = delayVolume;
	this.dampFrequency = dampFrequency;

	this.NR_OF_MULTIDELAYS = 6;
	this.NR_OF_SINGLEDELAYS = 6;

	this.LOWPASSL = new IIRFilter2(DSP.LOWPASS, dampFrequency, 0, 44100);
	this.LOWPASSR = new IIRFilter2(DSP.LOWPASS, dampFrequency, 0, 44100);

	this.singleDelays = [];

	var i, delayMultiply;

	for (i = 0; i < this.NR_OF_SINGLEDELAYS; i++) {
		delayMultiply = 1.0 + i / 7.0; // 1.0, 1.1, 1.2...
		this.singleDelays[i] = new SingleDelay(
			maxDelayInSamplesSize,
			Math.round(this.delayInSamples * delayMultiply),
			this.delayVolume,
		);
	}

	this.multiDelays = [];

	for (i = 0; i < this.NR_OF_MULTIDELAYS; i++) {
		delayMultiply = 1.0 + i / 10.0; // 1.0, 1.1, 1.2...
		this.multiDelays[i] = new MultiDelay(
			maxDelayInSamplesSize,
			Math.round(this.delayInSamples * delayMultiply),
			this.masterVolume,
			this.delayVolume,
		);
	}
}

/**
 * Change the delay time in samples as a base for all delays.
 *
 * @param {Number} delayInSamples Delay in samples
 */
Reverb.prototype.setDelayInSamples = function (delayInSamples) {
	this.delayInSamples = delayInSamples;

	var i, delayMultiply;

	for (i = 0; i < this.NR_OF_SINGLEDELAYS; i++) {
		delayMultiply = 1.0 + i / 7.0; // 1.0, 1.1, 1.2...
		this.singleDelays[i].setDelayInSamples(
			Math.round(this.delayInSamples * delayMultiply),
		);
	}

	for (i = 0; i < this.NR_OF_MULTIDELAYS; i++) {
		delayMultiply = 1.0 + i / 10.0; // 1.0, 1.1, 1.2...
		this.multiDelays[i].setDelayInSamples(
			Math.round(this.delayInSamples * delayMultiply),
		);
	}
};

/**
 * Change the master volume.
 *
 * @param {Number} masterVolume Float value: 0.0 (silence), 1.0 (normal), >1.0 (amplify)
 */
Reverb.prototype.setMasterVolume = function (masterVolume) {
	this.masterVolume = masterVolume;
};

/**
 * Change the reverb signal mix level.
 *
 * @param {Number} mixVolume Float value: 0.0 (silence), 1.0 (normal), >1.0 (amplify)
 */
Reverb.prototype.setMixVolume = function (mixVolume) {
	this.mixVolume = mixVolume;
};

/**
 * Change all delays feedback volume.
 *
 * @param {Number} delayVolume Float value: 0.0 (silence), 1.0 (normal), >1.0 (amplify)
 */
Reverb.prototype.setDelayVolume = function (delayVolume) {
	this.delayVolume = delayVolume;

	var i;

	for (i = 0; i < this.NR_OF_SINGLEDELAYS; i++) {
		this.singleDelays[i].setDelayVolume(this.delayVolume);
	}

	for (i = 0; i < this.NR_OF_MULTIDELAYS; i++) {
		this.multiDelays[i].setDelayVolume(this.delayVolume);
	}
};

/**
 * Change the Low Pass filter frequency.
 *
 * @param {Number} dampFrequency low pass filter frequency. 0 to 44100 (depending on your maximum sampling frequency)
 */
Reverb.prototype.setDampFrequency = function (dampFrequency) {
	this.dampFrequency = dampFrequency;

	this.LOWPASSL.set(dampFrequency, 0);
	this.LOWPASSR.set(dampFrequency, 0);
};

/**
 * Process a given interleaved float value Array and copies and adds the reverb signal.
 *
 * @param {Array} samples Array containing Float values or a Float64Array
 *
 * @returns A new Float64Array interleaved buffer.
 */
Reverb.prototype.process = function (interleavedSamples) {
	// NB. Make a copy to put in the output samples to return.
	var outputSamples = new Float64Array(interleavedSamples.length);

	// Perform low pass on the input samples to mimick damp
	var leftRightMix = DSP.deinterleave(interleavedSamples);
	this.LOWPASSL.process(leftRightMix[DSP.LEFT]);
	this.LOWPASSR.process(leftRightMix[DSP.RIGHT]);
	var filteredSamples = DSP.interleave(
		leftRightMix[DSP.LEFT],
		leftRightMix[DSP.RIGHT],
	);

	var i;

	// Process MultiDelays in parallel
	for (i = 0; i < this.NR_OF_MULTIDELAYS; i++) {
		// Invert the signal of every even multiDelay
		outputSamples = DSP.mixSampleBuffers(
			outputSamples,
			this.multiDelays[i].process(filteredSamples),
			2 % i === 0,
			this.NR_OF_MULTIDELAYS,
		);
	}

	// Process SingleDelays in series
	var singleDelaySamples = new Float64Array(outputSamples.length);
	for (i = 0; i < this.NR_OF_SINGLEDELAYS; i++) {
		// Invert the signal of every even singleDelay
		singleDelaySamples = DSP.mixSampleBuffers(
			singleDelaySamples,
			this.singleDelays[i].process(outputSamples),
			2 % i === 0,
			1,
		);
	}

	// Apply the volume of the reverb signal
	for (i = 0; i < singleDelaySamples.length; i++) {
		singleDelaySamples[i] *= this.mixVolume;
	}

	// Mix the original signal with the reverb signal
	outputSamples = DSP.mixSampleBuffers(
		singleDelaySamples,
		interleavedSamples,
		0,
		1,
	);

	// Apply the master volume to the complete signal
	for (i = 0; i < outputSamples.length; i++) {
		outputSamples[i] *= this.masterVolume;
	}

	return outputSamples;
};

if (typeof module !== 'undefined' && module && module.exports) {
	module.exports = {
		DSP: DSP,
		DFT: DFT,
		FFT: FFT,
		RFFT: RFFT,
		Sampler: Sampler,
		Oscillator: Oscillator,
		ADSR: ADSR,
		IIRFilter: IIRFilter,
		IIRFilter2: IIRFilter2,
		WindowFunction: WindowFunction,
		sinh: sinh,
		Biquad: Biquad,
		GraphicalEq: GraphicalEq,
		MultiDelay: MultiDelay,
		SingleDelay: SingleDelay,
		Reverb: Reverb,
	};
}
