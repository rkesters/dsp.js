import { Channels, getChannel, Oscillator, RFFT, Waveforms } from '../src';
import { formatForPlot, plotData, runTest } from './helpers/audioHarness';
import {
	frameBufferLength,
	channels,
	rate,
	getFramebuffer,
} from './helpers/samples';

describe('FFT', () => {
	test('speed', () => {
		var iterations = 100;
		var fft = new RFFT(frameBufferLength / channels, rate);

		var calcFFT = function () {
			var fb = getFramebuffer(),
				signal = getChannel(Channels.MIX, fb);

			fft.forward(signal);
		};

		expect(runTest(calcFFT, iterations)).toBeLessThan(50);
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
			'RFFT_Signal2',
			{ style: 'lines' },
		);
		const N = 256;
		const bin = fs / N;
		const fft = new RFFT(N, fs);
		const data = fft
			.forward(signal.slice(0, N))
			.map((f) => (Math.abs(f) < 1e-4 ? 0 : f));

		await plotData(
			{
				RFFT: formatForPlot(
					[...data.keys()].map((x) => x * bin),
					data,
				),
			},
			'RFFT',
			{ style: 'impulses' },
		);
		expect(signal).toMatchSnapshot();
		expect(data).toMatchSnapshot();
		expect(data.length).toMatchInlineSnapshot(`128`);
		expect(signal.length).toMatchInlineSnapshot(`640`);
		const kth = 10 / bin;
		expect(kth).toMatchInlineSnapshot(`8`);
		expect(data[kth]).toMatchInlineSnapshot(`0.5`);
	});
});
