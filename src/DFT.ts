import { FourierTransform } from './FourierTransform';

/**
 * DFT is a class for calculating the Discrete Fourier Transform of a signal.
 *
 * @param {Number} bufferSize The size of the sample buffer to be computed
 * @param {Number} sampleRate The sampleRate of the buffer (eg. 44100)
 *
 * @constructor
 */
export class DFT extends FourierTransform {
	protected sinTable: Float64Array;
	protected cosTable: Float64Array;
	public constructor(bufferSize: number, sampleRate: number) {
		super(bufferSize, sampleRate);

		let N = (bufferSize / 2) * bufferSize,
			TWO_PI = 2 * Math.PI;

		this.sinTable = new Float64Array(N);
		this.cosTable = new Float64Array(N);

		for (let i = 0; i < N; i++) {
			this.sinTable[i] = Math.sin((i * TWO_PI) / bufferSize);
			this.cosTable[i] = Math.cos((i * TWO_PI) / bufferSize);
		}
	}

	/**
	 * Performs a forward transform on the sample buffer.
	 * Converts a time domain signal to frequency domain spectra.
	 *
	 * @param {Array} buffer The sample buffer
	 *
	 * @returns The frequency spectrum array
	 */
	public forward(buffer: number[]) {
		let real = this.real,
			imag = this.imag,
			rval,
			ival;

		for (let k = 0; k < this.bufferSize / 2; k++) {
			rval = 0.0;
			ival = 0.0;

			for (let n = 0; n < buffer.length; n++) {
				rval += this.cosTable[k * n] * buffer[n];
				ival += this.sinTable[k * n] * buffer[n];
			}

			real[k] = rval;
			imag[k] = ival;
		}

		return this.calculateSpectrum();
	}
}
