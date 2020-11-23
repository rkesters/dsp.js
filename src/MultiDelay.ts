export class MultiDelay {
	protected delayBufferSamples: Float64Array;
	protected delayInputPointer: number;
	protected delayOutputPointer: number;
	constructor(
		protected maxDelayInSamplesSize: number,
		protected delayInSamples: number,
		protected masterVolume: number,
		protected delayVolume: number,
	) {
		this.delayBufferSamples = new Float64Array(maxDelayInSamplesSize); // The maximum size of delay
		this.delayInputPointer = delayInSamples;
		this.delayOutputPointer = 0;
	}

	/**
	 * Change the delay time in samples.
	 *
	 * @param {Number} delayInSamples Delay in samples
	 */
	public setDelayInSamples(delayInSamples: number) {
		this.delayInSamples = delayInSamples;

		this.delayInputPointer = this.delayOutputPointer + delayInSamples;

		if (this.delayInputPointer >= this.delayBufferSamples.length - 1) {
			this.delayInputPointer =
				this.delayInputPointer - this.delayBufferSamples.length;
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
	 * Change the delay feedback volume.
	 *
	 * @param {Number} delayVolume Float value: 0.0 (silence), 1.0 (normal), >1.0 (amplify)
	 */
	public setDelayVolume(delayVolume: number) {
		this.delayVolume = delayVolume;
	}

	/**
	 * Process a given interleaved or mono non-interleaved float value Array and adds the delayed audio.
	 *
	 * @param {Array} samples Array containing Float values or a Float64Array
	 *
	 * @returns A new Float64Array interleaved or mono non-interleaved as was fed to this function.
	 */
	public process(samples: number[] | Float64Array) {
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
	}
}
