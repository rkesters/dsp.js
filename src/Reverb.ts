import {
	Channels,
	deinterleave,
	Filters,
	interleave,
	mixSampleBuffers,
} from './dsp';
import { IIRFilter2 } from './filters/IIRFilter2';
import { MultiDelay } from './MultiDelay';
import { SingleDelay } from './SingleDelay';

export class Reverb {
	protected NR_OF_MULTIDELAYS: number;
	protected NR_OF_SINGLEDELAYS: number;
	protected LOWPASSL: IIRFilter2;
	protected LOWPASSR: IIRFilter2;
	protected singleDelays: SingleDelay[];
	protected multiDelays: MultiDelay[];

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
	constructor(
		protected maxDelayInSamplesSize: number,
		protected delayInSamples: number,
		protected masterVolume: number,
		protected mixVolume: number,
		protected delayVolume: number,
		protected dampFrequency: number,
	) {
		this.NR_OF_MULTIDELAYS = 6;
		this.NR_OF_SINGLEDELAYS = 6;
		this.LOWPASSL = new IIRFilter2(
			Filters.LOWPASS,
			dampFrequency,
			0,
			44100,
		);
		this.LOWPASSR = new IIRFilter2(
			Filters.LOWPASS,
			dampFrequency,
			0,
			44100,
		);

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
	public setDelayInSamples(delayInSamples: number) {
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
	}

	/**
	 * Change the master volume.
	 *
	 * @param {Number} masterVolume Float value: 0.0 (silence), 1.0 (normal), >1.0 (amplify)
	 */
	public setMasterVolume(masterVolume: number) {
		this.masterVolume = masterVolume;
	}

	/**
	 * Change the reverb signal mix level.
	 *
	 * @param {Number} mixVolume Float value: 0.0 (silence), 1.0 (normal), >1.0 (amplify)
	 */
	public setMixVolume(mixVolume: number) {
		this.mixVolume = mixVolume;
	}

	/**
	 * Change all delays feedback volume.
	 *
	 * @param {Number} delayVolume Float value: 0.0 (silence), 1.0 (normal), >1.0 (amplify)
	 */
	public setDelayVolume(delayVolume: number) {
		this.delayVolume = delayVolume;

		var i;

		for (i = 0; i < this.NR_OF_SINGLEDELAYS; i++) {
			this.singleDelays[i].setDelayVolume(this.delayVolume);
		}

		for (i = 0; i < this.NR_OF_MULTIDELAYS; i++) {
			this.multiDelays[i].setDelayVolume(this.delayVolume);
		}
	}

	/**
	 * Change the Low Pass filter frequency.
	 *
	 * @param {Number} dampFrequency low pass filter frequency. 0 to 44100 (depending on your maximum sampling frequency)
	 */
	public setDampFrequency(dampFrequency: number) {
		this.dampFrequency = dampFrequency;

		this.LOWPASSL.set(dampFrequency, 0);
		this.LOWPASSR.set(dampFrequency, 0);
	}

	/**
	 * Process a given interleaved float value Array and copies and adds the reverb signal.
	 *
	 * @param {Array} samples Array containing Float values or a Float64Array
	 *
	 * @returns A new Float64Array interleaved buffer.
	 */
	public process(interleavedSamples: number[] | Float64Array) {
		// NB. Make a copy to put in the output samples to return.
		var outputSamples = new Float64Array(interleavedSamples.length);

		// Perform low pass on the input samples to mimick damp
		var leftRightMix = deinterleave(interleavedSamples);
		this.LOWPASSL.process(leftRightMix[Channels.LEFT]);
		this.LOWPASSR.process(leftRightMix[Channels.RIGHT]);
		var filteredSamples = interleave(
			leftRightMix[Channels.LEFT],
			leftRightMix[Channels.RIGHT],
		);

		var i;

		// Process MultiDelays in parallel
		for (i = 0; i < this.NR_OF_MULTIDELAYS; i++) {
			// Invert the signal of every even multiDelay
			outputSamples = mixSampleBuffers(
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
			singleDelaySamples = mixSampleBuffers(
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
		outputSamples = mixSampleBuffers(
			singleDelaySamples,
			interleavedSamples,
			false,
			1,
		);

		// Apply the master volume to the complete signal
		for (i = 0; i < outputSamples.length; i++) {
			outputSamples[i] *= this.masterVolume;
		}

		return outputSamples;
	}
}
