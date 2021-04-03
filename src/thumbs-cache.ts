import imageResize from './thumbs-main';
import { promises as fsp, Stats, constants } from 'fs';
import * as path from 'path';

import crypto from 'crypto';

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function cacheKey(sourcePath, size: { w: number; h: number }, stat: Stats) {
    return `${sourcePath}-${JSON.stringify(size)}-${stat.mtime.toISOString()}.png`;
}

export async function makeThumbnails(
    filelist: Promise<string[]>,
    sourceDir: string,
    cacheDir: string,
    options: {
        size: { w: number; h: number };
    }
): Promise<{ [name: string]: string }> {
    await fsp.mkdir(cacheDir, { recursive: true });
    const files = await filelist;

    // Run thumbnail resizing in parallel
    const resizes = files.map(async (fname) => {
        const sourcePath = `${sourceDir}/${fname}`;
        const stat = await fsp.stat(sourcePath);
        const key = cacheKey(sourcePath, options.size, stat);
        const outputBasename = `${sha256(key)}-${path.parse(fname).name}.png`;
        const outputPath = `${cacheDir}/${outputBasename}`;
        try {
            await fsp.access(outputPath, constants.R_OK);
        } catch (e) {
            console.log('resize image', sourcePath);
            await imageResize(sourcePath, options.size, outputPath);
        }
        return [fname, outputBasename];
    });
    const res = await Promise.all(resizes);
    return res.reduce((acc, [src, outp]) => {
        acc[src] = outp;
        return acc;
    }, {});
}
