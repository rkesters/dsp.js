import { Filter } from './Filter';

export class LP12 extends Filter {
	protected vibraPos: number;
	protected vibraSpeed: number;
	protected envelope: any;

	protected w: number = 0;
	protected q: number = 0;
	protected r: number = 0;
	protected c: number = 0;
	constructor(
		public cutoff: number,
		public resonance: number,
		public sampleRate: number,
	) {
		super(cutoff, resonance, sampleRate);

		this.vibraPos = 0;
		this.vibraSpeed = 0;
		this.envelope = false;
		this.calcCoeff(cutoff, resonance);
	}
	public calcCoeff(cutoff: number, resonance: number) {
		this.w = (2.0 * Math.PI * cutoff) / this.sampleRate;
		this.q =
			1.0 -
			this.w / (2.0 * (resonance + 0.5 / (1.0 + this.w)) + this.w - 2.0);
		this.r = this.q * this.q;
		this.c = this.r + 1.0 - 2.0 * Math.cos(this.w) * this.q;

		this.cutoff = cutoff;
		this.resonance = resonance;
	}

	public process(buffer: number[]) {
		for (var i = 0; i < buffer.length; i++) {
			this.vibraSpeed += (buffer[i] - this.vibraPos) * this.c;
			this.vibraPos += this.vibraSpeed;
			this.vibraSpeed *= this.r;

			/*
          var temp = this.vibraPos;
         
          if ( temp > 1.0 ) {
            temp = 1.0;
          } else if ( temp < -1.0 ) {
            temp = -1.0;
          } else if ( temp != temp ) {
            temp = 1;
          }
         
          buffer[i] = temp;
          */

			if (this.envelope) {
				buffer[i] =
					buffer[i] * (1 - this.envelope.value()) +
					this.vibraPos * this.envelope.value();
				this.envelope.samplesProcessed++;
			} else {
				buffer[i] = this.vibraPos;
			}
		}
	}

	public addEnvelope(envelope: any) {
		this.envelope = envelope;
	}
}
