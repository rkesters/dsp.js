let startTime: number, totalTime: number;

export function calcTime() {
	return (totalTime = new Date().getTime() - startTime);
}

export function printResults(iterations: number) {
	console.log(
		`Total Time: ${totalTime} ms for ${iterations} iterations, ${
			totalTime / iterations
		}ms per iteration.`,
	);
}

export function runTest(test: () => void, iterations: number) {
	startTime = new Date().getTime();
	for (var i = 0; i < iterations; i++) {
		test();
	}
	calcTime();
	printResults(iterations);

	return totalTime;
}
import plot from '@stoqey/gnuplot';
import { PlotOptions } from '@stoqey/gnuplot/dist/interfaces';
import { Buffer } from '../../src/dsp';
export async function plotData(
	data: { [k: string]: Map<number | string, number | string> },
	title: string,
	options: Partial<PlotOptions> = {},
) {
	const filename = options?.format ?? `test/pics/${title}.png`;
	await plot({
		title,
		data,
		style: 'impulses',
		filename,
		format: 'png',
		...options,
	});
}

export function formatForPlot(x: number[], y: Buffer) {
	const out = new Map<number, number>();
	x.forEach((xx, i) => {
		out.set(xx, y[i]);
	});

	return out;
}
