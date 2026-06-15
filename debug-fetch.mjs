import http from 'http';

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

(async () => {
  // Check index.html
  const index = await fetch('http://localhost:5173/');
  console.log('=== index.html status:', index.status);
  console.log(index.body.substring(0, 300));

  // Check if main.tsx resolves
  const main = await fetch('http://localhost:5173/src/main.tsx');
  console.log('\n=== main.tsx status:', main.status);
  console.log(main.body.substring(0, 500));

  // Check App.tsx
  const app = await fetch('http://localhost:5173/src/App.tsx');
  console.log('\n=== App.tsx status:', app.status);
  console.log(app.body.substring(0, 500));
})();
