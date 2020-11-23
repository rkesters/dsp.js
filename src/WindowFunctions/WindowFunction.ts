import { TWO_PI, Windows } from '../dsp';

type WindowingFunction = (
	length: number,
	index: number,
	alpha: number,
) => number;

export class WindowFunction {
	constructor(protected type: Windows, protected alpha: number) {
		switch (type) {
			case Windows.BARTLETT:
				this.func = WindowFunction.Bartlett;
				break;

			case Windows.BARTLETTHANN:
				this.func = WindowFunction.BartlettHann;
				break;

			case Windows.BLACKMAN:
				this.func = WindowFunction.Blackman;
				this.alpha = this.alpha || 0.16;
				break;

			case Windows.COSINE:
				this.func = WindowFunction.Cosine;
				break;

			case Windows.GAUSS:
				this.func = WindowFunction.Gauss;
				this.alpha = this.alpha || 0.25;
				break;

			case Windows.HAMMING:
				this.func = WindowFunction.Hamming;
				break;

			case Windows.HANN:
				this.func = WindowFunction.Hann;
				break;

			/*case Windows.LANCZOS:
				this.func = WindowFunction.Lanczoz;
				break;*/

			case Windows.RECTANGULAR:
				this.func = WindowFunction.Rectangular;
				break;

			case Windows.TRIANGULAR:
				this.func = WindowFunction.Triangular;
				break;
		}
	}

	protected func: WindowingFunction;

	public process(buffer: number[]) {
		var length = buffer.length;
		for (var i = 0; i < length; i++) {
			buffer[i] *= this.func(length, i, this.alpha);
		}
		return buffer;
	}

	public static Bartlett(length: number, index: number): number {
		return (
			(2 / (length - 1)) *
			((length - 1) / 2 - Math.abs(index - (length - 1) / 2))
		);
	}

	public static BartlettHann = function (length: number, index: number) {
		return (
			0.62 -
			0.48 * Math.abs(index / (length - 1) - 0.5) -
			0.38 * Math.cos((TWO_PI * index) / (length - 1))
		);
	};

	public static Blackman = function (
		length: number,
		index: number,
		alpha: number,
	) {
		var a0 = (1 - alpha) / 2;
		var a1 = 0.5;
		var a2 = alpha / 2;

		return (
			a0 -
			a1 * Math.cos((TWO_PI * index) / (length - 1)) +
			a2 * Math.cos((4 * Math.PI * index) / (length - 1))
		);
	};

	public static Cosine = function (length: number, index: number) {
		return Math.cos((Math.PI * index) / (length - 1) - Math.PI / 2);
	};

	public static Gauss = function (
		length: number,
		index: number,
		alpha: number,
	) {
		return Math.pow(
			Math.E,
			-0.5 *
				Math.pow(
					(index - (length - 1) / 2) / ((alpha * (length - 1)) / 2),
					2,
				),
		);
	};

	public static Hamming = function (length: number, index: number) {
		return 0.54 - 0.46 * Math.cos((TWO_PI * index) / (length - 1));
	};

	public static Hann = function (length: number, index: number) {
		return 0.5 * (1 - Math.cos((TWO_PI * index) / (length - 1)));
	};

	public static Lanczos = function (length: number, index: number) {
		var x = (2 * index) / (length - 1) - 1;
		return Math.sin(Math.PI * x) / (Math.PI * x);
	};

	public static Rectangular = function (length: number, index: number) {
		return 1;
	};

	public static Triangular = function (length: number, index: number) {
		return (2 / length) * (length / 2 - Math.abs(index - (length - 1) / 2));
	};
}
