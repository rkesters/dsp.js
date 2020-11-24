import { TWO_PI, Waveforms } from './dsp';

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
export class Oscillator {
	protected frameCount: number;

	protected waveTableLength: number;

	protected cyclesPerSample: number;

	protected signal: Float64Array;
	protected envelope: any;
	protected waveTable: Float64Array;
	protected static WaveTable: { [k in Waveforms]: Float64Array };

	constructor(
		protected type: Waveforms,
		protected frequency: number,
		protected amplitude: number,
		protected bufferSize: number,
		protected sampleRate: number,
		protected theta: number = 0,
	) {
		this.frameCount = 0;
		this.waveTableLength = 2048;
		this.cyclesPerSample = frequency / sampleRate;

		this.signal = new Float64Array(bufferSize);
		this.envelope = null;
		this.generateWaveTable();

		this.waveTable = Oscillator.WaveTable[this.type];
	}

	protected generateWaveTable() {
		if (Oscillator.WaveTable && Oscillator.WaveTable[this.type]) {
			return;
		}
		const table = new Float64Array(2048);
		var waveTableTime = this.waveTableLength / this.sampleRate;
		var waveTableHz = 1 / waveTableTime;

		for (var i = 0; i < this.waveTableLength; i++) {
			table[i] = this.func((i * waveTableHz) / this.sampleRate);
		}

		Oscillator.WaveTable = {
			...Oscillator.WaveTable,
			[this.type]: table,
		};
	}
	protected func(step: number) {
		switch (this.type) {
			case Waveforms.TRIANGLE:
				return Oscillator.Triangle(step);
			case Waveforms.SAW:
				return Oscillator.Saw(step);
			case Waveforms.SQUARE:
				return Oscillator.Square(step);
			case Waveforms.COS:
				return Oscillator.Cos(step);
			default:
			case Waveforms.SINE:
				return Oscillator.Sine(step);
		}
	}
	/**
	 * Set the amplitude of the signal
	 *
	 * @param {Number} amplitude The amplitude of the signal (between 0 and 1)
	 */
	public setAmp(amplitude: number) {
		if (amplitude >= 0 && amplitude <= 1) {
			this.amplitude = amplitude;
		} else {
			throw 'Amplitude out of range (0..1).';
		}
	}

	/**
	 * Set the frequency of the signal
	 *
	 * @param {Number} frequency The frequency of the signal
	 */
	public setFreq(frequency: number) {
		this.frequency = frequency;
		this.cyclesPerSample = frequency / this.sampleRate;
	}

	public add(oscillator: Oscillator) {
		for (var i = 0; i < this.bufferSize; i++) {
			//this.signal[i] += oscillator.valueAt(i);
			this.signal[i] += oscillator.signal[i];
		}

		return this.signal;
	}

	public addSignal(signal: number[]) {
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
	}

	public addEnvelope(envelope: any) {
		this.envelope = envelope;
	}

	public applyEnvelope() {
		this.envelope.process(this.signal);
	}

	public valueAt(offset: number): number {
		return this.waveTable[offset % this.waveTableLength];
	}

	public generate() {
		var frameOffset = this.frameCount * this.bufferSize;
		var step = (this.waveTableLength * this.frequency) / this.sampleRate;
		var offset: number;

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
	}

	public static Sine(step: number) {
		return Math.sin(TWO_PI * step);
	}

	public static Cos(step: number, theta: number = 0) {
		return Math.cos(TWO_PI * step + theta);
	}

	public static Square(step: number) {
		return step < 0.5 ? 1 : -1;
	}

	public static Saw(step: number) {
		return 2 * (step - Math.round(step));
	}

	public static Triangle(step: number) {
		return 1 - 4 * Math.abs(Math.round(step) - step);
	}

	public static Pulse(step: number) {
		// stub
	}
}
