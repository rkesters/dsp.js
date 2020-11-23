import { ADSR } from '../ADSR';
import { Filters } from '../dsp';
import { Filter } from './Filter';

export class IIRFilter2 extends Filter {
	protected f: Float64Array;
	protected freq: number = 0;
	protected damp: number = 0;

	protected envelope: any;
	constructor(
		public type: Filters,
		public cutoff: number,
		public resonance: number,
		public sampleRate: number,
	) {
		super(cutoff, resonance, sampleRate);

		this.f = new Float64Array(4);
		this.f[0] = 0.0; // lp
		this.f[1] = 0.0; // hp
		this.f[2] = 0.0; // bp
		this.f[3] = 0.0; // br

		this.calcCoeff(cutoff, resonance);
	}

	public calcCoeff(cutoff: number, resonance: number) {
		this.freq =
			2 *
			Math.sin(Math.PI * Math.min(0.25, cutoff / (this.sampleRate * 2)));
		this.damp = Math.min(
			2 * (1 - Math.pow(resonance, 0.25)),
			Math.min(2, 2 / this.freq - this.freq * 0.5),
		);
	}

	public process(buffer: number[] | Float64Array) {
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
	}

	public addEnvelope(envelope: any) {
		if (envelope instanceof ADSR) {
			this.envelope = envelope;
		} else {
			throw 'This is not an envelope.';
		}
	}

	public set(cutoff: number, resonance: number) {
		this.calcCoeff(cutoff, resonance);
	}
}
