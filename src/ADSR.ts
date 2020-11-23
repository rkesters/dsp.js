export class ADSR {
	protected attackSamples: number;
	protected decaySamples: number;
	protected sustainSamples: number;
	protected releaseSamples: number;
	protected samplesProcessed: number;

	protected attack: number = 0;
	protected decay: number = 0;
	protected sustain: number = 0;
	protected release: number = 0;
	constructor(
		protected attackLength: number,
		protected decayLength: number,
		protected sustainLevel: number,
		protected sustainLength: number,
		protected releaseLength: number,
		protected sampleRate: number,
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
		this.update();

		this.samplesProcessed = 0;
	}

	// Updates the envelope sample positions
	protected update() {
		this.attack = this.attackSamples;
		this.decay = this.attack + this.decaySamples;
		this.sustain = this.decay + this.sustainSamples;
		this.release = this.sustain + this.releaseSamples;
	}

	public noteOn() {
		this.samplesProcessed = 0;
		this.sustainSamples = this.sustainLength * this.sampleRate;
		this.update();
	}

	public noteOff() {
		this.sustainSamples = this.samplesProcessed - this.decaySamples;
		this.update();
	}

	public processSample(sample: number) {
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
	}

	public value() {
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
	}

	public process(buffer: number[] | Float64Array) {
		for (var i = 0; i < buffer.length; i++) {
			buffer[i] *= this.value();

			this.samplesProcessed++;
		}

		return buffer;
	}

	public isActive() {
		if (
			this.samplesProcessed > this.release ||
			this.samplesProcessed === -1
		) {
			return false;
		} else {
			return true;
		}
	}

	public disable() {
		this.samplesProcessed = -1;
	}
}
