import { LoopModes, getChannel, Channels } from './dsp';

export class Sampler {
	protected loaded: boolean;
	protected samples: Float64Array;
	protected rawSamples: number[];
	protected signal: Float64Array;
	protected frameCount: number;
	protected envelope: any;
	protected amplitude: number;
	protected rootFrequency: number;
	protected frequency: number;
	protected step: number;
	protected duration: number;
	protected samplesProcessed: number;
	protected playhead: number;
	protected audio: any;
	constructor(
		protected file: string,
		protected bufferSize: number,
		protected sampleRate: number,
		protected playStart: number = 0, // 0%
		protected playEnd: number = 1, // 100%
		protected loopStart: number = 0,
		protected loopEnd: number = 1,
		protected loopMode: number = LoopModes.OFF,
	) {
		this.loaded = false;
		this.rawSamples = [];
		this.samples = new Float64Array();
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

		//var audio = /* new Audio();*/ document.createElement('AUDIO');
		/*
		this.audio.addEventListener('MozAudioAvailable', this.loadSamples, false);
		this.audio.addEventListener('loadedmetadata', this.loadMetaData, false);
		this.audio.addEventListener('ended', this.loadComplete, false);
		this.audio.src = file;
		this.audio.play();
		*/
	}

	protected loadSamples(event: any) {
		let buffer = getChannel(Channels.MIX, event.frameBuffer);
		this.rawSamples = [...buffer];
	}

	protected loadComplete() {
		// convert fle xible js array into a fast typed array
		this.samples = new Float64Array(this.rawSamples);
		this.loaded = true;
	}

	protected loadMetaData() {
		this.duration = this.audio.duration;
	}

	public applyEnvelope() {
		this.envelope.process(this.signal);
		return this.signal;
	}

	public generate() {
		var frameOffset = this.frameCount * this.bufferSize;

		var loopWidth =
			this.playEnd * this.samples.length -
			this.playStart * this.samples.length;
		var playStartSamples = this.playStart * this.samples.length; // ie 0.5 -> 50% of the length
		var playEndSamples = this.playEnd * this.samples.length; // ie 0.5 -> 50% of the length
		var offset;

		for (var i = 0; i < this.bufferSize; i++) {
			switch (this.loopMode) {
				case LoopModes.OFF:
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

				case LoopModes.FW:
					this.playhead = Math.round(
						((this.samplesProcessed * this.step) % loopWidth) +
							playStartSamples,
					);
					if (this.playhead < this.playEnd * this.samples.length) {
						this.signal[i] =
							this.samples[this.playhead] * this.amplitude;
					}
					break;

				case LoopModes.BW:
					this.playhead =
						playEndSamples -
						Math.round(
							(this.samplesProcessed * this.step) % loopWidth,
						);
					if (this.playhead < this.playEnd * this.samples.length) {
						this.signal[i] =
							this.samples[this.playhead] * this.amplitude;
					}
					break;

				case LoopModes.FWBW:
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
	}

	public setFreq(frequency: number) {
		var totalProcessed = this.samplesProcessed * this.step;
		this.frequency = frequency;
		this.step = this.frequency / this.rootFrequency;
		this.samplesProcessed = Math.round(totalProcessed / this.step);
	}

	public reset() {
		this.samplesProcessed = 0;
		this.playhead = 0;
	}
}
