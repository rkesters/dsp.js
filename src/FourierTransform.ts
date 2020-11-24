export abstract class FourierTransform {
	public constructor(
		protected bufferSize: number,
		protected sampleRate: number,
	) {
		this.bandwidth = ((2 / bufferSize) * sampleRate) / 2;
		this.spectrum = new Float64Array(bufferSize / 2);
		this.real = new Float64Array(bufferSize);
		this.imag = new Float64Array(bufferSize);
		this.peakBand = 0;
		this.peak = 0;
	}
	protected bandwidth: number;

	protected spectrum: Float64Array;
	protected real: Float64Array;
	protected imag: Float64Array;

	protected peakBand: number = 0;
	protected peak: number = 0;

	/**
	 * Calculates the *middle* frequency of an FFT band.
	 *
	 * @param {Number} index The index of the FFT band.
	 *
	 * @returns The middle frequency in Hz.
	 */
	public getBandFrequency(index: number) {
		return this.bandwidth * index + this.bandwidth / 2;
	}

	public calculateSpectrum(): Float64Array {
		let spectrum = this.spectrum,
			real = this.real,
			imag = this.imag,
			bSi = 2 / this.bufferSize,
			sqrt = Math.sqrt,
			rval,
			ival,
			mag;

		for (let i = 0, N = this.bufferSize / 2; i < N; i++) {
			rval = real[i];
			ival = imag[i];
			mag = bSi * sqrt(rval * rval + ival * ival);

			if (mag > this.peak) {
				this.peakBand = i;
				this.peak = mag;
			}

			spectrum[i] = mag;
		}
		return spectrum;
	}
}
