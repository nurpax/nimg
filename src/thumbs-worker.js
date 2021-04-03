// Intentionally use .js as not sure how to use Worker() TypeScript.

const { parentPort, workerData } = require('worker_threads');
const sharp = require('sharp');

async function resize() {
    const { imagePath, size, outputPath } = workerData;

    await sharp(imagePath).resize(size.w, size.h, { fit: 'cover' }).toFile(outputPath);

    // sending message back to main thread
    parentPort.postMessage({ done: true });
}
resize();
