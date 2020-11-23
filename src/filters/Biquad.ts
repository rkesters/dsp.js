import { BiquadFilters, BiquadFiltersArgs, TWO_PI } from '../dsp';

function sinh(arg: number) {
	// Returns the hyperbolic sine of the number, defined as (exp(number) - exp(-number))/2
	//
	// version: 1004.2314
	// discuss at: http://phpjs.org/functions/sinh    // +   original by: Onno Marsman
	// *     example 1: sinh(-0.9834330348825909);
	// *     returns 1: -1.1497971402636502
	return (Math.exp(arg) - Math.exp(-arg)) / 2;
}
export class Biquad {
	protected x_1_l: number;
	protected x_2_l: number;
	protected y_1_l: number;
	protected y_2_l: number;
	protected x_1_r: number;
	protected x_2_r: number;
	protected y_1_r: number;
	protected y_2_r: number;
	public b0: number;
	public a0: number;
	public b1: number;
	public a1: number;
	public b2: number;
	public a2: number;
	protected parameterType: number;

	public b0a0: number;
	public b1a0: number;
	public b2a0: number;
	public a1a0: number;
	public a2a0: number;

	protected f0: number;
	protected dBgain: number;
	protected Q: number;
	protected BW: number;
	protected S: number;

	constructor(protected type: BiquadFilters, protected Fs: number) {
		this.parameterType = BiquadFiltersArgs.Q; // type of the parameter

		this.x_1_l = 0;
		this.x_2_l = 0;
		this.y_1_l = 0;
		this.y_2_l = 0;

		this.x_1_r = 0;
		this.x_2_r = 0;
		this.y_1_r = 0;
		this.y_2_r = 0;

		this.b0 = 1;
		this.a0 = 1;

		this.b1 = 0;
		this.a1 = 0;

		this.b2 = 0;
		this.a2 = 0;

		this.b0a0 = this.b0 / this.a0;
		this.b1a0 = this.b1 / this.a0;
		this.b2a0 = this.b2 / this.a0;
		this.a1a0 = this.a1 / this.a0;
		this.a2a0 = this.a2 / this.a0;

		this.f0 = 3000; // "wherever it's happenin', man."  Center Frequency or
		// Corner Frequency, or shelf midpoint frequency, depending
		// on which filter type.  The "significant frequency".

		this.dBgain = 12; // used only for peaking and shelving filters

		this.Q = 1; // the EE kind of definition, except for peakingEQ in which A*Q is
		// the classic EE Q.  That adjustment in definition was made so that
		// a boost of N dB followed by a cut of N dB for identical Q and
		// f0/Fs results in a precisely flat unity gain filter or "wire".

		this.BW = -3; // the bandwidth in octaves (between -3 dB frequencies for BPF
		// and notch or between midpoint (dBgain/2) gain frequencies for
		// peaking EQ

		this.S = 1; // a "shelf slope" parameter (for shelving EQ only).  When S = 1,
		// the shelf slope is as steep as it can be and remain monotonically
		// increasing or decreasing gain with frequency.  The shelf slope, in
		// dB/octave, remains proportional to S for all other values for a
		// fixed f0/Fs and dBgain.
	}
	public coefficients() {
		var b = [this.b0, this.b1, this.b2];
		var a = [this.a0, this.a1, this.a2];
		return { b: b, a: a };
	}

	public setFilterType(type: BiquadFilters) {
		this.type = type;
		this.recalculateCoefficients();
	}

	public setSampleRate(rate: number) {
		this.Fs = rate;
		this.recalculateCoefficients();
	}

	public setQ(q: number) {
		this.parameterType = BiquadFiltersArgs.Q;
		this.Q = Math.max(Math.min(q, 115.0), 0.001);
		this.recalculateCoefficients();
	}

	public setBW(bw: number) {
		this.parameterType = BiquadFiltersArgs.BW;
		this.BW = bw;
		this.recalculateCoefficients();
	}

	public setS(s: number) {
		this.parameterType = BiquadFiltersArgs.S;
		this.S = Math.max(Math.min(s, 5.0), 0.0001);
		this.recalculateCoefficients();
	}

	public setF0(freq: number) {
		this.f0 = freq;
		this.recalculateCoefficients();
	}

	public setDbGain(g: number) {
		this.dBgain = g;
		this.recalculateCoefficients();
	}
	public recalculateCoefficients() {
		var A;
		if (
			this.type === BiquadFilters.PEAKING_EQ ||
			this.type === BiquadFilters.LOW_SHELF ||
			this.type === BiquadFilters.HIGH_SHELF
		) {
			A = Math.pow(10, this.dBgain / 40); // for peaking and shelving EQ filters only
		} else {
			A = Math.sqrt(Math.pow(10, this.dBgain / 20));
		}

		var w0 = (TWO_PI * this.f0) / this.Fs;

		var cosw0 = Math.cos(w0);
		var sinw0 = Math.sin(w0);

		var alpha = 0;

		switch (this.parameterType) {
			case BiquadFiltersArgs.Q:
				alpha = sinw0 / (2 * this.Q);
				break;

			case BiquadFiltersArgs.BW:
				alpha = sinw0 * sinh(((Math.LN2 / 2) * this.BW * w0) / sinw0);
				break;

			case BiquadFiltersArgs.S:
				alpha =
					(sinw0 / 2) * Math.sqrt((A + 1 / A) * (1 / this.S - 1) + 2);
				break;
		}

		/**
            FYI: The relationship between bandwidth and Q is
                 1/Q = 2*sinh(ln(2)/2*BW*w0/sin(w0))     (digital filter w BLT)
            or   1/Q = 2*sinh(ln(2)/2*BW)             (analog filter prototype)
    
            The relationship between shelf slope and Q is
                 1/Q = sqrt((A + 1/A)*(1/S - 1) + 2)
        */

		var coeff;

		switch (this.type) {
			case BiquadFilters.LPF: // H(s) = 1 / (s^2 + s/Q + 1)
				this.b0 = (1 - cosw0) / 2;
				this.b1 = 1 - cosw0;
				this.b2 = (1 - cosw0) / 2;
				this.a0 = 1 + alpha;
				this.a1 = -2 * cosw0;
				this.a2 = 1 - alpha;
				break;

			case BiquadFilters.HPF: // H(s) = s^2 / (s^2 + s/Q + 1)
				this.b0 = (1 + cosw0) / 2;
				this.b1 = -(1 + cosw0);
				this.b2 = (1 + cosw0) / 2;
				this.a0 = 1 + alpha;
				this.a1 = -2 * cosw0;
				this.a2 = 1 - alpha;
				break;

			case BiquadFilters.BPF_CONSTANT_SKIRT: // H(s) = s / (s^2 + s/Q + 1)  (constant skirt gain, peak gain = Q)
				this.b0 = sinw0 / 2;
				this.b1 = 0;
				this.b2 = -sinw0 / 2;
				this.a0 = 1 + alpha;
				this.a1 = -2 * cosw0;
				this.a2 = 1 - alpha;
				break;

			case BiquadFilters.BPF_CONSTANT_PEAK: // H(s) = (s/Q) / (s^2 + s/Q + 1)      (constant 0 dB peak gain)
				this.b0 = alpha;
				this.b1 = 0;
				this.b2 = -alpha;
				this.a0 = 1 + alpha;
				this.a1 = -2 * cosw0;
				this.a2 = 1 - alpha;
				break;

			case BiquadFilters.NOTCH: // H(s) = (s^2 + 1) / (s^2 + s/Q + 1)
				this.b0 = 1;
				this.b1 = -2 * cosw0;
				this.b2 = 1;
				this.a0 = 1 + alpha;
				this.a1 = -2 * cosw0;
				this.a2 = 1 - alpha;
				break;

			case BiquadFilters.APF: // H(s) = (s^2 - s/Q + 1) / (s^2 + s/Q + 1)
				this.b0 = 1 - alpha;
				this.b1 = -2 * cosw0;
				this.b2 = 1 + alpha;
				this.a0 = 1 + alpha;
				this.a1 = -2 * cosw0;
				this.a2 = 1 - alpha;
				break;

			case BiquadFilters.PEAKING_EQ: // H(s) = (s^2 + s*(A/Q) + 1) / (s^2 + s/(A*Q) + 1)
				this.b0 = 1 + alpha * A;
				this.b1 = -2 * cosw0;
				this.b2 = 1 - alpha * A;
				this.a0 = 1 + alpha / A;
				this.a1 = -2 * cosw0;
				this.a2 = 1 - alpha / A;
				break;

			case BiquadFilters.LOW_SHELF: // H(s) = A * (s^2 + (sqrt(A)/Q)*s + A)/(A*s^2 + (sqrt(A)/Q)*s + 1)
				coeff =
					sinw0 * Math.sqrt((A ^ (2 + 1)) * (1 / this.S - 1) + 2 * A);
				this.b0 = A * (A + 1 - (A - 1) * cosw0 + coeff);
				this.b1 = 2 * A * (A - 1 - (A + 1) * cosw0);
				this.b2 = A * (A + 1 - (A - 1) * cosw0 - coeff);
				this.a0 = A + 1 + (A - 1) * cosw0 + coeff;
				this.a1 = -2 * (A - 1 + (A + 1) * cosw0);
				this.a2 = A + 1 + (A - 1) * cosw0 - coeff;
				break;

			case BiquadFilters.HIGH_SHELF: // H(s) = A * (A*s^2 + (sqrt(A)/Q)*s + 1)/(s^2 + (sqrt(A)/Q)*s + A)
				coeff =
					sinw0 * Math.sqrt((A ^ (2 + 1)) * (1 / this.S - 1) + 2 * A);
				this.b0 = A * (A + 1 + (A - 1) * cosw0 + coeff);
				this.b1 = -2 * A * (A - 1 + (A + 1) * cosw0);
				this.b2 = A * (A + 1 + (A - 1) * cosw0 - coeff);
				this.a0 = A + 1 - (A - 1) * cosw0 + coeff;
				this.a1 = 2 * (A - 1 - (A + 1) * cosw0);
				this.a2 = A + 1 - (A - 1) * cosw0 - coeff;
				break;
		}

		this.b0a0 = this.b0 / this.a0;
		this.b1a0 = this.b1 / this.a0;
		this.b2a0 = this.b2 / this.a0;
		this.a1a0 = this.a1 / this.a0;
		this.a2a0 = this.a2 / this.a0;
	}

	public process(buffer: Float64Array) {
		//y[n] = (b0/a0)*x[n] + (b1/a0)*x[n-1] + (b2/a0)*x[n-2]
		//       - (a1/a0)*y[n-1] - (a2/a0)*y[n-2]

		var len = buffer.length;
		var output = new Float64Array(len);

		for (var i = 0; i < buffer.length; i++) {
			output[i] =
				this.b0a0 * buffer[i] +
				this.b1a0 * this.x_1_l +
				this.b2a0 * this.x_2_l -
				this.a1a0 * this.y_1_l -
				this.a2a0 * this.y_2_l;
			this.y_2_l = this.y_1_l;
			this.y_1_l = output[i];
			this.x_2_l = this.x_1_l;
			this.x_1_l = buffer[i];
		}

		return output;
	}

	public processStereo(buffer: Float64Array) {
		//y[n] = (b0/a0)*x[n] + (b1/a0)*x[n-1] + (b2/a0)*x[n-2]
		//       - (a1/a0)*y[n-1] - (a2/a0)*y[n-2]

		var len = buffer.length;
		var output = new Float64Array(len);

		for (var i = 0; i < len / 2; i++) {
			output[2 * i] =
				this.b0a0 * buffer[2 * i] +
				this.b1a0 * this.x_1_l +
				this.b2a0 * this.x_2_l -
				this.a1a0 * this.y_1_l -
				this.a2a0 * this.y_2_l;
			this.y_2_l = this.y_1_l;
			this.y_1_l = output[2 * i];
			this.x_2_l = this.x_1_l;
			this.x_1_l = buffer[2 * i];

			output[2 * i + 1] =
				this.b0a0 * buffer[2 * i + 1] +
				this.b1a0 * this.x_1_r +
				this.b2a0 * this.x_2_r -
				this.a1a0 * this.y_1_r -
				this.a2a0 * this.y_2_r;
			this.y_2_r = this.y_1_r;
			this.y_1_r = output[2 * i + 1];
			this.x_2_r = this.x_1_r;
			this.x_1_r = buffer[2 * i + 1];
		}

		return output;
	}
}
