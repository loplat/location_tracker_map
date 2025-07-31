const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;

const server = http.createServer((req, res) => {
    // 요청된 URL이 루트('/')일 경우, location_tracker_map.html 파일을 제공합니다.
    if (req.url === '/') {
        const filePath = path.join(__dirname, 'index.html');

        fs.readFile(filePath, (err, content) => {
            if (err) {
                // 파일을 읽는 중 오류가 발생하면 500 에러를 반환합니다.
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('서버 오류: 파일을 읽을 수 없습니다.');
                console.error('Error reading file:', err);
                return;
            }

            // 파일을 성공적으로 읽으면 HTML 콘텐츠를 제공합니다.
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(content);
        });
    } else {
        // 루트 URL이 아닌 다른 경로로 요청이 오면 404 Not Found를 반환합니다.
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('페이지를 찾을 수 없습니다.');
    }
});

server.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    console.log('브라우저에서 위 주소로 접속하세요.');
    console.log('서버를 중지하려면 Ctrl+C를 누르세요.');
});
