import net from 'net';

const PORT = process.env.PORT || 3000;

function checkPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`
❌ 端口 ${port} 已被占用！

请先关闭占用该端口的进程，或者运行以下命令查看占用情况：
  lsof -i :${port}

关闭占用进程：
  kill -9 $(lsof -ti :${port})
`));
      } else {
        reject(err);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve();
    });
    
    server.listen(port);
  });
}

checkPort(PORT)
  .then(() => {
    console.log(`✅ 端口 ${PORT} 可用，准备启动项目...\n`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
