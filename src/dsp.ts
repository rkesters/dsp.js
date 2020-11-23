
type Buffer = number[] | Float64Array | Float32Array;

export type deinrleaveArg = {
	mix: Float64Array;
	left: Float64Array;
	right: Float64Array;
};

export enum Channels {
	LEFT = 0,
	RIGHT,
	MIX,
}

export enum Waveforms {
	SINE = 1,
	TRIANGLE = 2,
	SAW = 3,
	SQUARE = 4,
}

export enum Filters {
	LOWPASS = 0,
	HIGHPASS = 1,
	BANDPASS = 2,
	NOTCH = 3,
	LP12,
}

export enum Windows {
	BARTLETT = 1,
	BARTLETTHANN = 2,
	BLACKMAN = 3,
	COSINE = 4,
	GAUSS = 5,
	HAMMING = 6,
	HANN = 7,
	//LANCZOS = 8,
	RECTANGULAR = 9,
	TRIANGULAR = 10,
}

export enum LoopModes {
	OFF = 0,
	FW = 1,
	BW = 2,
	FWBW = 3,
}
export const TWO_PI = 2 * Math.PI;

export enum BiquadFilters {
	LPF = 0, // H(s) = 1 / (s^2 + s/Q + 1)
	HPF = 1, // H(s) = s^2 / (s^2 + s/Q + 1)
	BPF_CONSTANT_SKIRT = 2, // H(s) = s / (s^2 + s/Q + 1)  (constant skirt gain, peak gain = Q)
	BPF_CONSTANT_PEAK = 3, // H(s) = (s/Q) / (s^2 + s/Q + 1)      (constant 0 dB peak gain)
	NOTCH = 4, // H(s) = (s^2 + 1) / (s^2 + s/Q + 1)
	APF = 5, // H(s) = (s^2 - s/Q + 1) / (s^2 + s/Q + 1)
	PEAKING_EQ = 6, // H(s) = (s^2 + s*(A/Q) + 1) / (s^2 + s/(A*Q) + 1)
	LOW_SHELF = 7, // H(s) = A * (s^2 + (sqrt(A)/Q)*s + A)/(A*s^2 + (sqrt(A)/Q)*s + 1)
	HIGH_SHELF = 8, // H(s) = A * (A*s^2 + (sqrt(A)/Q)*s + 1)/(s^2 + (sqrt(A)/Q)*s + A)
}
export enum BiquadFiltersArgs {
	Q = 1,
	BW = 2,
	S = 3,
}

const deinterleaveChannel = {
	[Channels.MIX]: (
		buffer: Buffer,
		{ mix }: deinrleaveArg,
	) => {
		for (let i = 0, len = buffer.length / 2; i < len; i++) {
			mix[i] = (buffer[2 * i] + buffer[2 * i + 1]) / 2;
		}
		return mix;
	},
	[Channels.LEFT]: (
		buffer: Buffer,
		{ left }: deinrleaveArg,
	) => {
		for (let i = 0, len = buffer.length / 2; i < len; i++) {
			left[i] = buffer[2 * i];
		}
		return left;
	},
	[Channels.RIGHT]: (
		buffer: Buffer,
		{ right }: deinrleaveArg,
	) => {
		for (let i = 0, len = buffer.length / 2; i < len; i++) {
			right[i] = buffer[2 * i + 1];
		}
		return right;
	},
};
/**
 * Inverts the phase of a signal
 *
 * @param {Array} buffer A sample buffer
 *
 * @returns The inverted sample buffer
 */
export function invert(buffer: number[]): number[] {
	for (var i = 0, len = buffer.length; i < len; i++) {
		buffer[i] *= -1;
	}

	return buffer;
}

/**
 * Converts split-stereo (dual mono) sample buffers into a stereo interleaved sample buffer
 *
 * @param {Array} left  A sample buffer
 * @param {Array} right A sample buffer
 *
 * @returns The stereo interleaved buffer
 */
export function interleave(
	left: Buffer,
	right: Buffer,
): Float64Array {
	if (left.length !== right.length) {
		throw 'Can not interleave. Channel lengths differ.';
	}

	var stereoInterleaved = new Float64Array(left.length * 2);

	for (var i = 0, len = left.length; i < len; i++) {
		stereoInterleaved[2 * i] = left[i];
		stereoInterleaved[2 * i + 1] = right[i];
	}

	return stereoInterleaved;
}

/**
 * Converts a stereo-interleaved sample buffer into split-stereo (dual mono) sample buffers
 *
 * @param {Array} buffer A stereo-interleaved sample buffer
 *
 * @returns an Array containing left and right channels
 */
export function deinterleave(buffer: Buffer): Float64Array[];
export function deinterleave(
	buffer: Buffer,
	channel: Channels,
): Float64Array;
export function deinterleave(
	buffer: Buffer,
	channel?: Channels,
): Float64Array | Float64Array[] {
	const data: deinrleaveArg = {
		mix: new Float64Array(buffer.length / 2),
		left: new Float64Array(buffer.length / 2),
		right: new Float64Array(buffer.length / 2),
	};

	if (buffer.length / 2 !== data.left.length) {
		data.left = new Float64Array(buffer.length / 2);
		data.right = new Float64Array(buffer.length / 2);
		data.mix = new Float64Array(buffer.length / 2);
	}

	return channel
		? deinterleaveChannel[channel](buffer, data)
		: [
				deinterleaveChannel[Channels.LEFT](buffer, data),
				deinterleaveChannel[Channels.RIGHT](buffer, data),
		  ];
}

/**
 * Separates a channel from a stereo-interleaved sample buffer
 *
 * @param {Array}  buffer A stereo-interleaved sample buffer
 * @param {Number} channel A channel constant (LEFT, RIGHT, MIX)
 *
 * @returns an Array containing a signal mono sample buffer
 */
export function getChannel(channel: Channels, buffer: Buffer) {
	return deinterleave(buffer, channel);
}

/**
 * Helper method (for Reverb) to mix two (interleaved) samplebuffers. It's possible
 * to negate the second buffer while mixing and to perform a volume correction
 * on the final signal.
 *
 * @param {Array} sampleBuffer1 Array containing Float values or a Float64Array
 * @param {Array} sampleBuffer2 Array containing Float values or a Float64Array
 * @param {Boolean} negate When true inverts/flips the audio signal
 * @param {Number} volumeCorrection When you add multiple sample buffers, use this to tame your signal ;)
 *
 * @returns A new Float64Array interleaved buffer.
 */
export function mixSampleBuffers(
	sampleBuffer1: Buffer,
	sampleBuffer2: Buffer,
	negate: boolean,
	volumeCorrection: number,
) {
	var outputSamples = new Float64Array(sampleBuffer1);

	for (var i = 0; i < sampleBuffer1.length; i++) {
		outputSamples[i] +=
			(negate ? -sampleBuffer2[i] : sampleBuffer2[i]) / volumeCorrection;
	}

	return outputSamples;
}

// Find RMS of signal
export function RMS(buffer: number[]) {
	var total = 0;

	for (var i = 0, n = buffer.length; i < n; i++) {
		total += buffer[i] * buffer[i];
	}

	return Math.sqrt(total / n);
}

// Find Peak of signal
export function Peak(buffer: number[]) {
	var peak = 0;

	for (var i = 0, n = buffer.length; i < n; i++) {
		peak = Math.abs(buffer[i]) > peak ? Math.abs(buffer[i]) : peak;
	}

	return peak;
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
export function mag2db(buffer: Float64Array) {
	const minDb = -120;
	const minMag = Math.pow(10.0, minDb / 20.0);

	const log = Math.log10;
	const max = Math.max;

	return Float64Array.from(buffer.map((b) => 20.0 * log(max(b, minMag))));
}

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
export function freqz(b: number[], a: number[], wIn?: Float64Array) {
	var i, j;

	/* if (!wIn) {
		w = Float64Array(200);
		for (i = 0; i < w.length; i++) {
			w[i] = (TWO_PI / w.length) * i - Math.PI;
		}
	}
	*/

	const w: Float64Array =
		wIn ??
		Float64Array.from(
			[...Array(200).keys()].map(
				(i: number) => (TWO_PI / 200) * i - Math.PI,
			),
		);

	var result = new Float64Array(w.length);

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
}
