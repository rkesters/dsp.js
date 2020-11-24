import { Channels, FFT, getChannel, Oscillator, RFFT, Waveforms } from '../src';
import { formatForPlot, plotData, runTest } from './helpers/audioHarness';
import {
	frameBufferLength,
	channels,
	rate,
	getFramebuffer,
} from './helpers/samples';

function parsevalCheck(singal: Float64Array, H: Float64Array): boolean {
	const F: number =
		(1 / H.length) *
		H.reduce<number>((a: number, h: number): number => a + h ** 2, 0);
	const T: number = singal
		//.slice(0, H.length)
		.reduce((r, k) => r + Math.abs(k) ** 2, 0);

	console.log(`${T} === ${F} , ${singal.length} ${H.length}`);
	/*fs.outputFileSync(
		`test/parseval${count++}.txt`,
		t.reduce((a, d) => `${a}${d}\n`, ''),
	);*/
	return T === F;
}

describe('FFT', () => {
	test('speed', () => {
		var iterations = 100;
		var fft = new FFT(frameBufferLength / channels, rate);

		var calcFFT = function () {
			var fb = getFramebuffer(),
				signal = getChannel(Channels.MIX, fb);

			fft.forward(signal);
		};

		expect(runTest(calcFFT, iterations)).toBeLessThan(100);
	});

	test('correctness', async () => {
		const fc = 10,
			fs = 32 * fc,
			t = 2,
			d = t * fs;
		const o: Oscillator = new Oscillator(
			Waveforms.COS,
			fc,
			0.5,
			d,
			fs,
			Math.PI / 6,
		);
		const signal = o.generate();
		await plotData(
			{
				signal: formatForPlot(
					[...signal.keys()].map((x) => x / fs),
					signal,
				),
			},
			'Signal2',
			{ style: 'lines' },
		);
		const N = 256;
		const bin = fs / N;
		const fft = new FFT(N, fs);
		const data = fft
			.forward(signal.slice(0, N))
			.map((f) => (Math.abs(f) < 1e-4 ? 0 : f));

		await plotData(
			{
				FFT: formatForPlot(
					[...data.keys()].map((x) => x * bin),
					data,
				),
			},
			'FFT',
			{ style: 'impulses' },
		);
		expect(signal).toMatchSnapshot();
		expect(data).toMatchSnapshot();
		expect(data.length).toMatchInlineSnapshot(`128`);
		expect(signal.length).toMatchInlineSnapshot(`640`);
		const kth = 10 / bin;
		expect(kth).toMatchInlineSnapshot(`8`);
		expect(data[kth]).toMatchInlineSnapshot(`0.5000000000000001`);
	});
});
