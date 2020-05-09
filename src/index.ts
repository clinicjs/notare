import { Readable, Writable } from 'readable-stream';
import { threadId } from 'worker_threads';
import * as os from 'os';
import { createSocket, Socket } from 'dgram';
import { monitorEventLoopDelay, EventLoopDelayMonitor } from 'perf_hooks';

interface MonitorOptions {
  hz? : number
}

interface UDPOptions {
  address?: string,
  port?: number
};

interface FilledMonitorOptions extends MonitorOptions {
  hz : number
}

interface FilledUDPOptions extends UDPOptions {
  address: string,
  port: number
}

const kDefaultMonitorOptions : FilledMonitorOptions = {
  hz : 49
};

const kDefaultUDPOptions : FilledUDPOptions = {
  address: 'localhost',
  port: 8999
};

interface MemorySample {
  arrayBuffers : number,
  external : number,
  heapTotal : number,
  heapUsed : number,
  rss : number
}

interface CpuSample {
  model : string,
  speed : number,
  idle : number,
  irq : number,
  nice : number,
  sys : number,
  user : number
}

interface HistogramSample {
  min: number,
  max: number,
  mean: number,
  stddev: number,
  p0_001: number,
  p0_01: number,
  p0_1: number,
  p1: number,
  p2_5: number,
  p10: number,
  p25: number,
  p50: number,
  p75: number,
  p90: number,
  p97_5: number,
  p99: number,
  p99_9: number,
  p99_99: number,
  p99_999: number
}

interface LoadAvgSample {
  a1: number,
  a5: number,
  a15: number
}

interface Sample {
  pid : number,
  threadId : number,
  memory : MemorySample,
  cpus : CpuSample[],
  loadAvg: LoadAvgSample,
  eventLoop? : HistogramSample
}

type DestroyCallback = (err? : any) => void;
type WriteCallback = (err? : any) => void;

class Monitor extends Readable {
  #options : MonitorOptions;
  #timer : any;
  #elmonitor? : EventLoopDelayMonitor;

  constructor (options : MonitorOptions = {}) {
    super({
      objectMode: true
    } as any);

    if (options !== undefined &&
        (typeof options !== 'object' || options === null)) {
      throw new TypeError('options must be an object');
    }
    if (options.hz !== undefined) {
      if (typeof options.hz !== 'number') {
        throw new TypeError('options.hz must be a number between 1 and 1000');
      }
      if (options.hz < 1 || options.hz > 1000) {
        throw new RangeError('options.hz must be a number between 1 and 1000');
      }
    }

    this.#options = { ...kDefaultMonitorOptions, ...options };

    const delay = 1000 / (this.#options.hz || kDefaultMonitorOptions.hz);
    this.#timer = setInterval(() => this._sample(), delay);
    if (monitorEventLoopDelay !== undefined) {
      this.#elmonitor = monitorEventLoopDelay({ resolution: delay });
      this.#elmonitor.enable();
    }
  }

  _sample () {
    const memory = process.memoryUsage();
    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    const sample : Sample = {
      pid: process.pid,
      threadId,
      memory: {
        arrayBuffers: memory.arrayBuffers,
        external: memory.external,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
        rss: memory.rss
      },
      cpus : cpus.map((cpu) : CpuSample => {
        return {
          model: cpu.model,
          speed: cpu.speed,
          idle: cpu.times.idle,
          irq: cpu.times.irq,
          nice: cpu.times.nice,
          sys: cpu.times.sys,
          user: cpu.times.user
        };
      }),
      loadAvg: {
        a1: loadAvg[0],
        a5: loadAvg[1],
        a15: loadAvg[2]
      },
      eventLoop: undefined
    };
    if (this.#elmonitor !== undefined) {
      sample.eventLoop = {
        min: this.#elmonitor.min,
        max: this.#elmonitor.max,
        mean: this.#elmonitor.mean,
        stddev: this.#elmonitor.stddev,
        p0_001: this.#elmonitor.percentile(0.001),
        p0_01: this.#elmonitor.percentile(0.01),
        p0_1: this.#elmonitor.percentile(0.1),
        p1: this.#elmonitor.percentile(1),
        p2_5: this.#elmonitor.percentile(2.5),
        p10: this.#elmonitor.percentile(10),
        p25: this.#elmonitor.percentile(25),
        p50: this.#elmonitor.percentile(50),
        p75: this.#elmonitor.percentile(75),
        p90: this.#elmonitor.percentile(90),
        p97_5: this.#elmonitor.percentile(97.5),
        p99: this.#elmonitor.percentile(99),
        p99_9: this.#elmonitor.percentile(99.9),
        p99_99: this.#elmonitor.percentile(99.99),
        p99_999: this.#elmonitor.percentile(99.999)
      }
    }

    this.push(sample);
  }

  _destroy (err : any, callback : DestroyCallback) {
    this.push(null);
    if (this.#elmonitor !== undefined)
      this.#elmonitor.disable();
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
    callback(err);
  }

  _read () {
    // Nothing to do here
  }

  get options() : MonitorOptions {
    return this.#options;
  }
}

class UDPWritable extends Writable {
  #options: UDPOptions;
  #socket: Socket;

  constructor (options : UDPOptions = {}) {
    super({
      objectMode: true
    } as any);

    if (options !== undefined &&
        (typeof options !== 'object' || options === null)) {
      throw new TypeError('options must be an object');
    }
    if (options.address !== undefined && typeof options.address !== 'string') {
      throw new TypeError('options.address must be a string');
    }
    if (options.port !== undefined) {
      if (typeof options.port !== 'number') {
        throw new TypeError(
          'options.port must be a number between 0 and 65535');
      }
      if (options.port < 0 || options.port > 65535) {
        throw new RangeError(
          'options.port must be a number between 0 and 65535');
      }
    }

    this.#options = { ...kDefaultUDPOptions, ...options };
    this.#socket = createSocket('udp4');
  }

  _write (chunk : any, _ : any, callback : WriteCallback) {
    const message = JSON.stringify(chunk);
    this.#socket.send(
      message,
      this.#options.port,
      this.#options.address, (err : any) => {
        if (err) {
          this._destroy(err, callback);
          return;
        }
        callback();
      });
  }

  _destroy (err : any, callback : DestroyCallback) {
    this.#socket.close();
    callback(err);
  }

  get options() : UDPOptions {
    return this.#options;
  }
}

export = {
  Monitor,
  UDPWritable
};
