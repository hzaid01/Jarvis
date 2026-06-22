const { parentPort } = require('worker_threads');
const os = require('os');
const { execFile } = require('child_process');

let si;
try {
  si = require('systeminformation');
} catch (e) {
  console.error('StatsWorker: failed to require systeminformation', e.message);
}

let latestStats = {
  cpu: { usage: 0, cores: os.cpus().length },
  memory: { usage: 0, used: '0.0', total: '0.0' },
  gpu: { usage: 0, temp: 0, name: 'Detecting...', memUsed: 0, memTotal: 0 },
  disk: { usage: 0, used: '0', total: '0' },
  temperature: { gpu: 0 },
  network: { download: '0.0', upload: '0.0' }
};

let lastGpuFetch = 0;
let lastNetFetch = 0;
let lastDiskFetch = 0;

let prevCpuTimes = null;

function getCpuUsage() {
  const cpus = os.cpus();

  if (!prevCpuTimes) {
    prevCpuTimes = cpus.map(c => ({ ...c.times }));
    return { usage: 0, cores: cpus.length };
  }

  let totalIdle = 0;
  let totalTick = 0;

  for (let i = 0; i < cpus.length; i++) {
    const prev = prevCpuTimes[i];
    const curr = cpus[i].times;

    const idle = curr.idle - prev.idle;
    const total = (curr.user - prev.user) + (curr.nice - prev.nice) +
      (curr.sys - prev.sys) + (curr.irq - prev.irq) + idle;

    totalIdle += idle;
    totalTick += total;
  }

  prevCpuTimes = cpus.map(c => ({ ...c.times }));

  const usage = totalTick > 0 ? Math.round((1 - totalIdle / totalTick) * 100) : 0;
  return { usage, cores: cpus.length };
}

function getMemoryStats() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    usage: Math.round((used / total) * 100),
    used: (used / 1073741824).toFixed(1),
    total: (total / 1073741824).toFixed(1),
  };
}

function getNvidiaStats() {
  return new Promise((resolve) => {
    execFile(
      'nvidia-smi',
      ['--query-gpu=utilization.gpu,temperature.gpu,name,memory.used,memory.total', '--format=csv,noheader,nounits'],
      { timeout: 3000 },
      (error, stdout) => {
        if (error) {
          return resolve(latestStats.gpu);
        }
        try {
          const p = stdout.trim().split(',').map(s => s.trim());
          const gpu = {
            usage: parseInt(p[0]) || 0,
            temp: parseInt(p[1]) || 0,
            name: p[2] || 'NVIDIA GPU',
            memUsed: parseInt(p[3]) || 0,
            memTotal: parseInt(p[4]) || 0,
          };
          resolve(gpu);
        } catch (e) {
          resolve(latestStats.gpu);
        }
      }
    );
  });
}

async function getDiskStats() {
  if (!si) return latestStats.disk;
  try {
    const fsSize = await si.fsSize();
    const total = fsSize.reduce((a, f) => a + f.size, 0);
    const used = fsSize.reduce((a, f) => a + f.used, 0);
    return {
      usage: Math.round((used / total) * 100),
      used: (used / 1073741824).toFixed(0),
      total: (total / 1073741824).toFixed(0),
    };
  } catch (e) {
    return latestStats.disk;
  }
}

async function getNetworkStats() {
  if (!si) return latestStats.network;
  try {
    const stats = await si.networkStats();
    const real = stats.filter(n =>
      n.iface &&
      !n.iface.toLowerCase().startsWith('lo') &&
      !n.iface.toLowerCase().includes('loopback') &&
      !n.iface.toLowerCase().includes('virtual') &&
      !n.iface.toLowerCase().includes('vethernet')
    );
    const interfaces = real.length > 0 ? real : stats;
    const rx = interfaces.reduce((a, n) => a + (n.rx_sec || 0), 0);
    const tx = interfaces.reduce((a, n) => a + (n.tx_sec || 0), 0);
    return {
      download: (rx / 1024).toFixed(1),
      upload: (tx / 1024).toFixed(1)
    };
  } catch (e) {
    return latestStats.network;
  }
}

async function pollStats() {
  const now = Date.now();

  latestStats.cpu = getCpuUsage();
  latestStats.memory = getMemoryStats();

  const promises = [];

  const shouldPollGpu = (now - lastGpuFetch >= 10000 || lastGpuFetch === 0);
  if (shouldPollGpu) {
    promises.push((async () => {
      latestStats.gpu = await getNvidiaStats();
      latestStats.temperature = { gpu: latestStats.gpu.temp };
      lastGpuFetch = now;
    })());
  }

  const shouldPollNet = (now - lastNetFetch >= 15000 || lastNetFetch === 0);
  if (shouldPollNet) {
    promises.push((async () => {
      latestStats.network = await getNetworkStats();
      lastNetFetch = now;
    })());
  }

  const shouldPollDisk = (now - lastDiskFetch >= 60000 || lastDiskFetch === 0);
  if (shouldPollDisk) {
    promises.push((async () => {
      latestStats.disk = await getDiskStats();
      lastDiskFetch = now;
    })());
  }

  if (promises.length > 0) {
    await Promise.all(promises);
  }

  parentPort.postMessage(latestStats);
}

pollStats();

setInterval(pollStats, 5000);
