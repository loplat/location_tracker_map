const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;

// 파일 확장자에 따른 MIME 타입 매핑
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    let filePath;

    // Chrome DevTools 관련 요청 처리
    if (req.url.startsWith('/.well-known/')) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
    }

    // 요청된 URL이 루트('/')일 경우, index.html 파일을 제공합니다.
    if (req.url === '/') {
        filePath = path.join(__dirname, 'index.html');
    } else {
        // 다른 경로의 경우, 해당 파일을 찾습니다.
        filePath = path.join(__dirname, req.url);
    }

    // 파일 확장자 추출
    const extname = path.extname(filePath);
    const contentType = mimeTypes[extname] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // 파일을 찾을 수 없는 경우 404 에러를 반환합니다.
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('파일을 찾을 수 없습니다: ' + req.url);
                console.error('File not found:', req.url);
            } else {
                // 기타 오류의 경우 500 에러를 반환합니다.
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('서버 오류: 파일을 읽을 수 없습니다.');
                console.error('Error reading file:', err);
            }
            return;
        }

        // 파일을 성공적으로 읽으면 적절한 Content-Type과 함께 콘텐츠를 제공합니다.
        res.writeHead(200, {
            'Content-Type': contentType + (contentType.includes('text') ? '; charset=utf-8' : '')
        });
        res.end(content);
    });
});

server.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    console.log('브라우저에서 위 주소로 접속하세요.');
    console.log('서버를 중지하려면 Ctrl+C를 누르세요.');
});
