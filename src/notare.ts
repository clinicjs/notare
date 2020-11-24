#! /usr/bin/env node

import * as blessed from 'blessed';
import * as contrib from 'blessed-contrib';
import { createSocket } from 'dgram';
import { Sample } from 'notare-monitor';

const server = createSocket('udp4');

server.on('error', (err) => {
  console.error('notare failed: ', err.message);
  server.close();
});

server.on('message', (msg) => {
  const data : Sample = JSON.parse(msg.toString());
  // Only plot main thread data
  // TODO(@jasnell): Include worker thread data in the plot
  if (data.isMainThread) {
    plot(data);
  }
});

server.on('listening', () => {
  console.log('notare listening...');
});

server.bind({
  address: process.env.NOTARE_HOST || undefined,
  port: parseInt(process.env.NOTARE_PORT || '') || 8999
});

function empty (num : number) {
  const result = new Array(num);
  for (let i = 0; i < num; i++) {
    result[i] = 0;
  }
  return result;
}

const rss = {
  title: 'rss',
  x: empty(80),
  y: empty(80),
  style: {
    line: 'red'
  }
};
const heapTotal = {
  title: 'heapTotal',
  x: empty(80),
  y: empty(80),
  style: {
    line: 'yellow'
  }
};
const heapUsed = {
  title: 'heapUsed',
  x: empty(80),
  y: empty(80),
  style: {
    line: 'green'
  }
};
const loopUtil = {
  title: 'loopUtilization',
  x: empty(80),
  y: empty(80),
  style: {
    line: 'white'
  }
};

const loopDelays = {
  title: 'Loop Delay',
  x: ['10', '25', '50', '75', '90', '97.5', '99', '99.9', '99.99', '99.999'],
  y: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  style: {
    line: 'green'
  }
};

const cpus = [
  { percent: 0, label: 'CPU', color: 'green' } as any,
  { percent: 0, label: '1 Minute Load', color: 'green' } as any,
  { percent: 0, label: '5 Minute Load', color: 'green' } as any,
  { percent: 0, label: '15 Minute Load', color: 'green' } as any
];

const handlesData = {
  title: 'Handles',
  x: [],
  y: [],
  style: {
    line: 'green'
  }
};

const gcDurationData = {
  title: 'GC Duration',
  x: ['10', '25', '50', '75', '90', '97.5', '99', '99.9', '99.99', '99.999'],
  y: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  style: {
    line: 'green'
  }
};

const gcCountData = {
  titles: ['Major', 'Minor', 'Incremental', 'WeakCB'],
  data: [0, 0, 0, 0]
};

function memoryPage (screen : any) {
  screen.append(memoryLine);
  memoryLine.setData([rss, heapTotal, heapUsed]);
}

function eventLoopPage (screen : any) {
  screen.append(eventLoopLine);
  eventLoopLine.setData([loopDelays]);
}

function loopUtilizationPage (screen : any) {
  screen.append(loopUtilLine);
  loopUtilLine.setData([loopUtil]);
}

function cpuPage (screen : any) {
  screen.append(cpuDonuts);
  cpuDonuts.setData(cpus);
}

function handlesPage (screen : any) {
  screen.append(handlesLine);
  handlesLine.setData([handlesData]);
}

function gcCountsPage (screen : any) {
  screen.append(gcCounts);
  gcCounts.setData(gcCountData);
}

function gcDurationsPage (screen : any) {
  screen.append(gcDuration);
  gcDuration.setData([gcDurationData]);
}

function getDonutColor (sample : number) {
  if (sample < 50) {
    return 'green';
  } else if (sample >= 50 && sample < 90) {
    return 'yellow';
  }
  return 'red';
}

function plot (sample : Sample) {
  rss.y.shift();
  rss.y.push(sample.memory.rss / 1024 / 1024);
  heapTotal.y.shift();
  heapTotal.y.push(sample.memory.heapTotal / 1024 / 1024);

  heapUsed.y.shift();
  heapUsed.y.push(sample.memory.heapUsed / 1024 / 1024);

  loopUtil.y.shift();
  loopUtil.y.push(
    sample.loopUtilization ? sample.loopUtilization.utilization : 0);

  if (sample.eventLoop !== undefined) {
    (eventLoopLine as any).options.minY = sample.eventLoop.min;
    (eventLoopLine as any).options.maxX = sample.eventLoop.max;
    loopDelays.y = [
      sample.eventLoop.p10,
      sample.eventLoop.p25,
      sample.eventLoop.p50,
      sample.eventLoop.p75,
      sample.eventLoop.p90,
      sample.eventLoop.p97_5,
      sample.eventLoop.p99,
      sample.eventLoop.p99_9,
      sample.eventLoop.p99_99,
      sample.eventLoop.p99_999
    ] as any;
  }

  cpus[0].percent = Math.floor(sample.cpu * 100);
  cpus[0].color = getDonutColor(cpus[0].percent);

  cpus[1].percent = Math.floor(sample.loadAvg.a1 * 100);
  cpus[1].color = getDonutColor(cpus[1].percent);

  cpus[2].percent = Math.floor(sample.loadAvg.a5 * 100);
  cpus[2].color = getDonutColor(cpus[2].percent);

  cpus[3].percent = Math.floor(sample.loadAvg.a15 * 100);
  cpus[3].color = getDonutColor(cpus[3].percent);

  if (sample.handles !== undefined) {
    (handlesData as any).x = sample.handles.titles;
    (handlesData as any).y = sample.handles.data;
  }

  if (sample.gc !== undefined) {
    gcCountData.data[0] = sample.gc.major;
    gcCountData.data[1] = sample.gc.minor;
    gcCountData.data[2] = sample.gc.incremental;
    gcCountData.data[3] = sample.gc.weakcbs;
    (gcDuration as any).options.minY = sample.gc.duration.min;
    (gcDuration as any).options.maxX = sample.gc.duration.max;
    gcDurationData.y = [
      sample.gc.duration.p10,
      sample.gc.duration.p25,
      sample.gc.duration.p50,
      sample.gc.duration.p75,
      sample.gc.duration.p90,
      sample.gc.duration.p97_5,
      sample.gc.duration.p99,
      sample.gc.duration.p99_9,
      sample.gc.duration.p99_99,
      sample.gc.duration.p99_999
    ] as any;
  }

  switch (carousel.currPage) {
    case 0:
      memoryLine.setData([rss, heapTotal, heapUsed]);
      break;
    case 1:
      loopUtilLine.setData([loopUtil]);
      break;
    case 2:
      eventLoopLine.setData([loopDelays]);
      break;
    case 3:
      cpuDonuts.setData(cpus);
      break;
    case 4:
      handlesLine.setData([handlesData]);
      break;
    case 5:
      gcCounts.setData(gcCountData);
      break;
    case 6:
      gcDuration.setData([gcDurationData]);
      break;
  }

  screen.render();
}

const screen = blessed.screen();

const memoryLine = contrib.line({
  // width: 80,
  // height: 30,
  xLabelPadding: 3,
  xPadding: 5,
  label: 'Memory (MB)',
  showLegend: true,
  legend: { width: 12 }
} as any);

const eventLoopLine = contrib.line({
  xLabelPadding: 3,
  xPadding: 5,
  label: 'Event Loop Delay',
  showLegend: false,
  legend: { width: 12 }
} as any);

const loopUtilLine = contrib.line({
  xLabelPadding: 3,
  xPadding: 5,
  label: 'Event Loop Utilization',
  showLegend: false,
  legend: { width: 12 }
} as any);

const cpuDonuts = contrib.donut({
  label: 'CPU Load',
  radius: 8,
  arcWidth: 3,
  remainColor: 'black',
  yPadding: 2,
  data: cpus
});

const handlesLine = contrib.line({
  xLabelPadding: 3,
  xPadding: 5,
  label: 'Handles',
  showLegend: true,
  wholeNumbersOnly: true,
  legend: { width: 12 }
} as any);

const gcCounts = contrib.bar({
  label: 'Garbage Collection Counts',
  barWith: 4,
  barSpacing: 6,
  xOffset: 0,
  maxHeight: 9
} as any);

const gcDuration = contrib.line({
  xLabelPadding: 3,
  xPadding: 5,
  label: 'Garbage Collection Duration',
  showLegend: false,
  legend: { width: 12 }
} as any);

const carousel = new (contrib as any).carousel(  // eslint-disable-line
  [
    memoryPage,
    loopUtilizationPage,
    eventLoopPage,
    cpuPage,
    handlesPage,
    gcCountsPage,
    gcDurationsPage
  ],
  {
    screen: screen,
    interval: 0,
    controlKeys: true
  });
carousel.start();

screen.key(['escape', 'q', 'C-c'], () => {
  return process.exit(0);
});
