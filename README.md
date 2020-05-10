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

![Memory](docs/images/notare_memory.png)

![Event Loop Delay](docs/images/notare_eld.png)

![CPU](docs/images/notare_cpu.png)

![Handles](docs/images/notare_handles.png)

## Configuration via Environment Variables

* `NOTARE_HZ=n` where `n` is the number of samples per second (default `2`)
* `NOTARE_PORT=n` where `n` is the UDP port notare should use (default `8999`)
* `NOTARE_HIST=n` where `n` is the UDP hostname (default `localhost`)
* `NOTARE_HANDLES=1` instructs notare to monitor async hook handle counts
  (disabled by default)

