import { Worker } from 'worker_threads';

require('sharp'); // see https://github.com/lovell/sharp/issues/2263#issuecomment-645523303

const imageResizer = function (imagePath: string, size: { w: number; h: number }, outputPath: string) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(__dirname + '/thumbs-worker.js', {
            workerData: { imagePath: imagePath, size: size, outputPath: outputPath }
        });

        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => {
            if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
        });
    });
};

export default imageResizer;
