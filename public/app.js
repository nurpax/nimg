function copyVec3(v) {
    return [...v];
}

function c(a, col) {
    return [a.v[0][col], a.v[1][col], a.v[2][col]];
}

function r(a, row) {
    return a.v[row];
}

function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function matmultVec3(a, v) {
    return [dot(r(a, 0), v), dot(r(a, 1), v), dot(r(a, 2), v)];
}

// Deep copy a matrix
function copyMatrix(m) {
    return {
        v: [copyVec3(m.v[0]), copyVec3(m.v[1]), copyVec3(m.v[2])]
    };
}

function identity() {
    return {
        v: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]
        ]
    };
}

// Code ported from https://stackoverflow.com/a/18504573
function invert(a) {
    const res = identity();
    function m(r, c) {
        return a.v[r][c];
    }
    function setminv(r, c, v) {
        res.v[r][c] = v;
    }

    // computes the inverse of a matrix m
    const det =
        m(0, 0) * (m(1, 1) * m(2, 2) - m(2, 1) * m(1, 2)) -
        m(0, 1) * (m(1, 0) * m(2, 2) - m(1, 2) * m(2, 0)) +
        m(0, 2) * (m(1, 0) * m(2, 1) - m(1, 1) * m(2, 0));

    const invdet = 1 / det;
    setminv(0, 0, (m(1, 1) * m(2, 2) - m(2, 1) * m(1, 2)) * invdet);
    setminv(0, 1, (m(0, 2) * m(2, 1) - m(0, 1) * m(2, 2)) * invdet);
    setminv(0, 2, (m(0, 1) * m(1, 2) - m(0, 2) * m(1, 1)) * invdet);
    setminv(1, 0, (m(1, 2) * m(2, 0) - m(1, 0) * m(2, 2)) * invdet);
    setminv(1, 1, (m(0, 0) * m(2, 2) - m(0, 2) * m(2, 0)) * invdet);
    setminv(1, 2, (m(1, 0) * m(0, 2) - m(0, 0) * m(1, 2)) * invdet);
    setminv(2, 0, (m(1, 0) * m(2, 1) - m(2, 0) * m(1, 1)) * invdet);
    setminv(2, 1, (m(2, 0) * m(0, 1) - m(0, 0) * m(2, 1)) * invdet);
    setminv(2, 2, (m(0, 0) * m(1, 1) - m(1, 0) * m(0, 1)) * invdet);
    return res;
}

function matmult(a, b) {
    return {
        v: [
            [dot(r(a, 0), c(b, 0)), dot(r(a, 0), c(b, 1)), dot(r(a, 0), c(b, 2))],
            [dot(r(a, 1), c(b, 0)), dot(r(a, 1), c(b, 1)), dot(r(a, 1), c(b, 2))],
            [dot(r(a, 2), c(b, 0)), dot(r(a, 2), c(b, 1)), dot(r(a, 2), c(b, 2))]
        ]
    };
}

// a c tx
// b d ty
// 0 0 1
// ->
// [a b c d tx ty]
function matrixToCSS(a) {
    const v = a.v;
    return `matrix(${v[0][0]}, ${v[1][0]}, ${v[0][1]}, ${v[1][1]}, ${v[0][2]}, ${v[1][2]})`;
}

function scale(s) {
    const m = identity();
    m.v[0][0] = s;
    m.v[1][1] = s;
    return m;
}

function translate(x, y) {
    const m = identity();
    m.v[0][2] = x;
    m.v[1][2] = y;
    return m;
}

function clampToWindow(xform, imageWindowRect, imageSrcRect) {
    const xf = copyMatrix(xform);

    // Clamp translation so that the canvas doesn't go out of the window
    let tx = Math.min(xf.v[0][2], 0);
    let ty = Math.min(xf.v[1][2], 0);
    const xx = imageWindowRect.width;
    const yy = imageWindowRect.height;

    // Source image width/height in screenspace
    const [swidth, sheight] = matmultVec3(xform, [imageSrcRect.width, imageSrcRect.height, 0]);

    // Center if scaled source image smaller than image window
    const px = xx / 2.0 - swidth / 2.0;
    const py = yy / 2.0 - sheight / 2.0;

    tx = Math.max(tx, Math.min(px, -swidth + xx));
    ty = Math.max(ty, Math.min(py, -sheight + yy));
    xf.v[0][2] = tx;
    xf.v[1][2] = ty;
    // Center
    return xf;
}

function getCurFileFromLocation() {
    return window.location.pathname === '/' ? '/index.md' : decodeURI(window.location.pathname);
}

class Model {
    observers = [];

    currentFileIdx = 0;
    files = [];

    subscribe = (fn) => {
        this.observers.push(fn);
    };

    loadFileList = async () => {
        try {
            let res = await fetch('/api/files');
            if (!res.ok) {
                throw new Error('failed to load page list');
            }
            const json = await res.json();
            this.files = json.files;
            // TODO shouldn't override.. maybe check if fileidx points to same file as before, keep it.
            // otherwise override.
            this.currentFileIdx = 0;
            for (const fn of this.observers) {
                fn({ type: 'files-loaded', files: json.files });
            }
        } catch (err) {
            for (const fn of this.observers) {
                fn({ type: 'error', error: err.toString() });
            }
        }
    };

    loadAll = async (page) => {
        await Promise.all([this.loadFileList()]);
    };

    setCurrentFile(name) {
        for (let i = 0; i < this.files.length; i++) {
            if (this.files[i] === name) {
                this.currentFileIdx = i;
                return;
            }
        }
    }

    flipImages = (dir) => {
        if (this.files.length === 0) {
            return;
        }

        this.currentFileIdx += dir;
        if (this.currentFileIdx <= 0) {
            this.currentFileIdx = this.files.length - 1;
        }
        if (this.currentFileIdx >= this.files.length) {
            this.currentFileIdx = 0;
        }
    };

    currentFile = () => {
        if (this.files.length === 0) {
            return null;
        }
        return this.files[this.currentFileIdx];
    };
}

class App {
    constructor() {
        this.zoomTransform = identity();

        this.imageSize = null;
        this.viewerContainerBbox = null;
        this.model = new Model();
        this.model.subscribe((e) => this.watchEvents(e));
    }

    watchErrors = (event) => {
        const errorDiv = document.getElementById('error');
        const errorTextDiv = errorDiv.getElementsByTagName('div')[0];
        errorTextDiv.textContent = event.error;
        errorDiv.getElementsByTagName('button')[0].addEventListener('click', () => {
            // Clear error.
            errorDiv.className = '';
        });
        errorDiv.className = 'active';
    };

    watchFileListEvents = (event) => {
        console.log('watch ', event.typet, event.files);
    };

    flipImages = (dir) => {
        this.model.flipImages(dir);
        this.refresh();
    };

    setViewerDims = (imageSize, viewerContainerBbox) => {
        this.viewerContainerBbox = viewerContainerBbox;
        this.imageSize = imageSize;

        const div = document.querySelector('#main-image');
        div.style.width = this.viewerContainerBbox.width;
        div.style.height = this.viewerContainerBbox.height;
        this.setTransform(this.zoomTransform);
    };

    setTransform = (xform) => {
        if (!this.imageSize || !this.viewerContainerBbox) {
            return;
        }
        const xformDiv = document.querySelector('#main-image #transform');
        const imageWindowRect = {
            width: this.viewerContainerBbox.width,
            height: this.viewerContainerBbox.height
        };
        const clamped = clampToWindow(xform, imageWindowRect, this.imageSize);
        xformDiv.style.transform = matrixToCSS(clamped);
        this.zoomTransform = clamped;
    };

    mouseWheel = (e) => {
        const wheelScale = 200.0 * 6;
        const delta = Math.min(Math.abs(e.delta), wheelScale);
        const scaleDelta = e.delta < 0 ? 1.0 / (1 - delta / (wheelScale + 1)) : 1 - delta / (wheelScale + 1);

        const mouseX = e.clientX - this.viewerContainerBbox.left;
        const mouseY = e.clientY - this.viewerContainerBbox.top;

        const invXform = invert(this.zoomTransform);
        const srcPos = matmultVec3(invXform, [mouseX, mouseY, 1]);

        let xform = matmult(
            this.zoomTransform,
            matmult(
                translate(srcPos[0] - scaleDelta * srcPos[0], srcPos[1] - scaleDelta * srcPos[1]),
                scale(scaleDelta)
            )
        );
        // Clamp scale to 1.0
        if (xform.v[0][0] < 1.0 || xform.v[1][1] < 1.0) {
            const invScale = scale(1.0 / xform.v[0][0]);
            xform = matmult(xform, invScale);
            // scale is roughly 1.0 now but let's force float values
            // to exact 1.0
            xform.v[0][0] = 1.0;
            xform.v[1][1] = 1.0;
        }

        this.setTransform(xform);
    };

    pan = (movement) => {
        const { x, y } = movement;
        const invXform = invert(this.zoomTransform);
        const srcDxDy = matmultVec3(invXform, [x, y, 0]);
        const xform = matmult(this.zoomTransform, translate(srcDxDy[0], srcDxDy[1]));
        this.setTransform(xform);
    };

    navigateTo = (file) => {
        this.model.setCurrentFile(file);
        this.refresh();
    };

    keyup = (key) => null;
    keydown = (key) => {
        switch (key) {
            case 'ArrowLeft':
                return this.flipImages(-1);
            case 'ArrowRight':
                return this.flipImages(1);
        }
    };

    watchEvents = (event) => {
        if (event.type === 'error') {
            return this.watchErrors(event);
        }
        if (event.type.startsWith('files-')) {
            return this.watchFileListEvents(event);
        }
    };

    refresh = () => {
        const file = this.model.currentFile();
        if (file !== null) {
            const img = document.getElementById('main-image').getElementsByTagName('img')[0];
            img.src = `/source/${file}`;
            const div = document.getElementById('current-filename');
            div.textContent = file;
        }
    };

    loadAll = async (selectedFile) => {
        await this.model.loadAll(selectedFile);
        this.refresh();
    };
}

window.addEventListener('load', async (_event) => {
    const app = new App();
    const curFile = getCurFileFromLocation();
    // Refresh rendering when navigation changes the URL
    window.onpopstate = (_e) => {
        const page = getCurFileFromLocation();
        app.navigateTo(page);
    };
    await app.loadAll(curFile);

    document.addEventListener('keydown', (e) => app.keydown(e.key));
    document.addEventListener('keyup', (e) => app.keyup(e.key));

    const mainImageDiv = document.querySelector('#image-container');
    const img = mainImageDiv.querySelector('#transform img');
    const ro = new ResizeObserver((entries) => {
        let viewerContainerBbox = mainImageDiv.getBoundingClientRect();
        let imageSize = {
            width: img.naturalWidth,
            height: img.naturalHeight
        };
        for (const e of entries) {
            if (e.target == mainImageDiv) {
                viewerContainerBbox = e.target.getBoundingClientRect();
            } else if (e.target == img) {
                const { width, height } = e.contentRect;
                imageSize = { width, height };
            }
        }
        app.setViewerDims(imageSize, viewerContainerBbox);
    });
    ro.observe(mainImageDiv);
    ro.observe(img);

    const mainImage = document.querySelector('#image-container');
    mainImage.onwheel = (e) => {
        const delta = e.wheelDelta ? -e.wheelDelta : e.deltaY * 30;
        app.mouseWheel({
            clientX: e.clientX,
            clientY: e.clientY,
            delta
        });
    };
    mainImage.ondblclick = () => {
        app.setTransform(identity());
    };
    mainImage.onpointerdown = (e) => {
        e.target.onpointermove = (e) => {
            app.pan({ x: e.movementX, y: e.movementY });
        };
        e.target.setPointerCapture(e.pointerId);
        e.preventDefault();
    };
    mainImage.onpointerup = (e) => {
        e.target.onpointermove = null;
        e.target.releasePointerCapture(e.pointerId);
        e.preventDefault();
    };

    // Websocket reloads when files change
    function connect() {
        // TODO pass websocket port here
        var socket = new WebSocket('ws://localhost:3132/');
        socket.onclose = function (_event) {
            console.warn('Websocket connection closed or unable to connect; ' + 'loading reconnect timeout');

            // Allow the last socket to be cleaned up.
            socket = null;

            // Set an interval to continue trying to reconnect
            // periodically until we succeed.
            setTimeout(function () {
                connect();
            }, 5000);
        };
        socket.onmessage = async function (event) {
            const e = JSON.parse(event.data);
            if (e.type === 'update' || e.type === 'remove') {
                await app.loadAll(`/${e.file}`);
            }
        };
    }
    connect();
});
