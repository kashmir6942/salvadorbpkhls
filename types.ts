export interface ClearkeyInfo {
  keyId: string
  key: string
}

export interface ChannelInfo {
  name: string
  logo: string
  group: string
  mpd: string
  clearkey: ClearkeyInfo
}

export interface DashManifest {
  mediaPresentationDuration?: string
  minimumUpdatePeriod?: string
  periods: Period[]
}

export interface Period {
  adaptationSets: AdaptationSet[]
}

export interface AdaptationSet {
  contentType: string
  representations: Representation[]
}

export interface Representation {
  id: string
  bandwidth: number
  width?: number
  height?: number
  codecs: string
  segmentTemplate?: SegmentTemplate
  baseURL?: string
}

export interface SegmentTemplate {
  initialization: string
  media: string
  startNumber: number
  timescale: number
  duration: number
}

export interface Env {
  // Add environment variables here if needed
  API_KEY?: string
  ALLOWED_ORIGINS?: string
}
