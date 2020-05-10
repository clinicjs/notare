import { Readable, Writable, pipeline } from 'readable-stream';
import { threadId } from 'worker_threads';
import * as os from 'os';
import { createSocket, Socket } from 'dgram';
import { monitorEventLoopDelay, EventLoopDelayMonitor } from 'perf_hooks';
import { Sample, CpuSample, HandlesSample } from './common';
import { createHook, AsyncHook } from 'async_hooks';

import debuglog from 'debug';

const debug = debuglog('notare');

function toms (time : [number, number]) {
  return time[0] * 1e3 + time[1] * 1e-6;
}

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
  hz: parseInt(process.env.NOTARE_HZ || '0') || 2
};

const kDefaultUDPOptions : FilledUDPOptions = {
  address: process.env.NOTARE_HOST || 'localhost',
  port: parseInt(process.env.NOTARE_PORT || '') || 8999
};

type DestroyCallback = (err? : any) => void;
type WriteCallback = (err? : any) => void;

class HandleTracker {
  #types : Map<number, string> = new Map();
  #counts : Map<string, number> = new Map();
  #hook : AsyncHook;

  constructor () {
    const self : HandleTracker = this;
    this.#hook = createHook({
      init (id, type) {
        self.#types.set(id, type);

        if (!self.#counts.has(type)) {
          self.#counts.set(type, 1);
        } else {
          self.#counts.set(type, (self.#counts.get(type) || 0) + 1);
        }
      },
      destroy (id) {
        const type : string | undefined = self.#types.get(id);
        self.#types.delete(id);
        if (type !== undefined) {
          self.#counts.set(type, (self.#counts as any).get(type) - 1);
          if (self.#counts.get(type) === 0) {
            self.#counts.delete(type);
          }
        }
      }
    });
    this.#hook.enable();
  }

  get counts () : HandlesSample {
    const obj : HandlesSample = {
      titles: [],
      data: []
    };
    this.#counts.forEach((value : number, key : string) => {
      // Filter out out notare's handles
      if (key === 'UDPWRAP' ||
          key === 'Timeout' ||
          key === 'ELDHISTOGRAM') {
        value--;
      }
      if (value > 0) {
        obj.titles.push(key);
        obj.data.push(value);
      }
    });
    return obj;
  }

  destroy () {
    this.#hook.disable();
  }
}

class Monitor extends Readable {
  #options : MonitorOptions;
  #timer : any;
  #elmonitor? : EventLoopDelayMonitor;
  #lastTS? : [number, number];
  #lastCPUUsage? : NodeJS.CpuUsage;
  #handles? : HandleTracker;

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
    this.#lastTS = process.hrtime();

    const delay = 1000 / (this.#options.hz || kDefaultMonitorOptions.hz);
    this.#timer = setInterval(() => this._sample(), delay);
    if (monitorEventLoopDelay !== undefined) {
      this.#elmonitor = monitorEventLoopDelay({ resolution: delay });
      this.#elmonitor.enable();
    }
    this.#timer.unref();

    if (process.env.NOTARE_HANDLES === '1') {
      this.#handles = new HandleTracker();
    }

    debug(`rate: ${this.#options.hz} samples per second`);
  }

  _cpupct () {
    const elapsed = toms(process.hrtime(this.#lastTS));
    const usage = this.#lastCPUUsage = process.cpuUsage(this.#lastCPUUsage);
    const total = (usage.user + usage.system) / 1000;
    this.#lastTS = process.hrtime();
    return total / elapsed;
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
      cpu: this._cpupct(),
      cpus: cpus.map((cpu) : CpuSample => {
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
    if (this.#handles !== undefined) {
      sample.handles = this.#handles.counts;
    }
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
      };
    }

    this.push(sample);
    this.#lastTS = process.hrtime();
  }

  _destroy (err : any, callback : DestroyCallback) {
    this.push(null);
    if (this.#elmonitor !== undefined) {
      this.#elmonitor.disable();
    }
    if (this.#handles !== undefined) {
      this.#handles.destroy();
    }
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
    callback(err);
  }

  _read () {
    // Nothing to do here
  }

  get options () : MonitorOptions {
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

  get options () : UDPOptions {
    return this.#options;
  }
}

function monitor () {
  pipeline(
    new Monitor(),
    new UDPWritable(),
    (err) => {
      if (err) {
        console.error('notare failure: ', err.message);
      }
    });
}

monitor();

export = {};
