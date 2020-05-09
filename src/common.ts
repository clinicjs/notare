

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

export interface LoadAvgSample {
  a1: number,
  a5: number,
  a15: number
}

export interface Sample {
  pid : number,
  threadId : number,
  memory : MemorySample,
  cpu : number,
  cpus : CpuSample[],
  loadAvg: LoadAvgSample,
  eventLoop? : HistogramSample
}
