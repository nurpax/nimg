#!/usr/bin/env node
import express, { text } from 'express';
import path from 'path';
import { opts, program } from 'commander';
import glob from 'glob-promise';
import morgan from 'morgan';
import WebSocket from 'ws';
import watch from 'node-watch';

import * as thumbsCache from './thumbs-cache';

const appName = 'nimg';
const publicPath = path.join(__dirname, '../public');

program
    .requiredOption('--source-dir <path>', 'Root directory where to serve image files from')
    .option(
        '--cache-dir <dir>',
        'Override default cache dir of ~/.cache/nimg',
        `${process.env['HOME']}/.cache/${appName}`
    )
    .option('-p, --port <port>', 'Server port', '3131')
    .option('--websocket-port <port>', 'WebSocket port', '3132');

program.parse(process.argv);
const options = program.opts();

const app = express();
const port = parseInt(options.port);

app.use(morgan('combined'));

async function getFileList(root: string): Promise<string[]> {
    const files = await glob(path.join(root, '**/*.png'));
    const sorted = files.map((p) => path.relative(root, p)).sort();
    return sorted;
}

app.get('/api/files', async (req, res, _next) => {
    try {
        const sorted = await getFileList(options.sourceDir);
        res.json({ files: sorted });
    } catch (err) {
        res.status(500).send(err.toString());
    }
});

app.use('/static', express.static(publicPath));
app.use('/source', express.static(options.sourceDir));
app.use('/cache', express.static(options.cacheDir));

// Client side routing fallback to index.html
app.use('/', function (req, res) {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(port, () => {
    console.log(`Image viewer listing at http://localhost:${port}`);
});

// file watching and live-reload
const watcher = watch(options.sourceDir, { recursive: true, delay: 100 });
const wss = new WebSocket.Server({ port: options.websocketPort });
wss.on('connection', async (ws) => {
    // TODO thumbs need regenning if any files change or get added/removed
    const thumbs = await thumbsCache.makeThumbnails(
        getFileList(options.sourceDir),
        options.sourceDir,
        options.cacheDir,
        {
            size: { w: 48, h: 48 }
        }
    );

    ws.send(
        JSON.stringify({
            type: 'thumbs-update',
            thumbs
        })
    );

    watcher.on('change', (evt, name: string) => {
        if (evt === 'update' || evt === 'remove') {
            ws.send(JSON.stringify({ type: evt, file: path.relative(options.sourceDir, name) }));
        }
    });
});
