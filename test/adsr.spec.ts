import { ADSR, Channels, getChannel } from '../src';
import { runTest } from './helpers/audioHarness';
import { getFramebuffer } from './helpers/samples';

describe('ADSR', () => {
	test('Speed', () => {
		const iterations = 1000,
			envelope = new ADSR(0.01, 0.1, 0.5, 0.1, 0.2, 44100);

		var calcADSR = function () {
			var fb: Float32Array = getFramebuffer(),
				signal = getChannel(Channels.MIX, fb);

			envelope.process(signal);
		};

		const totalTime = runTest(calcADSR, iterations);

		expect(totalTime).toBeLessThan(60);
	});

	test('Process', () => {
		const envelope = new ADSR(0.01, 0.1, 0.5, 0.1, 0.2, 44100);

		var fb: Float32Array = getFramebuffer(),
			signal = getChannel(Channels.MIX, fb);

		const data = envelope.process(signal);

		expect(data).toMatchSnapshot();
	});
});
