# notare -- Node.js observer

Inspired by Matteo Collina's [climem](https://www.npmjs.com/package/climem)...

Utility for monitoring Node.js performance metrics from the command line.

First, install globally:

```console
$ npm i -g notare
```

Then, within your project:

```console
$ npm i --save-dev notare
$ node -r notare myscript.js
```

Then, from a separate terminal window, run:

```console
$ notare
```

## Screenshots

Use the keyboard arrow keys to navigate screens.

![Memory](https://github.com/jasnell/notare/blob/master/docs/images/notare_memory.png?raw=true)

![Event Loop Delay](https://github.com/jasnell/notare/blob/master/docs/images/notare_eld.png?raw=true)

![CPU](https://github.com/jasnell/notare/blob/master/docs/images/notare_cpu.png?raw=true)

![Handles](https://github.com/jasnell/notare/blob/master/docs/images/notare_handles.png?raw=true)

## Configuration via Environment Variables

* `NOTARE_HZ=n` where `n` is the number of samples per second (default `2`)
* `NOTARE_PORT=n` where `n` is the UDP port notare should use (default `8999`)
* `NOTARE_HOST=n` where `n` is the UDP hostname (default `localhost`)
* `NOTARE_HANDLES=1` instructs notare to monitor async hook handle counts
* `NOTARE_GC=1` instructs notare to monitor garbage collection
  (disabled by default)

