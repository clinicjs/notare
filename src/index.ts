import { Writable, pipeline } from 'readable-stream';
import { Monitor } from 'notare-monitor';
import { createSocket, Socket } from 'dgram';

interface UDPOptions {
  address?: string,
  port?: number
};

interface FilledUDPOptions extends UDPOptions {
  address: string,
  port: number
}

const kDefaultUDPOptions : FilledUDPOptions = {
  address: process.env.NOTARE_HOST || 'localhost',
  port: parseInt(process.env.NOTARE_PORT || '') || 8999
};

type DestroyCallback = (err? : any) => void;
type WriteCallback = (err? : any) => void;

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
    this.#socket.unref();
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
