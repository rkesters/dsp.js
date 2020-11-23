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
