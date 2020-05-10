export interface MemorySample {
  arrayBuffers : number,
  external : number,
  heapTotal : number,
  heapUsed : number,
  rss : number
}

export interface CpuSample {
  model : string,
  speed : number,
  idle : number,
  irq : number,
  nice : number,
  sys : number,
  user : number
}

export interface HistogramSample {
  min: number,
  max: number,
  mean: number,
  stddev: number,
  p0_001: number,  // eslint-disable-line
  p0_01: number,   // eslint-disable-line
  p0_1: number,    // eslint-disable-line
  p1: number,      // eslint-disable-line
  p2_5: number,    // eslint-disable-line
  p10: number,     // eslint-disable-line
  p25: number,     // eslint-disable-line
  p50: number,     // eslint-disable-line
  p75: number,     // eslint-disable-line
  p90: number,     // eslint-disable-line
  p97_5: number,   // eslint-disable-line
  p99: number,     // eslint-disable-line
  p99_9: number,   // eslint-disable-line
  p99_99: number,  // eslint-disable-line
  p99_999: number  // eslint-disable-line
}

export interface LoadAvgSample {
  a1: number,
  a5: number,
  a15: number
}

export interface HandlesSample {
  titles: string[],
  data: number[]
}

export interface Sample {
  pid : number,
  threadId : number,
  memory : MemorySample,
  cpu : number,
  cpus : CpuSample[],
  loadAvg: LoadAvgSample,
  eventLoop? : HistogramSample,
  handles?: HandlesSample
}
