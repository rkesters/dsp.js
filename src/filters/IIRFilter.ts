import { ADSR } from '../ADSR';
import { Filters } from '../dsp';
import { Filter } from './Filter';
import { LP12 } from './LP12';

export class IIRFilter {
	constructor(
		protected type: Filters,
		cutoff: number,
		resonance: number,
		protected sampleRate: number,
	) {
		this.filter = this.getFilter(cutoff, resonance, sampleRate);
	}

	protected filter: Filter | undefined;
	protected getFilter(cutoff: number, resonance: number, sampleRate: number) {
		switch (this.type) {
			case Filters.LOWPASS:
			case Filters.LP12:
				return new LP12(cutoff, resonance, sampleRate);
		}
	}

	public get cutoff(): number | undefined {
		return this.filter?.cutoff;
	}

	public get resonance(): number | undefined {
		return this.filter?.resonance;
	}

	public set(cutoff: number, resonance: number) {
		this.filter?.calcCoeff(cutoff, resonance);
	}

	public process(buffer: number[]) {
		this.filter?.process(buffer);
	}

	// Add an envelope to the filter
	addEnvelope(envelope: any) {
		if (envelope instanceof ADSR) {
			this.filter?.addEnvelope(envelope);
		} else {
			throw 'Not an envelope.';
		}
	}
}
