export abstract class Filter {
	constructor(
		public cutoff: number,
		public resonance: number,
		public sampleRate: number,
	) {}

	public abstract calcCoeff(cutoff: number, resonance: number): void;
	public abstract process(buffer: number[]): void;
	public abstract addEnvelope(envelope: any): void;
}
